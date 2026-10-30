package kz.kurultai.assistant;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.util.Log;

import org.json.JSONObject;

import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * Живой голосовой режим через наш сервер: {@code WS {BACKEND_URL}/live} (контракт — docs/kurultai/voice-contract.md,
 * протокол — docs/astana-hub/api-contract.md «WS /v1/live»). Перенос клиента Astana Hub (LiveSession/LiveMicrophone/
 * StreamPlayer) на Java: микрофон PCM16 16 кГц уходит непрерывно, сервер сам находит конец фразы, отвечает агентом
 * профиля kurultai и стримит голос ElevenLabs (PCM16 24 кГц), перебивание — «стоп» голосом или {@link #interrupt()}.
 */
final class LiveVoice {
    private static final String TAG = "KurultaiLive";
    private static final int MIC_RATE = 16_000;
    private static final int FRAME_MS = 40;
    private static final int FRAME_BYTES = MIC_RATE / 1000 * FRAME_MS * 2;
    private static final int PLAYBACK_DONE_MARGIN_MS = 600;

    interface Listener {
        /** idle / listening / user_speaking / thinking / speaking — для голосовой панели. */
        void onState(String state);
        void onUserText(String text, boolean isFinal, String lang);
        void onPhrase(String text);
        /** Ход закончен и доигран: полный текст ответа, язык. */
        void onTurnDone(String answer, String lang);
        void onIgnored(String reason);
        /** Сессия упала или закрыта сервером: робот переходит на обычный режим. */
        void onFailed(String error);
    }

    private final Context context;
    private final String baseUrl;
    private final String token;
    private final Listener listener;
    private final OkHttpClient client;

    private volatile WebSocket ws;
    private volatile boolean active;
    private volatile boolean ready;
    private volatile boolean greetPending;
    private volatile boolean aec;
    private volatile String currentTurn;
    private volatile boolean dropping;
    private volatile boolean turnEnded;
    private volatile String turnLang = "ru";
    private final StringBuilder turnText = new StringBuilder();
    private volatile long lastActivityAt;

    private AudioRecord record;
    private AcousticEchoCanceler echo;
    private NoiseSuppressor noise;
    private boolean stereo;
    private Thread micThread;

    private final Object playLock = new Object();
    private AudioTrack track;
    private int playRate = 24_000;
    private final LinkedBlockingQueue<byte[]> playQueue = new LinkedBlockingQueue<>();
    private Thread playThread;
    private volatile long queuedBytes;
    private volatile long playedBytes;
    private volatile boolean playing;

    LiveVoice(Context context, String baseUrl, String token, Listener listener) {
        this.context = context.getApplicationContext();
        this.baseUrl = baseUrl;
        this.token = token;
        this.listener = listener;
        this.client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .pingInterval(10, TimeUnit.SECONDS)
            .build();
    }

    boolean isActive() { return active; }
    boolean isPlaying() { return playing; }
    long lastActivityAt() { return lastActivityAt; }

    /** Открыть разговор. greet — после ready отправить visitor_arrived (сервер поздоровается). */
    synchronized void start(String lang, boolean greet) {
        if (active) { if (greet) visitorArrived(); return; }
        active = true;
        ready = false;
        greetPending = greet;
        dropping = false;
        currentTurn = null;
        lastActivityAt = System.currentTimeMillis();
        if (!openMic()) {
            active = false;
            listener.onFailed("микрофон не открылся");
            return;
        }
        String safeLang = lang != null && lang.startsWith("kk") ? "kk" : "ru";
        String url = liveUrl(baseUrl, safeLang, UUID.randomUUID().toString());
        Request request = new Request.Builder().url(url).header("Authorization", "Bearer " + token).build();
        final String helloLang = safeLang;
        ws = client.newWebSocket(request, new WebSocketListener() {
            @Override public void onOpen(WebSocket socket, Response response) {
                try {
                    socket.send(new JSONObject().put("type", "hello").put("lang", helloLang)
                        .put("place_id", JSONObject.NULL).put("aec", aec).toString());
                    Log.i(TAG, "hello sent lang=" + helloLang + " aec=" + aec + " stereo=" + stereo);
                } catch (Exception e) { Log.w(TAG, "hello failed", e); }
                startMicThread();
            }
            @Override public void onMessage(WebSocket socket, String text) { handle(text); }
            @Override public void onMessage(WebSocket socket, ByteString bytes) {
                if (!dropping) enqueueAudio(bytes.toByteArray());
            }
            @Override public void onClosing(WebSocket socket, int code, String reason) {
                socket.close(1000, null);
                if (active) fail("сервер закрыл live: " + code + (reason == null || reason.isEmpty() ? "" : " " + reason));
            }
            @Override public void onFailure(WebSocket socket, Throwable t, Response response) {
                if (!active) return;
                int http = response == null ? 0 : response.code();
                String why = http == 401 || http == 403 ? "нет доступа к live (токен)" :
                    http == 404 ? "на сервере нет live" : "нет связи с live: " + (t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage());
                fail(why);
            }
        });
    }

    void visitorArrived() {
        lastActivityAt = System.currentTimeMillis();
        if (!active) return;
        if (ready) sendJson("{\"type\":\"visitor_arrived\"}"); else greetPending = true;
    }

    /** Перебить ответ (кнопка, «стоп»). */
    void interrupt() {
        if (!active) return;
        boolean wasPlaying = playing || (currentTurn != null && !turnEnded);
        flushPlayback();
        dropping = currentTurn != null;
        sendJson("{\"type\":\"interrupt\"}");
        if (wasPlaying) listener.onState("listening");
    }

    /** Закрыть разговор (посетитель ушёл, переход в обычный режим). */
    synchronized void stop() {
        if (!active) return;
        active = false;
        try { WebSocket s = ws; if (s != null) s.close(1000, null); } catch (Throwable ignored) { }
        ws = null;
        closeMic();
        stopPlayback();
        listener.onState("idle");
    }

    // ---------- сервер → робот ----------

    private void handle(String text) {
        JSONObject msg;
        try { msg = new JSONObject(text); } catch (Exception e) { return; }
        String type = str(msg, "type");
        switch (type) {
            case "ready": {
                ready = true;
                String format = str(msg, "audio_format");
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("^pcm_s16le_(\\d{4,6})$").matcher(format);
                configurePlayback(m.matches() ? Integer.parseInt(m.group(1)) : 24_000);
                if (greetPending) { greetPending = false; sendJson("{\"type\":\"visitor_arrived\"}"); }
                listener.onState("listening");
                break;
            }
            case "listening": if (!playing) listener.onState("listening"); break;
            case "user_speaking":
                lastActivityAt = System.currentTimeMillis();
                if (!(playing && !aec)) listener.onState("user_speaking");
                break;
            case "user_partial": listener.onUserText(str(msg, "text"), false, null); break;
            case "user_final":
                lastActivityAt = System.currentTimeMillis();
                listener.onUserText(str(msg, "text"), true, str(msg, "lang"));
                break;
            case "ignored": listener.onIgnored(str(msg, "reason")); listener.onState("listening"); break;
            case "thinking": listener.onState("thinking"); break;
            case "turn_start":
                currentTurn = str(msg, "turn_id");
                dropping = false;
                turnEnded = false;
                synchronized (turnText) { turnText.setLength(0); }
                lastActivityAt = System.currentTimeMillis();
                break;
            case "phrase": {
                if (dropping) break;
                String phrase = str(msg, "text");
                synchronized (turnText) { if (turnText.length() > 0) turnText.append(' '); turnText.append(phrase); }
                listener.onPhrase(phrase);
                break;
            }
            case "turn_end":
                if (dropping) break;
                turnEnded = true;
                if (!str(msg, "lang").isEmpty()) turnLang = str(msg, "lang");
                watchPlaybackDone(str(msg, "turn_id").isEmpty() ? currentTurn : str(msg, "turn_id"));
                break;
            case "interrupted":
                flushPlayback();
                dropping = true;
                listener.onState("listening");
                break;
            case "error": {
                JSONObject err = msg.optJSONObject("error");
                String m = err == null ? str(msg, "message") : str(err, "message");
                Log.w(TAG, "server error: " + msg);
                // Ошибка хода не рвёт сессию: сервер продолжает слушать. Сообщаем панели.
                listener.onIgnored("error: " + (m.isEmpty() ? "ошибка сервера" : m));
                break;
            }
            default: break;
        }
    }

    private void watchPlaybackDone(final String turnId) {
        Thread t = new Thread(() -> {
            long deadline = System.currentTimeMillis() + 120_000L;
            while (active && System.currentTimeMillis() < deadline) {
                if (dropping) return;
                boolean drained = playQueue.isEmpty() && playedBytes >= queuedBytes;
                if (drained && headReached()) break;
                try { Thread.sleep(40); } catch (InterruptedException e) { return; }
            }
            try { Thread.sleep(PLAYBACK_DONE_MARGIN_MS); } catch (InterruptedException e) { return; }
            if (!active || dropping) return;
            playing = false;
            if (turnId != null && !turnId.isEmpty()) {
                try { sendJson(new JSONObject().put("type", "playback_done").put("turn_id", turnId).toString()); } catch (Exception ignored) { }
            }
            String answer;
            synchronized (turnText) { answer = turnText.toString(); }
            if (turnId != null && turnId.equals(currentTurn)) currentTurn = null;
            lastActivityAt = System.currentTimeMillis();
            listener.onTurnDone(answer, turnLang);
            listener.onState("listening");
        }, "live-playback-done");
        t.setDaemon(true);
        t.start();
    }

    // ---------- микрофон ----------

    private boolean openMic() {
        int[] sources = {MediaRecorder.AudioSource.VOICE_COMMUNICATION, MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC};
        // RobotOS отдаёт массив микрофонов стерео; голос — левый канал (как у WavRecorder и Astana Hub).
        for (boolean wantStereo : new boolean[]{true, false}) {
            int mask = wantStereo ? AudioFormat.CHANNEL_IN_STEREO : AudioFormat.CHANNEL_IN_MONO;
            int min = AudioRecord.getMinBufferSize(MIC_RATE, mask, AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) continue;
            for (int source : sources) {
                AudioRecord r;
                try { r = new AudioRecord(source, MIC_RATE, mask, AudioFormat.ENCODING_PCM_16BIT, min * 4); }
                catch (Throwable e) { continue; }
                if (r.getState() != AudioRecord.STATE_INITIALIZED) { r.release(); continue; }
                try {
                    if (AcousticEchoCanceler.isAvailable()) {
                        echo = AcousticEchoCanceler.create(r.getAudioSessionId());
                        if (echo != null) { echo.setEnabled(true); if (!echo.getEnabled()) { echo.release(); echo = null; } }
                    }
                    if (NoiseSuppressor.isAvailable()) {
                        noise = NoiseSuppressor.create(r.getAudioSessionId());
                        if (noise != null) noise.setEnabled(true);
                    }
                    r.startRecording();
                } catch (Throwable e) {
                    Log.w(TAG, "mic start failed source=" + source, e);
                    r.release();
                    continue;
                }
                record = r;
                stereo = wantStereo;
                aec = echo != null;
                Log.i(TAG, "mic source=" + source + " stereo=" + wantStereo + " aec=" + aec + " ns=" + (noise != null));
                return true;
            }
        }
        return false;
    }

    private void startMicThread() {
        micThread = new Thread(() -> {
            short[] raw = new short[FRAME_BYTES / 2 * (stereo ? 2 : 1)];
            byte[] frame = new byte[FRAME_BYTES];
            while (active) {
                AudioRecord r = record;
                if (r == null) break;
                int filled = 0;
                while (filled < raw.length && active) {
                    int n = r.read(raw, filled, raw.length - filled);
                    if (n < 0) { fail("ошибка микрофона " + n); return; }
                    filled += n;
                }
                int step = stereo ? 2 : 1;
                for (int i = 0, j = 0; i < raw.length; i += step, j += 2) {
                    short s = raw[i];
                    frame[j] = (byte) (s & 0xFF);
                    frame[j + 1] = (byte) ((s >> 8) & 0xFF);
                }
                WebSocket s = ws;
                if (s != null) s.send(ByteString.of(frame));
            }
        }, "live-mic");
        micThread.setDaemon(true);
        micThread.start();
    }

    private void closeMic() {
        AudioRecord r = record;
        record = null;
        try { if (r != null) { r.stop(); r.release(); } } catch (Throwable ignored) { }
        try { if (echo != null) echo.release(); } catch (Throwable ignored) { }
        try { if (noise != null) noise.release(); } catch (Throwable ignored) { }
        echo = null; noise = null;
    }

    // ---------- воспроизведение ----------

    private void configurePlayback(int rate) {
        synchronized (playLock) {
            playRate = rate;
            if (track != null) return;
            int min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            // USAGE_VOICE_COMMUNICATION — как у Astana Hub: звук идёт опорой эхоподавления микрофона.
            track = new AudioTrack(
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build(),
                new AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build(),
                Math.max(min * 4, rate * 2 / 2), AudioTrack.MODE_STREAM, android.media.AudioManager.AUDIO_SESSION_ID_GENERATE);
            track.play();
            queuedBytes = 0; playedBytes = 0;
            playThread = new Thread(this::playLoop, "live-play");
            playThread.setDaemon(true);
            playThread.start();
        }
    }

    private void enqueueAudio(byte[] pcm) {
        if (pcm.length == 0) return;
        if (!playing) { playing = true; listener.onState("speaking"); }
        queuedBytes += pcm.length;
        playQueue.add(pcm);
    }

    private void playLoop() {
        while (active) {
            byte[] pcm;
            try { pcm = playQueue.poll(200, TimeUnit.MILLISECONDS); } catch (InterruptedException e) { return; }
            if (pcm == null) continue;
            AudioTrack t;
            synchronized (playLock) { t = track; }
            if (t == null) return;
            int off = 0;
            while (off < pcm.length && active) {
                int n = t.write(pcm, off, pcm.length - off);
                if (n < 0) { Log.w(TAG, "AudioTrack write " + n); break; }
                off += n;
            }
            playedBytes += pcm.length;
        }
    }

    /** Доиграл ли трек всё записанное (позиция головки в кадрах ≥ записано байт / 2). */
    private boolean headReached() {
        synchronized (playLock) {
            if (track == null) return true;
            long frames = track.getPlaybackHeadPosition() & 0xFFFFFFFFL;
            return frames * 2 >= playedBytes - playRate / 10;
        }
    }

    private void flushPlayback() {
        playQueue.clear();
        synchronized (playLock) {
            if (track != null) {
                try { track.pause(); track.flush(); track.play(); } catch (Throwable ignored) { }
                // После flush головка не всегда сбрасывается — считаем записанным то, что уже «сыграно».
                long frames = track.getPlaybackHeadPosition() & 0xFFFFFFFFL;
                playedBytes = frames * 2;
                queuedBytes = playedBytes;
            }
        }
        playing = false;
    }

    private void stopPlayback() {
        playQueue.clear();
        synchronized (playLock) {
            if (track != null) { try { track.pause(); track.flush(); track.release(); } catch (Throwable ignored) { } }
            track = null;
        }
        playing = false;
    }

    // ---------- служебное ----------

    private void fail(String error) {
        if (!active) return;
        Log.w(TAG, "live failed: " + error);
        stop();
        listener.onFailed(error);
    }

    private void sendJson(String json) {
        WebSocket s = ws;
        if (s != null) s.send(json);
    }

    private static String str(JSONObject o, String key) {
        if (o == null || o.isNull(key)) return "";
        String v = o.optString(key, "");
        return "null".equals(v) ? "" : v;
    }

    static String liveUrl(String baseUrl, String lang, String sessionId) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        base = base.replaceFirst("^https://", "wss://").replaceFirst("^http://", "ws://");
        return base + "/live?session_id=" + sessionId + "&lang=" + lang;
    }
}
