package kz.kurultai.assistant;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import com.ainirobot.coreservice.client.listener.TextListener;
import com.ainirobot.coreservice.client.speech.SkillApi;
import com.ainirobot.coreservice.client.speech.entity.TTSEntity;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Local device speech. OpenAI is used only to generate answer text. */
final class Speaker {
    private static final String TAG = "SimpleSpeaker";
    private static final int MAX_CHUNK = 300;
    private static final int ROBOT_MAX_CHUNK = 2000;
    interface Callback { void onSpeechDone(boolean usedRobotTts, String error); }
    interface SkillProvider { SkillApi getConnectedSkillApi(); }
    private final Context context;
    private final SkillProvider provider;
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextToSpeech tts;
    private volatile boolean initFinished;
    private volatile boolean ready;
    private volatile String initError = "TTS инициализируется";
    private volatile int generation;
    private volatile Pending pending;

    private static final class Pending {
        final List<String> parts; final String language; final int generation; final Callback callback;
        Pending(List<String> p, String l, int g, Callback c) { parts=p; language=l; generation=g; callback=c; }
    }

    Speaker(Context activity, SkillProvider skillProvider) {
        context = activity.getApplicationContext();
        provider = skillProvider;
        Log.i(TAG, "Creating Android TextToSpeech early");
        tts = new TextToSpeech(context, status -> {
            initFinished = true;
            Log.i(TAG, "onInit status=" + status);
            if (status != TextToSpeech.SUCCESS) {
                ready = false;
                initError = "TTS engine init failed: " + status;
                Log.e(TAG, initError);
                Pending q = pending; pending = null;
                if (q != null) q.callback.onSpeechDone(false, initError);
                return;
            }
            try {
                tts.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            } catch (Throwable e) { Log.w(TAG, "Audio attributes unavailable", e); }
            ready = true; initError = null;
            Log.i(TAG, "TTS READY engine=" + safeEngine());
            Pending q = pending; pending = null;
            if (q != null && q.generation == generation) speakLocal(q);
        });
    }

    void speak(String raw, String language, Callback callback) {
        String clean = sanitize(raw);
        if (clean.isEmpty()) { callback.onSpeechDone(false, "Пустой текст"); return; }
        SkillApi api = robotApi();
        Pending request = new Pending(chunk(clean, api != null ? ROBOT_MAX_CHUNK : MAX_CHUNK), language, ++generation, callback);
        if (api != null) {
            Log.i(TAG, "ROBOT tts chunks=" + request.parts.size());
            speakRobot(api, request.parts, 0, request.generation, request.language, request.callback);
        } else {
            Log.i(TAG, "robot tts unavailable -> ANDROID tts");
            queueOrSpeakLocal(request);
        }
    }

    private SkillApi robotApi() {
        try {
            SkillApi api = provider == null ? null : provider.getConnectedSkillApi();
            return api != null && api.isApiConnectedService() ? api : null;
        } catch (Throwable error) {
            Log.w(TAG, "robot api check failed", error);
            return null;
        }
    }

    private void speakRobot(final SkillApi api, final List<String> parts, final int index,
                            final int gen, final String language, final Callback callback) {
        if (gen != generation) return;
        if (index >= parts.size()) { callback.onSpeechDone(true, null); return; }
        try {
            String sid = "kurultai-" + gen + "-" + index + "-" + System.currentTimeMillis();
            // Keep the exact RobotSample-compatible call. Some SG04 RobotOS builds
            // reject SpeechLanguage in TTSEntity even though the enum exists.
            // The native engine selects Russian/Kazakh from the actual text.
            TTSEntity entity = new TTSEntity(sid, parts.get(index));
            Log.i(TAG, "SkillApi.playText(TTSEntity) sid=" + sid + " part=" + index + " len=" + parts.get(index).length());
            api.playText(entity, new TextListener() {
                @Override public void onStart() { super.onStart(); Log.i(TAG, "Robot TTS onStart sid=" + sid); }
                @Override public void onComplete() { super.onComplete(); Log.i(TAG, "Robot TTS onComplete sid=" + sid); main.post(() -> speakRobot(api, parts, index + 1, gen, language, callback)); }
                // Intentional cancellation increments generation in stop(), so stale onStop cannot resume.
                @Override public void onStop() { super.onStop(); Log.i(TAG, "Robot TTS onStop sid=" + sid); main.post(() -> speakRobot(api, parts, index + 1, gen, language, callback)); }
                @Override public void onError() { super.onError(); Log.e(TAG, "Robot TTS onError sid=" + sid); main.post(() -> fallbackRemainder(parts, index, gen, language, callback)); }
            });
        } catch (Throwable error) {
            Log.w(TAG, "SkillApi.playText threw; falling back", error);
            main.post(() -> fallbackRemainder(parts, index, gen, language, callback));
        }
    }

    private void fallbackRemainder(List<String> parts, int index, int gen, String language, Callback callback) {
        if (gen != generation) return;
        queueOrSpeakLocal(new Pending(new ArrayList<>(parts.subList(index, parts.size())), language, gen, callback));
    }

    private void queueOrSpeakLocal(Pending request) {
        if (!ready) {
            if (initFinished) request.callback.onSpeechDone(false, initError == null ? "TTS недоступен" : initError);
            else { pending = request; Log.w(TAG, "engine not ready — queued"); }
            return;
        }
        speakLocal(request);
    }

    private void speakLocal(Pending request) {
        if (request.generation != generation || tts == null) return;
        makeMediaAudible();
        if (selectLanguage(request.language) == null) {
            request.callback.onSpeechDone(false, "Нет голосовых данных kk, ru или en"); return;
        }
        String lastId = "kurultai-" + request.generation + "-" + (request.parts.size()-1);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { Log.i(TAG, "speaking " + id); }
            @Override public void onDone(String id) { if (lastId.equals(id) && request.generation == generation) request.callback.onSpeechDone(false, null); }
            @Override public void onError(String id) { Log.e(TAG, "playback error " + id); if (request.generation == generation) request.callback.onSpeechDone(false, "Ошибка локального TTS"); }
        });
        for (int i=0; i<request.parts.size(); i++) {
            Bundle params = new Bundle();
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC);
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1f);
            String id = "kurultai-" + request.generation + "-" + i;
            int result = tts.speak(request.parts.get(i), i==0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, params, id);
            Log.i(TAG, "speak " + id + " returned=" + result + " len=" + request.parts.get(i).length());
            if (result == TextToSpeech.ERROR) { request.callback.onSpeechDone(false, "TTS отклонил текст"); return; }
        }
    }

    private Locale selectLanguage(String requested) {
        Locale primary = requested != null && requested.startsWith("ru") ? new Locale("ru","RU") : new Locale("kk","KZ");
        for (Locale locale : new Locale[]{primary, new Locale("ru","RU"), Locale.US}) {
            int result = tts.setLanguage(locale);
            Log.i(TAG, "setLanguage(" + locale + ")=" + result);
            if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) return locale;
        }
        return null;
    }

    private void makeMediaAudible() {
        try {
            AudioManager audio=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
            int current=audio.getStreamVolume(AudioManager.STREAM_MUSIC), max=audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            Log.i(TAG,"music volume="+current+"/"+max);
            if(current==0&&max>0){audio.setStreamVolume(AudioManager.STREAM_MUSIC,Math.max(1,max/2),0);Log.w(TAG,"media was muted; volume raised");}
        } catch(Throwable e){Log.w(TAG,"Cannot inspect media volume",e);}
    }

    String diagnose() {
        String state;
        try { state = KurultaiApplication.get().stateText(); } catch (Throwable ignored) { state = "Application unavailable"; }
        StringBuilder out=new StringBuilder("robotState=").append(state).append("; robotTts=").append(robotApi()!=null).append("; androidReady=").append(ready).append("; initFinished=").append(initFinished).append("; error=").append(initError).append("; engine=").append(safeEngine());
        try{out.append("; engines=").append(tts==null?0:tts.getEngines().size());}catch(Throwable ignored){}
        try{AudioManager a=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);out.append("; musicVolume=").append(a.getStreamVolume(AudioManager.STREAM_MUSIC)).append('/').append(a.getStreamMaxVolume(AudioManager.STREAM_MUSIC));}catch(Throwable ignored){}
        Log.i(TAG,"DIAG "+out); return out.toString();
    }

    void stop(){generation++;pending=null;try{SkillApi api=robotApi();if(api!=null)api.stopTTS();}catch(Throwable ignored){}try{if(tts!=null)tts.stop();}catch(Throwable ignored){}}
    void shutdown(){stop();try{if(tts!=null)tts.shutdown();}catch(Throwable ignored){}tts=null;ready=false;}
    private String safeEngine(){try{return tts==null?"none":tts.getDefaultEngine();}catch(Throwable ignored){return "unknown";}}

    static String sanitize(String value) {
        if(value==null)return "";
        return value.replaceAll("(?s)```.*?```"," ").replaceAll("`([^`]*)`","$1").replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)"," ").replaceAll("\\[([^\\]]*)\\]\\([^)]*\\)","$1").replaceAll("https?://\\S+"," ").replaceAll("(?m)^\\s{0,3}#{1,6}\\s*","").replaceAll("(?m)^\\s{0,3}[-*+]\\s+","").replaceAll("\\*\\*([^*]+)\\*\\*","$1").replaceAll("__([^_]+)__","$1").replaceAll("[\\p{So}\\p{Cs}]"," ").replaceAll("(?iu)^\\s*(вывод|қорытынды|ответ|жауап|gpt)\\s*[:：-]\\s*","").replaceAll("\\s+"," ").trim();
    }
    static List<String> chunk(String text,int max){List<String> out=new ArrayList<>();StringBuilder cur=new StringBuilder();for(String s:text.split("(?<=[.!?…])\\s+")){if(s.length()>max){flush(out,cur);for(int i=0;i<s.length();i+=max)out.add(s.substring(i,Math.min(s.length(),i+max)));continue;}if(cur.length()+s.length()+1>max)flush(out,cur);if(cur.length()>0)cur.append(' ');cur.append(s);}flush(out,cur);if(out.isEmpty())out.add(text);return out;}
    private static void flush(List<String> out,StringBuilder cur){if(cur.length()>0){out.add(cur.toString());cur.setLength(0);}}
}
