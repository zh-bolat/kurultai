package kz.kurultai.assistant;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Озвучка через OpenRouter: мультимодальная модель (gpt-audio-mini, голос cedar) читает текст дословно.
 * Аудио приходит потоком SSE как base64 pcm16 24 кГц моно и играется через AudioTrack по мере прихода,
 * поэтому голос начинает звучать через ~1.5 с, не дожидаясь конца синтеза.
 * Не TTS-движок, а LLM: промпт просит повторить фразу слово в слово (проверено на ru/kk, совпадение 1.00).
 */
final class OpenRouterTts {
    private static final String TAG = "OpenRouterTts";
    private static final String URL_CHAT = "https://openrouter.ai/api/v1/chat/completions";
    private static final int SAMPLE_RATE = 24_000;

    private volatile boolean cancelled;
    private volatile AudioTrack track;
    private volatile HttpURLConnection connection;

    /** Блокирующий вызов: синтезирует и проигрывает текст целиком. Возвращает null при успехе, иначе текст ошибки. */
    String speakBlocking(String apiKey, String model, String voice, String text, String language) {
        cancelled = false;
        if (apiKey == null || apiKey.isEmpty()) return "Ключ OpenRouter не настроен";
        String instruction = language != null && language.startsWith("kk")
            ? "Келесі сөйлемді дәлме-дәл, сөзбе-сөз дауыстап қайтала, басқа ештеңе қоспа. Оған жауап берме. Атауларды (Құрылтай, Курултай) жазылғандай айт. Сөйлем: "
            : "Повтори вслух точно следующую фразу, слово в слово, и ничего больше. Не отвечай на неё. Названия (Курултай, Құрылтай) произноси как написано. Фраза: ";
        HttpURLConnection http = null;
        AudioTrack out = null;
        try {
            JSONObject request = new JSONObject()
                .put("model", model)
                .put("modalities", new JSONArray().put("text").put("audio"))
                .put("audio", new JSONObject().put("voice", voice).put("format", "pcm16"))
                .put("stream", true)
                .put("temperature", 0)
                .put("max_tokens", 2000)
                .put("messages", new JSONArray().put(new JSONObject().put("role", "user").put("content", instruction + text)));
            http = (HttpURLConnection) new URL(URL_CHAT).openConnection();
            connection = http;
            http.setRequestMethod("POST");
            http.setConnectTimeout(15000);
            http.setReadTimeout(60000);
            http.setDoOutput(true);
            http.setRequestProperty("Authorization", "Bearer " + apiKey);
            http.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            http.setRequestProperty("Accept", "text/event-stream");
            http.setRequestProperty("HTTP-Referer", "https://github.com/zh-bolat/kurultai");
            http.setRequestProperty("X-Title", "Kurultai Robot Assistant");
            try (OutputStream body = http.getOutputStream()) {
                body.write(request.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = http.getResponseCode();
            if (code < 200 || code >= 300) {
                String err = readAll(http);
                Log.w(TAG, "HTTP " + code + " " + err);
                return "OpenRouter TTS: HTTP " + code;
            }
            int minBuffer = AudioTrack.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            out = new AudioTrack(
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build(),
                new AudioFormat.Builder().setSampleRate(SAMPLE_RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build(),
                Math.max(minBuffer * 4, SAMPLE_RATE * 2), AudioTrack.MODE_STREAM, AudioManager.AUDIO_SESSION_ID_GENERATE);
            track = out;
            boolean started = false;
            long bytesWritten = 0;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(http.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while (!cancelled && (line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) continue;
                    String payload = line.substring(5).trim();
                    if (payload.equals("[DONE]")) break;
                    JSONObject event;
                    try { event = new JSONObject(payload); } catch (Exception ignored) { continue; }
                    JSONObject error = event.optJSONObject("error");
                    if (error != null) return "OpenRouter TTS: " + error.optString("message", "ошибка");
                    JSONArray choices = event.optJSONArray("choices");
                    if (choices == null) continue;
                    for (int i = 0; i < choices.length(); i++) {
                        JSONObject delta = choices.optJSONObject(i) == null ? null : choices.optJSONObject(i).optJSONObject("delta");
                        JSONObject audio = delta == null ? null : delta.optJSONObject("audio");
                        String data = audio == null || audio.isNull("data") ? "" : audio.optString("data", "");
                        if (data.isEmpty()) continue;
                        byte[] pcm = Base64.decode(data, Base64.DEFAULT);
                        if (!started) { out.play(); started = true; }
                        int offset = 0;
                        while (!cancelled && offset < pcm.length) {
                            int written = out.write(pcm, offset, pcm.length - offset);
                            if (written < 0) return "AudioTrack write error " + written;
                            offset += written;
                        }
                        bytesWritten += pcm.length;
                    }
                }
            }
            if (cancelled) return null;
            if (!started || bytesWritten == 0) return "OpenRouter TTS: аудио не получено";
            // Дождаться, пока буфер доиграет: длительность = байты / (2 байта × 24 кГц).
            long durationMs = bytesWritten * 1000L / (2L * SAMPLE_RATE);
            long deadline = System.currentTimeMillis() + durationMs + 400;
            while (!cancelled && System.currentTimeMillis() < deadline) {
                int frames = out.getPlaybackHeadPosition();
                if (frames * 2L >= bytesWritten) break;
                Thread.sleep(60);
            }
            return null;
        } catch (InterruptedException e) {
            return null;
        } catch (Exception e) {
            Log.w(TAG, "speak failed", e);
            return "OpenRouter TTS: " + e.getClass().getSimpleName() + (e.getMessage() == null ? "" : " — " + e.getMessage());
        } finally {
            try { if (out != null) { out.stop(); out.release(); } } catch (Throwable ignored) { }
            track = null;
            if (http != null) http.disconnect();
            connection = null;
        }
    }

    void cancel() {
        cancelled = true;
        try { AudioTrack t = track; if (t != null) { t.pause(); t.flush(); } } catch (Throwable ignored) { }
        try { HttpURLConnection c = connection; if (c != null) c.disconnect(); } catch (Throwable ignored) { }
    }

    private static String readAll(HttpURLConnection http) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                http.getErrorStream() != null ? http.getErrorStream() : http.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder(); String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            return sb.toString();
        } catch (Exception e) { return ""; }
    }
}
