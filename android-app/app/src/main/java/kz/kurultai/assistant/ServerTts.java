package kz.kurultai.assistant;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Голос ElevenLabs через наш сервер (тот же, что у Astana Hub): {@code POST {BACKEND_URL}/tts} → MP3 одной фразы
 * (≤ 300 символов). Сервер кеширует фразы, повторы бесплатны и мгновенны.
 * Воспроизведение — MediaPlayer с USAGE_ASSISTANT, как у рабочего плеера Astana Hub на этом же роботе.
 */
final class ServerTts {
    private static final String TAG = "ServerTts";
    private final Context context;
    private volatile MediaPlayer current;
    private volatile CountDownLatch currentDone;
    private volatile int playCounter;

    ServerTts(Context context) { this.context = context.getApplicationContext(); }

    /** Скачивает MP3 фразы. Бросает исключение с понятным текстом при ошибке. */
    byte[] fetch(String baseUrl, String token, String text, String language) throws Exception {
        if (baseUrl == null || baseUrl.isEmpty() || token == null || token.isEmpty()) throw new Exception("сервер голоса не настроен");
        String url = baseUrl.endsWith("/") ? baseUrl + "tts" : baseUrl + "/tts";
        JSONObject body = new JSONObject().put("text", text);
        if (language != null && (language.startsWith("ru") || language.startsWith("kk") || language.startsWith("en"))) {
            body.put("lang", language.substring(0, 2));
        }
        HttpURLConnection http = (HttpURLConnection) new URL(url).openConnection();
        try {
            http.setRequestMethod("POST");
            http.setConnectTimeout(8000);
            http.setReadTimeout(15000);
            http.setDoOutput(true);
            http.setRequestProperty("Authorization", "Bearer " + token);
            http.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            http.setRequestProperty("Accept", "audio/mpeg");
            try (OutputStream out = http.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = http.getResponseCode();
            if (code < 200 || code >= 300) throw new Exception("сервер голоса: HTTP " + code);
            String provider = http.getHeaderField("X-Speech-Provider");
            if ("fake".equals(provider)) throw new Exception("сервер голоса без ElevenLabs");
            try (InputStream in = http.getInputStream(); ByteArrayOutputStream buf = new ByteArrayOutputStream(64 * 1024)) {
                byte[] chunk = new byte[16 * 1024];
                int n;
                while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                byte[] mp3 = buf.toByteArray();
                if (mp3.length < 512) throw new Exception("сервер голоса вернул пустой звук");
                return mp3;
            }
        } finally {
            http.disconnect();
        }
    }

    /** Проигрывает MP3 и ждёт конца. Возвращает null при успехе, иначе текст ошибки. Прерывается через {@link #cancel()}. */
    String playBlocking(byte[] mp3) {
        final int id = ++playCounter;
        File file = new File(context.getCacheDir(), "tts-" + id % 4 + ".mp3");
        try (FileOutputStream out = new FileOutputStream(file)) { out.write(mp3); }
        catch (Exception e) { return "не удалось сохранить звук: " + e.getClass().getSimpleName(); }
        final CountDownLatch done = new CountDownLatch(1);
        final AtomicReference<String> error = new AtomicReference<>(null);
        MediaPlayer player = new MediaPlayer();
        try {
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
            player.setDataSource(file.getAbsolutePath());
            player.setOnCompletionListener(mp -> done.countDown());
            player.setOnErrorListener((mp, what, extra) -> {
                error.set("MediaPlayer " + what + "/" + extra);
                done.countDown();
                return true;
            });
            player.prepare();
            current = player;
            currentDone = done;
            player.start();
            long waitMs = Math.max(4000L, player.getDuration() + 3000L);
            if (!done.await(waitMs, TimeUnit.MILLISECONDS)) Log.w(TAG, "playback timeout " + waitMs + " ms");
            return error.get();
        } catch (InterruptedException e) {
            return null;
        } catch (Exception e) {
            Log.w(TAG, "play failed", e);
            return "воспроизведение: " + e.getClass().getSimpleName();
        } finally {
            current = null;
            currentDone = null;
            try { player.release(); } catch (Throwable ignored) { }
        }
    }

    void cancel() {
        MediaPlayer p = current;
        CountDownLatch d = currentDone;
        try { if (p != null) p.stop(); } catch (Throwable ignored) { }
        if (d != null) d.countDown();
    }
}
