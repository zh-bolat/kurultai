package kz.kurultai.assistant;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.util.Base64;

import com.ainirobot.coreservice.client.RobotApi;
import com.ainirobot.coreservice.client.listener.ActionListener;
import com.ainirobot.coreservice.client.listener.CommandListener;
import com.ainirobot.coreservice.client.listener.Person;
import com.ainirobot.coreservice.client.person.PersonApi;
import com.ainirobot.coreservice.client.person.PersonListener;
import com.ainirobot.coreservice.client.speech.SkillApi;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {
    private static final String OPENAI_URL = "https://api.openai.com/v1/responses";
    private static final String OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
    private static final String OPENAI_MODEL = "gpt-5.6-luna";
    private static final String KEY_ALIAS = "kurultai-openai-api-key";
    private static final String PREFS = "secure_ai_config";
    private static final String PREF_CIPHER = "openai_key_cipher";
    private static final String PREF_IV = "openai_key_iv";
    private static final String PREF_MEETING_TITLE = "local_meeting_title";
    private static final String PREF_MEETING_TIME = "local_meeting_time";
    private static final String PREF_MEETING_LANGUAGE = "local_meeting_language";
    private static final String PREF_MEETING_REMINDED = "local_meeting_reminded";
    private static final String PREF_AUDIO_MODE = "assistant_audio_mode";
    private static final String PREF_ANSWER_LANGUAGE = "assistant_answer_language";
    private static final String ASSISTANT_INSTRUCTIONS =
        "Ты — ИИ-помощник депутата Курултая Ахмедиева Дархана Мейрамулы, председателя Комитета по цифровизации, инновациям и науке. Если тебя спрашивают, кто ты, всегда отвечай: «Я ИИ-помощник депутата Ахмедиева Дархана Мейрамулы». Никогда не называй себя ChatGPT, GPT, OpenAI, языковой моделью или чат-ботом. " +
        "Язык ответа передаётся в запросе. Если выбран русский, мысленно переведи казахский вопрос на русский и отвечай только по-русски. Если выбран казахский, отвечай только по-казахски. Если выбран автоматический режим, отвечай на языке вопроса. " +
        "Отвечай на любые вопросы о Курултае Республики Казахстан в целом: его устройство, полномочия, руководство, депутаты, комитеты, заседания, законопроекты и их статусы, депутатские запросы, планы работы, последние новости, события и обсуждаемые вопросы. " +
        "Также помогай по вопросам цифровизации, инноваций, науки, искусственного интеллекта, кибербезопасности, справок, тезисов и выступлений. " +
        "Если спрашивают о последних или актуальных вопросах, новостях, событиях или повестке Курултая, обязательно найди веб-поиском самые свежие официальные публикации Курултая на текущую дату, перечисли главное кратко и назови дату публикаций. " +
        "Не придумывай факты, цифры, документы, решения, полномочия, высказывания или позиции Ахмедиева Дархана Мейрамулы, Комитета или Курултая. " +
        "Любой изменяемый или проверяемый факт — дату, цифру, должность, статус документа, закон, решение или статистику — перед ответом обязательно проверяй веб-поиском на текущую дату. " +
        "Используй только первичные официальные источники государственных органов Республики Казахстан: правовые акты, официальные сайты госорганов, Президента, Парламента, Курултая и Бюро национальной статистики. " +
        "Состав комитетов, должности и имена депутатов бери только из официального раздела о работе Курултая. Депутатские запросы, их даты, номера, темы и авторов бери только из официального раздела депутатских запросов. Никогда не восстанавливай отсутствующее имя, автора или дату по догадке. " +
        "Не используй СМИ, блоги, Wikipedia, соцсети, коммерческие сайты и агрегаторы как основание для фактов. При расхождении данных бери самую свежую официальную публикацию и ясно назови дату данных. " +
        "Не показывай URL, ссылки, сноски, цитаты или раздел источников. Если надёжного официального подтверждения нет, не додумывай и не используй неофициальную замену: кратко скажи, что актуальные официальные данные не найдены, на языке вопроса. " +
        "Общайся естественно, как внимательный помощник в живом разговоре. Сразу отвечай по существу без заголовков «Вывод», «Қорытынды», «Ответ», «GPT» и без канцелярского вступления. Обычно отвечай двумя–четырьмя короткими предложениями. Если нужны детали — не более трёх коротких пунктов на том же языке. Обычно не более 70 слов. Если пользователь просит назвать депутатов или состав комитета и в нём не более 15 человек, перечисли всех полностью: фамилию, имя и отчество каждого. Если депутатов больше 15, сообщи их общее количество и назови полностью только основных представителей — председателя и заместителей председателя; остальных не перечисляй, если пользователь отдельно не попросил полный список. Не обрывай ответ посередине имени или списка. Завершай законченной мыслью. Не используй Markdown, звёздочки, решётки или кодовые блоки. " +
        "Если просьба относится к физическому поручению, которое робот не может безопасно выполнить, например принести воду или бумагу, ответь деликатно и кратко: объясни ограничение и предложи доступную помощь. Не обещай физическое действие. " +
        "Если входная фраза бессвязная, неразборчивая, не является вопросом, просьбой или приветствием, верни только точный маркер [REPEAT] без других слов. " +
        "При ответе по данным официального сайта не произноси домен, URL, слово «ссылка» или техническое название файла. Не говори «по скриншоту». Называй дату данных и сами события естественным языком. " +
        "Всегда пиши «Республика Казахстан» полностью; не используй «РК» или «КР». Названия государственных органов пиши полностью.";
    private WebView webView;
    private Speaker speaker;
    private SkillApi skillApi;
    private volatile boolean robotSpeechReady;
    private volatile String robotSpeechState = "RobotOS подключается";
    private volatile boolean continuousListening;
    private volatile boolean automaticVoiceMode;
    private volatile String answerLanguageMode = "auto";
    private volatile boolean speakingNow;
    private volatile boolean announcedSpeechReady;
    private volatile boolean holdRecording;
    private volatile boolean automaticRecording;
    private volatile boolean automaticSpeechDetected;
    private volatile long automaticStartedAt;
    private volatile long automaticLastVoiceAt;
    private volatile long automaticLoudSince;
    private volatile String previousUserQuestion = "";
    private volatile String previousAssistantAnswer = "";
    private int robotRequestId = 7300;
    private volatile boolean activityVisible;
    private volatile boolean welcomeMode = true;
    private volatile boolean personPresent;
    private volatile long lastGreetingAt;
    private volatile long lastFaceSeenAt;
    private volatile int lastGreetedPersonId = -1;
    private volatile long lastFriendlyLookAt;
    private volatile int greetingMotionGeneration;
    private volatile long lastBodyAlignAt;
    private volatile int activePersonId = -1;
    private volatile boolean followingPerson;
    private volatile boolean personListenerRegistered;
    private final WavRecorder wavRecorder = new WavRecorder();
    private final ExecutorService voiceExecutor = Executors.newSingleThreadExecutor();
    private volatile int voiceTurnId;
    private String listeningLanguage = "ru";

    private final Runnable automaticListenTimeout = new Runnable() {
        @Override public void run() {
            if (!automaticRecording || webView == null) return;
            long now = System.currentTimeMillis();
            if (speakingNow && !automaticSpeechDetected) {
                webView.postDelayed(this, 180L);
                return;
            }
            if (automaticSpeechDetected && now - automaticLastVoiceAt >= 1200L) {
                stopRawRecordingAndTranscribe();
                return;
            }
            if (now - automaticStartedAt >= 10000L) {
                cancelAutomaticRecording();
                if (continuousListening && personPresent) webView.postDelayed(() -> startAutomaticListening(), 900L);
                return;
            }
            webView.postDelayed(this, 180L);
        }
    };

    private final Runnable meetingCheckRunnable = new Runnable() {
        @Override public void run() {
            checkLocalMeetingReminder();
            refreshQuryltaiData();
            if (activityVisible && webView != null) webView.postDelayed(this, 30000L);
        }
    };

    private final PersonListener personListener = new PersonListener() {
        @Override public void personChanged() {
            inspectVisiblePeople();
        }
    };

    private final Runnable personPollRunnable = new Runnable() {
        @Override public void run() {
            if (!activityVisible || webView == null) return;
            inspectVisiblePeople();
            webView.postDelayed(this, 1000L);
        }
    };

    private void inspectVisiblePeople() {
        if (!activityVisible || !welcomeMode || !robotApiReady()) return;
        try {
            // Greeting is camera/face driven only. Do not use sound direction or
            // generic body detections: they can trigger from people farther away.
            java.util.List<Person> people = PersonApi.getInstance().getCompleteFaceList();
            if (people == null || people.isEmpty()) {
                if (followingPerson) {
                    runOnUiThread(() -> setHandsFreeStatus("Следую за вами · ищу в кадре"));
                    return;
                }
                // A face can disappear briefly when a visitor turns their head.
                // Keep the same conversation alive instead of greeting again.
                if (personPresent && System.currentTimeMillis() - lastFaceSeenAt < 4000L) return;
                if (personPresent) runOnUiThread(() -> {
                    setHandsFreeStatus("Посетитель отошёл");
                    greetingMotionGeneration++;
                    stopRobotMotion();
                    lookAtVisitor(0, 34);
                    uiJs("window.onGreetingMotion && window.onGreetingMotion(false)");
                });
                personPresent = false;
                continuousListening = false;
                previousUserQuestion = "";
                previousAssistantAnswer = "";
                runOnUiThread(() -> cancelAutomaticRecording());
                return;
            }
            Person nearest = null;
            for (Person person : people) {
                if (person == null || person.getDistance() < 0.0 || person.getDistance() > 2.2) continue;
                if (nearest == null || person.getDistance() < nearest.getDistance()) nearest = person;
            }
            if (nearest == null) {
                if (personPresent && System.currentTimeMillis() - lastFaceSeenAt >= 4000L) {
                    personPresent = false;
                    continuousListening = false;
                    runOnUiThread(() -> cancelAutomaticRecording());
                }
                return;
            }
            lastFaceSeenAt = System.currentTimeMillis();
            activePersonId = nearest.getId();
            if (personPresent) {
                // Body Follow owns head, vision tracking and chassis control.
                // Sending moveHead/turn commands here resets its target (status 1032).
                if (followingPerson) return;
                long now = System.currentTimeMillis();
                if (now - lastFriendlyLookAt > 700L) {
                    lastFriendlyLookAt = now;
                    int lookAngle = Math.max(-45, Math.min(45, nearest.getAngle()));
                    runOnUiThread(() -> {
                        lookAtVisitor(lookAngle, 34);
                        alignBodyToFace(lookAngle);
                    });
                }
                return;
            }
            long now = System.currentTimeMillis();
            if (speakingNow || holdRecording) return;
            personPresent = true;
            continuousListening = automaticVoiceMode;
            boolean sameRecentlyGreetedFace = nearest.getId() == lastGreetedPersonId && now - lastGreetingAt < 180000L;
            boolean greetingTooSoon = now - lastGreetingAt < 12000L;
            if (sameRecentlyGreetedFace || greetingTooSoon) {
                runOnUiThread(() -> setHandsFreeStatus("Посетитель в кадре · продолжаю диалог"));
                return;
            }
            lastGreetingAt = now;
            lastGreetedPersonId = nearest.getId();
            int angle = Math.max(-55, Math.min(55, nearest.getAngle()));
            runOnUiThread(() -> {
                setHandsFreeStatus("Посетитель обнаружен");
                greetVisitor(angle);
            });
        } catch (Throwable error) {
            android.util.Log.w("KurultaiHandsFree", "PersonApi poll failed", error);
            runOnUiThread(() -> setHandsFreeStatus("PersonApi: " + error.getClass().getSimpleName()));
        }
    }

    private void setHandsFreeStatus(String text) {
        android.util.Log.i("KurultaiHandsFree", text);
        uiJs("window.onHandsFreeStatus && window.onHandsFreeStatus(" + JSONObject.quote(text) + ")");
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SharedPreferences assistantPrefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        automaticVoiceMode = "auto".equals(assistantPrefs.getString(PREF_AUDIO_MODE, "manual"));
        answerLanguageMode = assistantPrefs.getString(PREF_ANSWER_LANGUAGE, "auto");
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();

        webView = new WebView(this);
        webView.setBackgroundColor(0xfff3f6fa);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLongClickable(false);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                pushDeviceStatus();
                pushAiStatus("Готово");
                refreshQuryltaiData();
            }
        });
        webView.addJavascriptInterface(new RobotBridge(), "Robot");
        webView.loadUrl("file:///android_asset/index.html");
        speaker = createSpeaker();
        KurultaiApplication.get().setSpeechStateListener((robotState, ready) -> runOnUiThread(() -> {
            robotSpeechState = robotState;
            robotSpeechReady = ready;
            skillApi = KurultaiApplication.get().connectedSkillApi();
            if (ready && skillApi != null) {
                connectRobotSpeech();
                registerPersonDetection();
                if (webView != null) {
                    webView.removeCallbacks(personPollRunnable);
                    webView.post(personPollRunnable);
                }
            }
            else scheduleRobotReconnect();
            pushDeviceStatus();
        }));
        importEmbeddedDemoKeyOnce();
        refreshQuryltaiData();
        handleProvisioningIntent(getIntent());

        if (android.os.Build.VERSION.SDK_INT >= 23 &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7);
        }
    }

    private void connectRobotSpeech() {
        SkillApi applicationApi = KurultaiApplication.get().connectedSkillApi();
        if (applicationApi == null) {
            setRobotSpeechReady(false);
            return;
        }
        skillApi = applicationApi;
        setRobotSpeechReady(true);
        if (!announcedSpeechReady) {
            announcedSpeechReady = true;
            runOnUiThread(() -> webView.postDelayed(
                () -> speakAnswer("Голосовой помощник готов. Задайте вопрос.", listeningLanguage), 700));
        }
    }

    private void scheduleRobotReconnect() {
        if (webView == null || isFinishing()) return;
        webView.removeCallbacks(robotReconnectRunnable);
        webView.postDelayed(robotReconnectRunnable, 2500);
    }

    private final Runnable robotReconnectRunnable = () -> {
        if (!robotSpeechReady && !isFinishing()) {
            KurultaiApplication.get().reconnectRobot();
            scheduleRobotReconnect();
        }
    };

    private void setRobotSpeechReady(boolean ready) {
        robotSpeechReady = ready;
        pushDeviceStatus();
    }

    private void pushDeviceStatus() {
        if (webView == null) return;
        boolean online = isOnline();
        uiJs("window.onRobotStatus && window.onRobotStatus(" + online + "," + robotSpeechReady + "," +
            JSONObject.quote(robotSpeechState + " · v" + BuildConfig.VERSION_NAME) + ")");
    }

    private boolean isOnline() {
        try {
            ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo info = manager == null ? null : manager.getActiveNetworkInfo();
            return info != null && info.isConnected();
        } catch (Exception ignored) { return false; }
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override protected void onResume() {
        super.onResume();
        activityVisible = true;
        hideSystemUi();
        skillApi = KurultaiApplication.get().connectedSkillApi();
        robotSpeechReady = robotApiReady() && skillApi != null;
        if (!robotSpeechReady) KurultaiApplication.get().reconnectRobot();
        pushDeviceStatus();
        registerPersonDetection();
        if (webView != null) {
            webView.removeCallbacks(personPollRunnable);
            webView.post(personPollRunnable);
            webView.removeCallbacks(meetingCheckRunnable);
            webView.post(meetingCheckRunnable);
        }
    }

    @Override protected void onPause() {
        activityVisible = false;
        greetingMotionGeneration++;
        if (followingPerson) stopFollowingPerson(false, "ru");
        continuousListening = false;
        cancelAutomaticRecording();
        if (webView != null) {
            webView.removeCallbacks(personPollRunnable);
            webView.removeCallbacks(meetingCheckRunnable);
        }
        unregisterPersonDetection();
        pauseListeningInternal();
        stopRobotMotion();
        super.onPause();
    }

    private class RobotBridge {
        @JavascriptInterface public void startHoldRecording() {
            runOnUiThread(() -> startRawRecording());
        }

        @JavascriptInterface public void stopHoldRecording() {
            stopRawRecordingAndTranscribe();
        }

        @JavascriptInterface public void listen(String language) {
            runOnUiThread(() -> js("window.onVoiceError && window.onVoiceError('Нажмите «Спросить голосом», чтобы начать запись')"));
        }

        @JavascriptInterface public void setContinuousListening(boolean enabled, String language) {
            runOnUiThread(() -> {
                automaticVoiceMode = enabled;
                continuousListening = enabled && personPresent;
                listeningLanguage = language == null ? "ru" : language;
                getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .putString(PREF_AUDIO_MODE, enabled ? "auto" : "manual").apply();
                if (continuousListening) startAutomaticListening(); else pauseListeningInternal();
                js("window.onContinuousVoiceState && window.onContinuousVoiceState(" + enabled + ")");
            });
        }

        @JavascriptInterface public void saveAssistantPreferences(String audioMode, String answerLanguage) {
            runOnUiThread(() -> {
                automaticVoiceMode = "auto".equals(audioMode);
                answerLanguageMode = "ru".equals(answerLanguage) || "kk".equals(answerLanguage) ? answerLanguage : "auto";
                continuousListening = automaticVoiceMode && personPresent;
                getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .putString(PREF_AUDIO_MODE, automaticVoiceMode ? "auto" : "manual")
                    .putString(PREF_ANSWER_LANGUAGE, answerLanguageMode).apply();
                if (continuousListening) startAutomaticListening(); else pauseListeningInternal();
                uiJs("window.onAssistantPreferences && window.onAssistantPreferences(" + automaticVoiceMode + "," + JSONObject.quote(answerLanguageMode) + ")");
            });
        }

        @JavascriptInterface public void getAssistantPreferences() {
            uiJs("window.onAssistantPreferences && window.onAssistantPreferences(" + automaticVoiceMode + "," + JSONObject.quote(answerLanguageMode) + ")");
        }

        @JavascriptInterface public void pauseListening() {
            runOnUiThread(() -> pauseListeningInternal());
        }

        @JavascriptInterface public void resumeContinuousListening(String language) {
            runOnUiThread(() -> {
                listeningLanguage = language == null ? listeningLanguage : language;
                continuousListening = automaticVoiceMode && personPresent;
                if (continuousListening) scheduleNextListening(250L);
            });
        }

        @JavascriptInterface public void speak(String text, String language) {
            runOnUiThread(() -> speakAnswer(text, language));
        }

        @JavascriptInterface public void testLocalTts(String language) {
            runOnUiThread(() -> {
                KurultaiApplication.get().reconnectRobot();
                if (speaker == null) speaker = createSpeaker();
                uiJs("window.onLocalTtsStatus && window.onLocalTtsStatus(true," +
                    JSONObject.quote(robotSpeechState + "; " + speaker.diagnose()) + ")");
                String phrase = language != null && language.startsWith("kk")
                    ? "Дыбыс тексерілуде. Бір, екі, үш."
                    : "Проверка звука. Один, два, три.";
                speaker.speak(phrase, language, (robot, error) -> runOnUiThread(() -> {
                    String status = error == null ? "Голос RobotOS работает" : robotSpeechState + "; " + error + ". " + speaker.diagnose();
                    uiJs("window.onLocalTtsStatus && window.onLocalTtsStatus(" + (error == null) + "," + JSONObject.quote(status) + ")");
                }));
            });
        }

        @JavascriptInterface public void stopSpeaking() {
            runOnUiThread(() -> {
                if (speaker != null) speaker.stop();
                finishSpeakingCycle();
            });
        }

        @JavascriptInterface public void askBackend(String endpoint, String payload) {
            new Thread(() -> requestBackend(endpoint, payload)).start();
        }

        @JavascriptInterface public void askOpenAI(String payload) {
            new Thread(() -> requestOpenAI(payload)).start();
        }

        @JavascriptInterface public void getAiStatus() {
            pushAiStatus("Готово");
        }

        @JavascriptInterface public void saveLocalMeeting(String title, double whenValue, String language) {
            final long when = (long) whenValue;
            runOnUiThread(() -> {
                if (title == null || title.trim().isEmpty() || when <= System.currentTimeMillis()) {
                    uiJs("window.onLocalMeeting && window.onLocalMeeting('',0,'kk','Проверьте дату и название')");
                    return;
                }
                String safeLanguage = language != null && language.startsWith("ru") ? "ru" : "kk";
                getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .putString(PREF_MEETING_TITLE, title.trim())
                    .putLong(PREF_MEETING_TIME, when)
                    .putString(PREF_MEETING_LANGUAGE, safeLanguage)
                    .putLong(PREF_MEETING_REMINDED, 0L).apply();
                pushLocalMeeting("Напоминание сохранено: за один час");
                checkLocalMeetingReminder();
            });
        }

        @JavascriptInterface public void getLocalMeeting() {
            runOnUiThread(() -> pushLocalMeeting(""));
        }

        @JavascriptInterface public void saveApiKey(String apiKey) {
            new Thread(() -> {
                try {
                    String value = apiKey == null ? "" : apiKey.trim();
                    if (!value.startsWith("sk-") || value.length() < 20) {
                        pushAiStatus("Ключ имеет неверный формат");
                        return;
                    }
                    encryptAndStoreApiKey(value);
                    pushAiStatus("API-ключ сохранён в защищённом хранилище");
                } catch (Exception e) {
                    pushAiStatus("Не удалось сохранить ключ");
                }
            }).start();
        }

        @JavascriptInterface public void clearApiKey() {
            new Thread(() -> {
                clearStoredApiKey();
                pushAiStatus("API-ключ удалён");
            }).start();
        }

        @JavascriptInterface public void importApiKeyFromClipboard() {
            runOnUiThread(() -> {
                try {
                    ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    ClipData clip = clipboard == null ? null : clipboard.getPrimaryClip();
                    CharSequence value = clip == null || clip.getItemCount() == 0 ? null : clip.getItemAt(0).coerceToText(MainActivity.this);
                    String key = value == null ? "" : value.toString().trim();
                    if (!isValidApiKey(key)) {
                        pushAiStatus("В буфере нет корректного API-ключа");
                        return;
                    }
                    encryptAndStoreApiKey(key);
                    clipboard.setPrimaryClip(ClipData.newPlainText("", ""));
                    pushAiStatus("Ключ импортирован, буфер очищен");
                } catch (Exception e) {
                    pushAiStatus("Не удалось импортировать ключ из буфера");
                }
            });
        }

        @JavascriptInterface public void testBackend(String endpoint) {
            new Thread(() -> testBackendHealth(endpoint)).start();
        }

        @JavascriptInterface public void move(String direction) { runOnUiThread(() -> startRobotMotion(direction)); }
        @JavascriptInterface public void stopMove() { runOnUiThread(() -> stopRobotMotion()); }
        @JavascriptInterface public void navigateTo(String place) { runOnUiThread(() -> navigateRobotTo(place)); }
        @JavascriptInterface public void moveHead(int horizontal, int vertical) { runOnUiThread(() -> moveRobotHead(horizontal, vertical)); }
        @JavascriptInterface public void getRobotSystemStatus() { runOnUiThread(() -> pushRobotSystemStatus()); }
        @JavascriptInterface public void returnToCharge() { runOnUiThread(() -> returnRobotToCharge()); }
        @JavascriptInterface public void setWelcomeMode(boolean enabled) {
            welcomeMode = enabled;
            personPresent = false;
            uiJs("window.onWelcomeMode && window.onWelcomeMode(" + enabled + ")");
        }
    }

    private boolean robotApiReady() {
        try { return RobotApi.getInstance().isApiConnectedService(); } catch (Throwable ignored) { return false; }
    }

    private int nextRobotRequestId() { return ++robotRequestId; }

    private CommandListener motionListener(final String action) {
        return new CommandListener() {
            @Override public void onResult(int result, String message) {
                uiJs("window.onMotionStatus && window.onMotionStatus(" + JSONObject.quote(action + ": " + message) + ")");
            }
        };
    }

    private void startRobotMotion(String direction) {
        if (!robotApiReady()) { uiJs("window.onMotionError && window.onMotionError('RobotOS недоступен')"); return; }
        stopRobotMotion();
        try {
            int req = nextRobotRequestId();
            if ("forward".equals(direction)) RobotApi.getInstance().goForward(req, 0.15f, 0.25f, true, motionListener("Вперёд"));
            else if ("backward".equals(direction)) RobotApi.getInstance().goBackward(req, 0.10f, 0.18f, motionListener("Назад"));
            else if ("left".equals(direction)) RobotApi.getInstance().turnLeft(req, 20f, 15f, motionListener("Влево"));
            else if ("right".equals(direction)) RobotApi.getInstance().turnRight(req, 20f, 15f, motionListener("Вправо"));
            else return;
            uiJs("window.onMotionStatus && window.onMotionStatus('Команда передана RobotOS')");
        } catch (Throwable error) { uiJs("window.onMotionError && window.onMotionError('Движение недоступно')"); }
    }

    private void stopRobotMotion() {
        if (!robotApiReady()) return;
        try { RobotApi.getInstance().stopMove(nextRobotRequestId(), motionListener("Стоп")); } catch (Throwable ignored) { }
        try { RobotApi.getInstance().stopNavigation(nextRobotRequestId()); } catch (Throwable ignored) { }
    }

    private void navigateRobotTo(String placeName) {
        String destination = placeName == null ? "" : placeName.trim();
        if (destination.isEmpty()) { uiJs("window.onMotionError && window.onMotionError('Введите название точки карты')"); return; }
        if (!robotApiReady()) { uiJs("window.onMotionError && window.onMotionError('RobotOS недоступен')"); return; }
        try {
            RobotApi.getInstance().startNavigation(nextRobotRequestId(), destination, 0.35, 15000L, 0.20, 0.53, new ActionListener() {
                @Override public void onResult(int status, String response) { uiJs("window.onMotionStatus && window.onMotionStatus(" + JSONObject.quote("Навигация: " + response) + ")"); }
                @Override public void onError(int status, String message) { uiJs("window.onMotionError && window.onMotionError(" + JSONObject.quote("Навигация: " + message) + ")"); }
            });
            uiJs("window.onMotionStatus && window.onMotionStatus(" + JSONObject.quote("Еду к точке «" + destination + "»") + ")");
        } catch (Throwable error) { uiJs("window.onMotionError && window.onMotionError('Точка недоступна')"); }
    }

    private void moveRobotHead(int horizontal, int vertical) {
        if (!robotApiReady()) { uiJs("window.onMotionError && window.onMotionError('RobotOS недоступен')"); return; }
        try { RobotApi.getInstance().moveHead(nextRobotRequestId(), "absolute", "absolute", Math.max(-120, Math.min(120, horizontal)), Math.max(0, Math.min(90, vertical)), motionListener("Голова")); }
        catch (Throwable ignored) { uiJs("window.onMotionError && window.onMotionError('Привод головы недоступен')"); }
    }

    private void pushRobotSystemStatus() {
        if (!robotApiReady()) { uiJs("window.onRobotSystemStatus && window.onRobotSystemStatus(false,'—','—','—','RobotOS недоступен')"); return; }
        try {
            int battery = RobotApi.getInstance().getBatteryLevel();
            boolean charging = RobotApi.getInstance().getChargeStatus();
            String map = RobotApi.getInstance().getMapName();
            java.util.List<com.ainirobot.coreservice.client.actionbean.Pose> places = RobotApi.getInstance().getPlaceList();
            int placeCount = places == null ? 0 : places.size();
            uiJs("window.onRobotSystemStatus && window.onRobotSystemStatus(true," + battery + "," + charging + "," + JSONObject.quote(map == null ? "—" : map) + "," + JSONObject.quote(placeCount + " точек") + ")");
        } catch (Throwable error) { uiJs("window.onRobotSystemStatus && window.onRobotSystemStatus(false,'—','—','—','Статус недоступен')"); }
    }

    private void returnRobotToCharge() {
        if (!robotApiReady()) { uiJs("window.onMotionError && window.onMotionError('RobotOS недоступен')"); return; }
        stopRobotMotion();
        try {
            RobotApi.getInstance().startNaviToAutoChargeAction(nextRobotRequestId(), 120000L, new ActionListener() {
                @Override public void onStatusUpdate(int status, String data) { uiJs("window.onMotionStatus && window.onMotionStatus('Возврат на зарядку…')"); }
                @Override public void onResult(int status, String response) { uiJs("window.onMotionStatus && window.onMotionStatus(" + JSONObject.quote("Зарядка: " + response) + ")"); pushRobotSystemStatus(); }
                @Override public void onError(int status, String message) { uiJs("window.onMotionError && window.onMotionError(" + JSONObject.quote("Зарядка: " + message) + ")"); }
            });
        } catch (Throwable ignored) { uiJs("window.onMotionError && window.onMotionError('Автозарядка недоступна')"); }
    }

    private void registerPersonDetection() {
        if (!activityVisible || personListenerRegistered || !robotApiReady()) return;
        try {
            personListenerRegistered = PersonApi.getInstance().registerPersonListener(personListener);
            setHandsFreeStatus(personListenerRegistered ? "PersonApi готов" : "PersonApi listener не принят; включён опрос");
        } catch (Throwable error) {
            personListenerRegistered = false;
            setHandsFreeStatus("PersonApi listener: " + error.getClass().getSimpleName() + "; включён опрос");
        }
    }

    private void unregisterPersonDetection() {
        if (!personListenerRegistered) return;
        try { PersonApi.getInstance().unregisterPersonListener(personListener); } catch (Throwable ignored) { }
        personListenerRegistered = false;
        personPresent = false;
    }

    private void greetVisitor(int angle) {
        if (!activityVisible || speakingNow || holdRecording) return;
        playFriendlyGreetingMotion(angle);
        continuousListening = automaticVoiceMode;
        setHandsFreeStatus(automaticVoiceMode ? "Приветствую и затем включу микрофон" : "Приветствую · ручной режим микрофона");
        uiJs("window.goHome && window.goHome(); window.onVisitorDetected && window.onVisitorDetected()");
        String greeting = listeningLanguage != null && listeningLanguage.startsWith("ru")
            ? "Здравствуйте. Я ИИ-помощник депутата Ахмедиева Дархана Мейрамулы. Задайте ваш вопрос."
            : "Сәлеметсіз бе. Мен депутат Ахмедиев Дархан Мейрамұлының жасанды интеллект көмекшісімін. Сұрағыңызды қойыңыз.";
        speakAnswer(greeting, effectiveAnswerLanguage(listeningLanguage));
    }

    private void lookAtVisitor(int horizontal, int vertical) {
        if (!robotApiReady()) return;
        try {
            RobotApi.getInstance().moveHead(nextRobotRequestId(), "absolute", "absolute",
                Math.max(-55, Math.min(55, horizontal)), Math.max(22, Math.min(48, vertical)),
                motionListener("Взгляд на посетителя"));
        } catch (Throwable error) {
            android.util.Log.w("KurultaiHandsFree", "Head movement failed", error);
        }
    }

    private void alignBodyToFace(int angle) {
        if (!robotApiReady() || followingPerson || Math.abs(angle) < 24) return;
        long now = System.currentTimeMillis();
        if (now - lastBodyAlignAt < 3200L) return;
        lastBodyAlignAt = now;
        float degrees = Math.min(18f, Math.max(8f, Math.abs((float) angle) * 0.45f));
        try {
            if (angle < 0) RobotApi.getInstance().turnLeft(nextRobotRequestId(), degrees, 12f, motionListener("Выравнивание по лицу"));
            else RobotApi.getInstance().turnRight(nextRobotRequestId(), degrees, 12f, motionListener("Выравнивание по лицу"));
        } catch (Throwable error) {
            android.util.Log.w("KurultaiHandsFree", "Body alignment failed", error);
        }
    }

    private void playFriendlyGreetingMotion(int visitorAngle) {
        if (!robotApiReady() || webView == null) return;
        final int generation = ++greetingMotionGeneration;
        final int angle = Math.max(-45, Math.min(45, visitorAngle));
        lastFriendlyLookAt = System.currentTimeMillis();
        lookAtVisitor(angle, 34);
        uiJs("window.onGreetingMotion && window.onGreetingMotion(true)");

        // Only rotate in place; never drive toward a person. This keeps the
        // greeting expressive without reducing the safety distance.
        if (Math.abs(angle) >= 16) {
            float turnDegrees = Math.min(32f, Math.abs((float) angle));
            try {
                if (angle < 0) RobotApi.getInstance().turnLeft(nextRobotRequestId(), turnDegrees, 14f, motionListener("Поворот к посетителю"));
                else RobotApi.getInstance().turnRight(nextRobotRequestId(), turnDegrees, 14f, motionListener("Поворот к посетителю"));
            } catch (Throwable error) {
                android.util.Log.w("KurultaiHandsFree", "Greeting turn failed", error);
            }
        }
        webView.postDelayed(() -> { if (generation == greetingMotionGeneration) lookAtVisitor(0, 27); }, 1250L);
        webView.postDelayed(() -> { if (generation == greetingMotionGeneration) lookAtVisitor(0, 40); }, 1650L);
        webView.postDelayed(() -> { if (generation == greetingMotionGeneration) { lookAtVisitor(0, 34); uiJs("window.onGreetingMotion && window.onGreetingMotion(false)"); } }, 2100L);
    }

    private void startAutomaticListening() { startAutomaticListening(false); }

    private void startAutomaticListening(boolean allowWhileSpeaking) {
        if (!activityVisible || !continuousListening || !personPresent || (!allowWhileSpeaking && speakingNow) || holdRecording) return;
        if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        voiceTurnId++;
        automaticRecording = true;
        automaticSpeechDetected = false;
        automaticStartedAt = System.currentTimeMillis();
        automaticLastVoiceAt = automaticStartedAt;
        automaticLoudSince = 0L;
        setHandsFreeStatus("Микрофон слушает");
        try {
            wavRecorder.start(level -> {
                long now = System.currentTimeMillis();
                int threshold = speakingNow ? 12 : 3;
                if (level >= threshold) {
                    if (automaticLoudSince == 0L) automaticLoudSince = now;
                    if (now - automaticLoudSince >= 280L) {
                        if (!automaticSpeechDetected) {
                            if (speakingNow) {
                                if (speaker != null) speaker.stop();
                                speakingNow = false;
                                uiJs("window.onSpeechFinished && window.onSpeechFinished(); window.onHandsFreeStatus && window.onHandsFreeStatus('Слушаю вас')");
                            } else uiJs("window.onHandsFreeStatus && window.onHandsFreeStatus('Голос обнаружен')");
                        }
                        automaticSpeechDetected = true;
                        automaticLastVoiceAt = now;
                    }
                } else {
                    automaticLoudSince = 0L;
                }
                uiJs("window.onVoiceVolume && window.onVoiceVolume(" + level + ")");
            });
            holdRecording = true;
            js("window.onRawRecordingStarted && window.onRawRecordingStarted()");
            webView.removeCallbacks(automaticListenTimeout);
            webView.postDelayed(automaticListenTimeout, 180L);
        } catch (Throwable error) {
            automaticRecording = false;
            holdRecording = false;
            try { wavRecorder.cancel(); } catch (Throwable ignored) { }
        }
    }

    private void cancelAutomaticRecording() {
        if (!automaticRecording) return;
        automaticRecording = false;
        holdRecording = false;
        if (webView != null) webView.removeCallbacks(automaticListenTimeout);
        try { wavRecorder.cancel(); } catch (Throwable ignored) { }
        js("window.onVoicePaused && window.onVoicePaused()");
    }

    private void startRawRecording() {
        if (holdRecording) return;
        if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7);
            js("window.onVoiceServiceError && window.onVoiceServiceError('Разрешите доступ к микрофону и нажмите кнопку снова')");
            return;
        }
        // Hubl-style barge-in: a new hold immediately cancels the previous spoken answer.
        voiceTurnId++;
        automaticRecording = false;
        if (webView != null) webView.removeCallbacks(automaticListenTimeout);
        if (speaker != null) speaker.stop();
        speakingNow = false;
        pauseListeningInternal();
        try {
            wavRecorder.start(level -> uiJs("window.onVoiceVolume && window.onVoiceVolume(" + level + ")"));
            holdRecording = true;
            js("window.onRawRecordingStarted && window.onRawRecordingStarted()");
        } catch (Throwable e) {
            holdRecording = false;
            wavRecorder.cancel();
            js("window.onVoiceServiceError && window.onVoiceServiceError(" + JSONObject.quote("Микрофон робота недоступен: " + e.getMessage()) + ")");
        }
    }

    private void stopRawRecordingAndTranscribe() {
        if (!holdRecording) return;
        holdRecording = false;
        automaticRecording = false;
        if (webView != null) webView.removeCallbacks(automaticListenTimeout);
        final int turnId = voiceTurnId;
        final byte[] wav = wavRecorder.stop();
        // Hubl threshold: reject an accidental tap shorter than roughly half a second.
        if (wav.length < 44 + 16_000) {
            uiJs("window.onVoiceError && window.onVoiceError('Запись слишком короткая — нажмите «Спросить голосом» и задайте вопрос')");
            return;
        }
        uiJs("window.onRawRecordingStopped && window.onRawRecordingStopped()");
        voiceExecutor.execute(() -> {
            if (turnId == voiceTurnId) transcribeAudio(wav, turnId);
        });
    }

    private void transcribeAudio(byte[] wav, int turnId) {
        uiJs("window.onHandsFreeStatus && window.onHandsFreeStatus('Отправляю голос на распознавание')");
        if (!isOnline()) { backendResult(false, "Нет Wi-Fi для распознавания аудио"); return; }
        String apiKey;
        try { apiKey = readStoredApiKey(); } catch (Exception e) { backendResult(false, "API-ключ недоступен"); return; }
        HttpURLConnection connection = null;
        try {
            String boundary = "----KurultaiAudio" + System.currentTimeMillis();
            connection = (HttpURLConnection)new URL(OPENAI_TRANSCRIBE_URL).openConnection();
            connection.setRequestMethod("POST"); connection.setConnectTimeout(15000); connection.setReadTimeout(90000); connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + apiKey);
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            try (OutputStream out = connection.getOutputStream()) {
                multipartText(out, boundary, "model", "gpt-4o-transcribe");
                multipartText(out, boundary, "prompt", "Қазақша немесе орысша сөз. Казахстан, Қазақстан, Курултай, Құрылтай, цифровизация, цифрландыру, инновации, инновациялар, наука, ғылым, депутат Дархан Ахмедиев.");
                out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"speech.wav\"\r\nContent-Type: audio/wav\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                out.write(wav); out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            }
            int code = connection.getResponseCode(); String body = readBody(connection, code);
            if (code >= 200 && code < 300) {
                String transcript = new JSONObject(body).optString("text", "").trim();
                if (turnId != voiceTurnId) return;
                if (transcript.isEmpty()) ignoreUnclearSpeech();
                else if (!handleNativeVoiceCommand(transcript)) {
                    if (shouldAnswerSpeech(transcript)) {
                        uiJs("window.onVoiceResult && window.onVoiceResult(" + JSONObject.quote(transcript) + ")");
                    } else ignoreUnclearSpeech();
                }
            } else backendResult(false, friendlyOpenAIError(code, body));
        } catch (Exception e) { backendResult(false, "Ошибка распознавания: " + e.getMessage()); }
        finally { if (connection != null) connection.disconnect(); }
    }

    private boolean handleNativeVoiceCommand(String transcript) {
        String normalized = transcript.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\s]", " ").replaceAll("\\s+", " ").trim();
        int words = normalized.isEmpty() ? 0 : normalized.split(" ").length;
        boolean follow = words <= 6 && (normalized.equals("пошли") || normalized.equals("пошли со мной") ||
            normalized.contains("иди за мной") || normalized.contains("следуй за мной") ||
            normalized.equals("жүр") || normalized.contains("артымнан жүр") || normalized.contains("менімен жүр"));
        boolean stop = words <= 5 && (normalized.equals("стой") || normalized.equals("стоп") || normalized.contains("остановись") ||
            normalized.equals("тоқта") || normalized.equals("тоқташы") || normalized.contains("жүрме"));
        if (!follow && !stop) return false;
        runOnUiThread(() -> {
            if (follow) startFollowingPerson(normalized.contains("жүр") ? "kk" : "ru");
            else stopFollowingPerson(true, normalized.contains("тоқ") || normalized.contains("жүрме") ? "kk" : "ru");
        });
        return true;
    }

    private static boolean isLatestNewsQuestion(String message) {
        String m = message == null ? "" : message.toLowerCase(Locale.ROOT);
        String[] keys = {"последн", "новост", "недавн", "актуальн", "сегодня", "на этой неделе", "повестк", "обсужда", "соңғы", "жаңалық", "бүгін", "өзекті", "күн тәртіб", "талқыла"};
        for (String k : keys) if (m.contains(k)) return true;
        return false;
    }

    private boolean shouldAnswerSpeech(String transcript) {
        String normalized = transcript == null ? "" : transcript.toLowerCase(Locale.ROOT)
            .replaceAll("[^\\p{L}\\p{N}?\\s]", " ").replaceAll("\\s+", " ").trim();
        if (normalized.length() < 2) return false;
        String[] words = normalized.split(" ");
        String greetings = "привет здравствуйте добрый день доброе утро добрый вечер салем сәлем сәлеметсіз ассалаумағалейкум";
        if (greetings.contains(normalized) && words.length <= 3) return true;
        String questionWords = "кто что где когда как какой какая какие почему зачем сколько расскажи объясни подготовь " +
            "кім не қайда қашан қалай қандай неге неліктен қанша айтшы түсіндір дайында";
        for (String word : words) if (questionWords.contains(" " + word + " ") || questionWords.startsWith(word + " ")) return true;
        String topicWords = "курултай құрылтай депутат комитет закон законопроект цифровизац инновац наук кибер заседан мероприя " +
            "парламент мәжіліс сенат пленар сесси новост жаңалық последн соңғы повестк председател төраға спикер депутаттар " +
            "заң жоба цифрлан ғылым отырыс іс шара время уақыт принеси принес сгоняй вода воду бумага қағаз су әкел";
        for (String word : words) {
            for (String topic : topicWords.split(" ")) if (word.startsWith(topic)) return true;
        }
        return normalized.endsWith("?");
    }

    private void ignoreUnclearSpeech() {
        String language = effectiveAnswerLanguage(listeningLanguage);
        String phrase = language.startsWith("kk") ? "Сұрағыңызды қайталаңыз." : "Повторите ваш вопрос.";
        uiJs("window.onVoiceIgnored && window.onVoiceIgnored(" + JSONObject.quote(phrase) + ")");
        runOnUiThread(() -> speakAnswer(phrase, language));
    }

    private String effectiveAnswerLanguage(String detected) {
        if ("ru".equals(answerLanguageMode)) return "ru";
        if ("kk".equals(answerLanguageMode)) return "kk";
        return detected != null && detected.startsWith("kk") ? "kk" : "ru";
    }

    private void refreshQuryltaiData() {
        QuryltaiDataSync.refreshIfNeeded(this, new QuryltaiDataSync.Listener() {
            @Override public void onData(JSONObject data, boolean fresh) {
                uiJs("window.onQuryltaiData && window.onQuryltaiData(" + data.toString() + "," + fresh + ")");
            }
            @Override public void onError(String message) {
                android.util.Log.w("QuryltaiSync", message);
            }
        });
    }

    private void startFollowingPerson(String language) { startFollowingPerson(language, 0); }

    private void startFollowingPerson(String language, int attempt) {
        int followPersonId = findFollowTargetId();
        if (!robotApiReady()) {
            speakAnswer(language.startsWith("kk") ? "RobotOS қолжетімсіз." : "RobotOS недоступен.", language);
            return;
        }
        if (followPersonId < 0 && attempt < 10 && webView != null) {
            setHandsFreeStatus(language.startsWith("kk") ? "Бетіңізді толық көруді күтіп тұрмын" : "Смотрю на лицо · стойте перед камерой");
            webView.postDelayed(() -> startFollowingPerson(language, attempt + 1), 450L);
            return;
        }
        if (followPersonId < 0) {
            speakAnswer(language.startsWith("kk") ? "Алдымен менің алдыма тұрыңыз." : "Сначала встаньте передо мной.", language);
            return;
        }
        if (followingPerson) {
            speakAnswer(language.startsWith("kk") ? "Мен сіздің артыңыздан келе жатырмын." : "Я уже следую за вами.", language);
            return;
        }
        followingPerson = true;
        continuousListening = true;
        greetingMotionGeneration++;
        if (webView != null) uiJs("window.onGreetingMotion && window.onGreetingMotion(false)");
        final int requestId = nextRobotRequestId();
        ActionListener listener = new ActionListener() {
            @Override public void onStatusUpdate(int status, String data) {
                android.util.Log.i("KurultaiFollow", "status=" + status + " data=" + data);
                String state;
                if (status == 1013 || status == 1028) state = "Цель захвачена · следую за вами";
                else if (status == 1008) state = "Вы слишком близко · отойдите на один метр";
                else if (status == 1023) state = "Препятствие · жду свободный путь";
                else if (status == 1032) state = "Повторно захватываю цель";
                else state = "Следую за вами · status " + status;
                uiJs("window.onHandsFreeStatus && window.onHandsFreeStatus(" + JSONObject.quote(state) + ")");
            }
            @Override public void onResult(int status, String response) {
                android.util.Log.i("KurultaiFollow", "result=" + status + " response=" + response);
                uiJs("window.onHandsFreeStatus && window.onHandsFreeStatus(" + JSONObject.quote("Следование · result " + status) + ")");
            }
            @Override public void onError(int status, String message) {
                followingPerson = false;
                android.util.Log.e("KurultaiFollow", "error=" + status + " message=" + message);
                if (status == -117 && attempt < 10 && webView != null && personPresent) {
                    uiJs("window.onHandsFreeStatus && window.onHandsFreeStatus('Цель не захвачена · повторяю')");
                    webView.postDelayed(() -> startFollowingPerson(language, attempt + 1), 600L);
                    return;
                }
                uiJs("window.onHandsFreeStatus && window.onHandsFreeStatus(" + JSONObject.quote("Не удалось начать следование: " + message) + ")");
            }
        };
        try {
            // Exact API used by OrionStar RobotSample/BodyFollowFragment.
            int result = RobotApi.getInstance().startBodyFollowAction(requestId, followPersonId, listener);
            android.util.Log.i("KurultaiFollow", "startBodyFollowAction returned=" + result + " personId=" + followPersonId);
            if (result < 0) {
                followingPerson = false;
                speakAnswer(language.startsWith("kk") ? "Сізді бақылай алмадым. Алдыма тұрып, қайта айтыңыз." : "Не вижу вас для следования. Встаньте передо мной и повторите.", language);
                return;
            }
            setHandsFreeStatus(language.startsWith("kk") ? "Сіздің артыңыздан жүремін" : "Иду за вами");
            speakAnswer(language.startsWith("kk") ? "Жақсы, сіздің артыңыздан жүремін." : "Хорошо, иду за вами.", language);
        } catch (Throwable error) {
            followingPerson = false;
            speakAnswer(language.startsWith("kk") ? "Ілесу режимі қолжетімсіз." : "Режим следования недоступен.", language);
        }
    }

    private int findFollowTargetId() {
        try {
            // RobotSample defaults to a complete face. Generic person/body IDs can
            // be visible to PersonApi but rejected by Vision Tracker (-117).
            Person best = nearestValidPerson(PersonApi.getInstance().getCompleteFaceList());
            if (best != null && best.getId() >= 0) {
                activePersonId = best.getId();
                return activePersonId;
            }
        } catch (Throwable error) {
            android.util.Log.e("KurultaiFollow", "Cannot resolve follow target", error);
        }
        return -1;
    }

    private Person nearestValidPerson(java.util.List<Person> people) {
        if (people == null) return null;
        Person best = null;
        for (Person person : people) {
            if (person == null || person.getId() < 0 || person.getDistance() < 0 || person.getDistance() > 3.5) continue;
            if (best == null || person.getDistance() < best.getDistance()) best = person;
        }
        return best;
    }

    private void stopFollowingPerson(boolean announce, String language) {
        followingPerson = false;
        try { RobotApi.getInstance().stopBodyFollowAction(nextRobotRequestId()); } catch (Throwable ignored) { }
        stopRobotMotion();
        setHandsFreeStatus(language.startsWith("kk") ? "Тоқтадым" : "Остановился");
        if (announce) speakAnswer(language.startsWith("kk") ? "Тоқтадым." : "Остановился.", language);
    }

    private void multipartText(OutputStream out, String boundary, String name, String value) throws Exception {
        out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    private void startListeningInternal(String language, boolean allowAndroidFallback) {
        listeningLanguage = language == null ? "ru" : language;
        startAutomaticListening();
    }

    private void pauseListeningInternal() {
        js("window.onVoicePaused && window.onVoicePaused()");
    }

    private void scheduleNextListening(long delayMs) {
        if (!continuousListening || speakingNow || webView == null || isFinishing()) return;
        webView.postDelayed(() -> {
            if (continuousListening && !speakingNow) startAutomaticListening();
        }, delayMs);
    }

    private void checkLocalMeetingReminder() {
        SharedPreferences preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        long meetingAt = preferences.getLong(PREF_MEETING_TIME, 0L);
        long remindedAt = preferences.getLong(PREF_MEETING_REMINDED, 0L);
        long now = System.currentTimeMillis();
        if (meetingAt <= now || now < meetingAt - 3600000L || remindedAt == meetingAt || speakingNow || holdRecording) return;
        String title = preferences.getString(PREF_MEETING_TITLE, "заседание");
        String language = preferences.getString(PREF_MEETING_LANGUAGE, "kk");
        preferences.edit().putLong(PREF_MEETING_REMINDED, meetingAt).apply();
        String text = language.startsWith("ru")
            ? "Напоминание. Через один час начнётся: " + title + "."
            : "Еске салу. Бір сағаттан кейін " + title + " басталады.";
        speakAnswer(text, language);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleProvisioningIntent(intent);
    }

    private void handleProvisioningIntent(Intent intent) {
        if (intent == null) return;
        final String apiKey = intent.getStringExtra("openai_api_key");
        intent.removeExtra("openai_api_key");
        if (!isValidApiKey(apiKey)) return;
        runOnUiThread(() -> new AlertDialog.Builder(MainActivity.this)
            .setTitle("Импорт ключа OpenAI")
            .setMessage("Получен новый API-ключ через USB. Сохранить его в защищённом хранилище этого робота?")
            .setNegativeButton("Отмена", null)
            .setPositiveButton("Сохранить", (dialog, which) -> new Thread(() -> {
                try {
                    encryptAndStoreApiKey(apiKey);
                    pushAiStatus("API-ключ сохранён через USB");
                } catch (Exception e) {
                    pushAiStatus("Не удалось сохранить API-ключ");
                }
            }).start())
            .show());
    }

    private boolean isValidApiKey(String value) {
        return value != null && value.startsWith("sk-") && value.length() >= 20;
    }

    private void importEmbeddedDemoKeyOnce() {
        if (hasStoredApiKey() || !isValidApiKey(BuildConfig.EMBEDDED_OPENAI_KEY)) return;
        try {
            encryptAndStoreApiKey(BuildConfig.EMBEDDED_OPENAI_KEY);
        } catch (Exception ignored) { }
    }

    private void speakAnswer(String text, String language) {
        if (text == null || text.trim().isEmpty()) return;
        String spokenText = text.replaceFirst("(?s)\\n\\nИсточники:.*$", "").replaceAll("https?://\\S+", "")
            .replaceFirst("(?iu)^\\s*(вывод|қорытынды|ответ|жауап|gpt)\\s*[:：-]\\s*", "").trim();
        pauseListeningInternal();
        speakingNow = true;
        js("window.onSpeechStarted && window.onSpeechStarted()");
        if (speaker == null) speaker = createSpeaker();
        speaker.speak(spokenText, language, (usedRobotTts, error) -> runOnUiThread(() -> {
            if (error != null) {
                String diagnostic = robotSpeechState + "; " + error + ". " + speaker.diagnose();
                uiJs("window.onLocalTtsStatus && window.onLocalTtsStatus(false," + JSONObject.quote(diagnostic) + ")");
                finishSpeakingCycle();
            } else finishSpeakingCycle();
        }));
        // Native-assistant barge-in: start an echo-cancelled microphone shortly
        // after playback begins, so a visitor can interrupt a long answer.
        if (continuousListening && personPresent && webView != null) {
            webView.postDelayed(() -> startAutomaticListening(true), 650L);
        }
    }

    private Speaker createSpeaker() {
        return new Speaker(this, () -> {
            try {
                SkillApi current = skillApi;
                if (current != null && current.isApiConnectedService()) return current;
            } catch (Throwable ignored) { }
            return KurultaiApplication.get().connectedSkillApi();
        });
    }

    private void finishSpeakingCycle() {
        speakingNow = false;
        js("window.onSpeechFinished && window.onSpeechFinished()");
        if (automaticRecording) {
            automaticStartedAt = System.currentTimeMillis();
            setHandsFreeStatus("Слушаю вас");
        } else if (continuousListening) scheduleNextListening(500);
    }

    private void requestOpenAI(String payload) {
        if (!isOnline()) {
            backendResult(false, "Нет подключения к Wi-Fi. Проверьте сеть робота и повторите запрос.");
            return;
        }
        String apiKey;
        try {
            apiKey = readStoredApiKey();
        } catch (Exception e) {
            backendResult(false, "Не удалось прочитать защищённый API-ключ. Сохраните его заново в настройках.");
            return;
        }
        if (apiKey == null || apiKey.isEmpty()) {
            backendResult(false, "API-ключ OpenAI не настроен. Откройте настройки и сохраните ключ.");
            return;
        }

        HttpURLConnection connection = null;
        try {
            JSONObject input = new JSONObject(payload);
            String message = input.optString("message", "").trim();
            String language = input.optString("language", "ru");
            String requestedAnswerLanguage = input.optString("answer_language", answerLanguageMode);
            String outputLanguage = "ru".equals(requestedAnswerLanguage) || "kk".equals(requestedAnswerLanguage)
                ? requestedAnswerLanguage : effectiveAnswerLanguage(language);
            if (message.isEmpty()) {
                backendResult(false, "Пустой вопрос");
                return;
            }

            JSONObject request = new JSONObject();
            request.put("model", OPENAI_MODEL);
            SimpleDateFormat clock = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss EEEE", new Locale("ru", "RU"));
            clock.setTimeZone(TimeZone.getTimeZone("Asia/Almaty"));
            String currentMoment = clock.format(new Date());
            request.put("instructions", ASSISTANT_INSTRUCTIONS + " Текущие дата и время в Астане: " + currentMoment + ". Отвечай на языке: " + outputLanguage + ".");
            boolean contextualFollowUp = isContextualFollowUp(message, previousUserQuestion);
            String conversationInput = "[Язык вопроса: " + language + "; язык ответа: " + outputLanguage + "]\n";
            if (contextualFollowUp && !previousAssistantAnswer.isEmpty()) {
                conversationInput += "Это уточнение к одному предыдущему обмену. Предыдущий вопрос: " + previousUserQuestion +
                    "\nПредыдущий ответ: " + previousAssistantAnswer + "\nСвяжи новый вопрос только с этим предыдущим вопросом.\n";
            }
            conversationInput += "Новый вопрос: " + message;
            conversationInput += QuryltaiDataSync.promptContext(this);
            if (isScheduleQuestion(message) || (contextualFollowUp && isScheduleQuestion(previousUserQuestion))) {
                String planUrl = QuryltaiDataSync.currentWeeklyPlanUrl(this);
                if (!planUrl.isEmpty()) {
                    JSONArray content = new JSONArray()
                        .put(new JSONObject().put("type", "input_text").put("text", conversationInput))
                        .put(new JSONObject().put("type", "input_file").put("file_url", planUrl).put("detail", "auto"));
                    request.put("input", new JSONArray().put(new JSONObject().put("role", "user").put("content", content)));
                } else request.put("input", conversationInput);
            } else request.put("input", conversationInput);
            request.put("max_output_tokens", 600);
            request.put("store", false);
            request.put("reasoning", new JSONObject().put("effort", "none"));
            JSONArray tools = new JSONArray();
            JSONArray officialDomains = new JSONArray();
            officialDomains.put("gov.kz");
            officialDomains.put("akorda.kz");
            officialDomains.put("parlam.kz");
            officialDomains.put("adilet.zan.kz");
            officialDomains.put("stat.gov.kz");
            officialDomains.put("egov.kz");
            officialDomains.put("primeminister.kz");
            officialDomains.put("nationalbank.kz");
            officialDomains.put("quryltai.kz");
            JSONObject searchFilters = new JSONObject().put("allowed_domains", officialDomains);
            tools.put(new JSONObject()
                .put("type", "web_search")
                .put("search_context_size", isLatestNewsQuestion(message) ? "medium" : "low")
                .put("filters", searchFilters));
            request.put("tools", tools);
            request.put("tool_choice", "auto");

            connection = (HttpURLConnection) new URL(OPENAI_URL).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(90000);
            connection.setRequestProperty("Authorization", "Bearer " + apiKey);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("X-Client-Request-Id", UUID.randomUUID().toString());
            connection.setDoOutput(true);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(request.toString().getBytes(StandardCharsets.UTF_8));
            }

            int code = connection.getResponseCode();
            String body = readBody(connection, code);
            if (code >= 200 && code < 300) {
                JSONObject response = new JSONObject(body);
                String answer = extractOpenAIText(response);
                if (answer.isEmpty()) backendResult(false, "Модель не вернула текстовый ответ");
                else if ("[REPEAT]".equalsIgnoreCase(answer) || "REPEAT".equalsIgnoreCase(answer) ||
                    "[SILENCE]".equalsIgnoreCase(answer) || "SILENCE".equalsIgnoreCase(answer)) {
                    ignoreUnclearSpeech();
                } else {
                    previousUserQuestion = message;
                    previousAssistantAnswer = answer;
                    backendResult(true, new JSONObject().put("answer", answer).put("language", outputLanguage)
                        .put("model", response.optString("model", OPENAI_MODEL)).toString());
                }
            } else {
                backendResult(false, friendlyOpenAIError(code, body));
            }
        } catch (Exception e) {
            backendResult(false, "Не удалось связаться с OpenAI: " + e.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private boolean isScheduleQuestion(String message) {
        String text = message == null ? "" : message.toLowerCase(Locale.ROOT);
        return text.contains("сегодня") || text.contains("завтра") || text.contains("недел") ||
            text.contains("мероприят") || text.contains("запланир") || text.contains("план") ||
            text.contains("заседан") || text.contains("курултае") || text.contains("курултай") ||
            text.contains("бүгін") || text.contains("ертең") || text.contains("апта") ||
            text.contains("іс-шара") || text.contains("іс шара") || text.contains("жоспар") || text.contains("отырыс");
    }

    private boolean isContextualFollowUp(String current, String previous) {
        if (current == null || previous == null || previous.trim().isEmpty()) return false;
        String now = current.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}\\s]", " ").replaceAll("\\s+", " ").trim();
        String before = previous.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}\\s]", " ").replaceAll("\\s+", " ").trim();
        if (now.isEmpty()) return false;
        int words = now.split(" ").length;
        boolean dateOrShortClarification = words <= 6 && (now.matches(".*\\b\\d{1,2}([./-]\\d{1,2})?\\b.*") ||
            now.matches(".*\\b(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр).*" ) ||
            now.matches(".*\\b(қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан).*" ) ||
            now.startsWith("а ") || now.startsWith("а если ") || now.startsWith("тогда ") || now.startsWith("а что ") ||
            now.startsWith("ал ") || now.startsWith("онда ") || now.contains("об этом") || now.contains("осы туралы"));
        if (dateOrShortClarification) return true;
        String[] topics = {"курултай","құрылтай","комитет","заседан","мероприят","план","закон","цифр","инновац","наук","отырыс","жоспар","заң","ғылым"};
        for (String topic : topics) if (now.contains(topic) && before.contains(topic)) return true;
        return false;
    }

    private String extractOpenAIText(JSONObject response) {
        String direct = response.optString("output_text", "").trim();
        StringBuilder result = new StringBuilder();
        if (!direct.isEmpty()) result.append(direct);
        boolean collectPartText = direct.isEmpty();
        JSONArray output = response.optJSONArray("output");
        if (output == null) return cleanAnswerText(result.toString());
        for (int i = 0; i < output.length(); i++) {
            JSONObject item = output.optJSONObject(i);
            JSONArray content = item == null ? null : item.optJSONArray("content");
            if (content == null) continue;
            for (int j = 0; j < content.length(); j++) {
                JSONObject part = content.optJSONObject(j);
                if (part == null) continue;
                String type = part.optString("type");
                String text = part.optString("text", "").trim();
                if (collectPartText && ("output_text".equals(type) || "text".equals(type)) && !text.isEmpty()) {
                    if (result.length() > 0) result.append('\n');
                    result.append(text);
                }
            }
        }
        return cleanAnswerText(result.toString());
    }

    private String cleanAnswerText(String text) {
        if (text == null) return "";
        String cleaned = text
            .replaceAll("(?iu)я\\s*(?:—|-)??\\s*(?:chatgpt|gpt|чатгпт)", "Я ИИ-помощник")
            .replaceAll("(?iu)мен\\s*(?:—|-)??\\s*(?:chatgpt|gpt|чатгпт)", "Мен жасанды интеллект көмекшісімін")
            .replaceAll("(?iu)i\\s+am\\s+(?:chatgpt|gpt)", "I am an AI assistant")
            .replaceAll("\\[[^\\]]+\\]\\(https?://[^)]+\\)", "")
            .replaceAll("(?i)https?://\\S+", "")
            .replaceAll("【[^\u3011]+】", "")
            .replaceAll("(?m)^\\s*(Источники?|Ссылки|Sources|References)\\s*:.*$", "")
            .replaceAll("(?m)^\\s*[-*]?\\s*\\[[0-9]+\\]\\s*.*$", "")
            .replace("**", "")
            .replace("__", "")
            .replace("`", "")
            .replaceAll("(?m)^\\s*#{1,6}\\s*", "")
            .replaceAll("(?m)^\\s*[-*+]\\s+", "• ")
            .replaceAll("[ \\t]+\\n", "\n")
            .replaceAll("\\n{3,}", "\n\n")
            .trim();
        return finishAtCompleteThought(cleaned);
    }

    /** Prevents a token-limit fragment from becoming the visible/spoken ending. */
    private String finishAtCompleteThought(String text) {
        if (text.isEmpty()) return text;
        char last = text.charAt(text.length() - 1);
        if (last == '.' || last == '!' || last == '?' || last == ':' || last == ';') return text;
        int period = Math.max(text.lastIndexOf('.'), Math.max(text.lastIndexOf('!'), text.lastIndexOf('?')));
        if (period >= Math.max(20, text.length() / 2)) return text.substring(0, period + 1).trim();
        return text + ".";
    }

    private String friendlyOpenAIError(int code, String body) {
        String message = "";
        try {
            JSONObject root = new JSONObject(body);
            JSONObject error = root.optJSONObject("error");
            if (error != null) message = error.optString("message", "");
        } catch (Exception ignored) { }
        if (code == 401) return "API-ключ OpenAI недействителен. Проверьте ключ в настройках.";
        if (code == 429) return "Лимит OpenAI исчерпан или API-billing не активирован. Проверьте баланс платформы API.";
        if (code >= 500) return "Сервис OpenAI временно недоступен. Повторите запрос позже.";
        return message.isEmpty() ? "OpenAI вернул ошибку " + code : "OpenAI: " + message;
    }

    private void encryptAndStoreApiKey(String apiKey) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
            generator.generateKey();
        }
        SecretKey key = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] encrypted = cipher.doFinal(apiKey.getBytes(StandardCharsets.UTF_8));
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString(PREF_CIPHER, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(PREF_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .apply();
    }

    private String readStoredApiKey() throws Exception {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String encoded = prefs.getString(PREF_CIPHER, "");
        String encodedIv = prefs.getString(PREF_IV, "");
        if (encoded.isEmpty() || encodedIv.isEmpty()) return "";
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        SecretKey key = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (key == null) return "";
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encoded, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private boolean hasStoredApiKey() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        return !prefs.getString(PREF_CIPHER, "").isEmpty() && !prefs.getString(PREF_IV, "").isEmpty();
    }

    private void clearStoredApiKey() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove(PREF_CIPHER).remove(PREF_IV).apply();
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) { }
    }

    private void pushAiStatus(String message) {
        uiJs("window.onAiStatus && window.onAiStatus(" + hasStoredApiKey() + "," + JSONObject.quote(OPENAI_MODEL) + "," + JSONObject.quote(message) + ")");
    }

    private void pushLocalMeeting(String status) {
        SharedPreferences preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        String title = preferences.getString(PREF_MEETING_TITLE, "");
        long when = preferences.getLong(PREF_MEETING_TIME, 0L);
        String language = preferences.getString(PREF_MEETING_LANGUAGE, "kk");
        uiJs("window.onLocalMeeting && window.onLocalMeeting(" + JSONObject.quote(title) + "," + when + "," +
            JSONObject.quote(language) + "," + JSONObject.quote(status) + ")");
    }

    private void requestBackend(String endpoint, String payload) {
        if (!isOnline()) {
            backendResult(false, "Нет подключения к Wi-Fi. Проверьте сеть робота и повторите запрос.");
            return;
        }
        Exception lastError = null;
        for (int attempt = 1; attempt <= 2; attempt++) {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(endpoint);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(60000);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("X-Device-Platform", "orionstar-os-r-sg04");
                connection.setRequestProperty("X-Request-Id", UUID.randomUUID().toString());
                connection.setDoOutput(true);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(payload.getBytes(StandardCharsets.UTF_8));
                }
                int code = connection.getResponseCode();
                String body = readBody(connection, code);
                if (code >= 200 && code < 300) {
                    backendResult(true, body);
                    return;
                }
                if (code < 500 || attempt == 2) {
                    backendResult(false, friendlyServerError(code, body));
                    return;
                }
            } catch (Exception e) {
                lastError = e;
            } finally {
                if (connection != null) connection.disconnect();
            }
            try { Thread.sleep(700); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        }
        String detail = lastError == null ? "сервер не отвечает" : lastError.getMessage();
        backendResult(false, "Не удалось связаться с AI-сервером: " + detail + ". Проверьте Wi-Fi и адрес сервера.");
    }

    private void testBackendHealth(String endpoint) {
        if (!isOnline()) {
            backendTestResult(false, "Wi-Fi не подключён");
            return;
        }
        HttpURLConnection connection = null;
        try {
            URL assistantUrl = new URL(endpoint);
            String path = assistantUrl.getPath();
            String healthPath = path.endsWith("/assistant") ? path.substring(0, path.length() - 10) + "/health" : "/health";
            URL healthUrl = new URL(assistantUrl.getProtocol(), assistantUrl.getHost(), assistantUrl.getPort(), healthPath);
            connection = (HttpURLConnection) healthUrl.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            int code = connection.getResponseCode();
            backendTestResult(code >= 200 && code < 300, code >= 200 && code < 300 ? "AI-сервер доступен" : "Сервер вернул код " + code);
        } catch (Exception e) {
            backendTestResult(false, "Нет связи: " + e.getMessage());
        } finally { if (connection != null) connection.disconnect(); }
    }

    private String readBody(HttpURLConnection connection, int code) throws Exception {
        InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
        if (stream == null) return "";
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        }
        return body.toString();
    }

    private String friendlyServerError(int code, String body) {
        try {
            JSONObject error = new JSONObject(body);
            String message = error.optString("error", error.optString("message", ""));
            if (!message.isEmpty()) return "AI-сервер: " + message;
        } catch (Exception ignored) { }
        return "AI-сервер временно недоступен (код " + code + ")";
    }

    private void backendResult(boolean ok, String result) {
        uiJs("window.onBackendResult(" + ok + "," + JSONObject.quote(result) + ")");
    }

    private void backendTestResult(boolean ok, String result) {
        uiJs("window.onBackendTestResult && window.onBackendTestResult(" + ok + "," + JSONObject.quote(result) + ")");
    }

    private void uiJs(String code) { runOnUiThread(() -> js(code)); }
    private void js(String code) { if (webView != null) webView.evaluateJavascript(code, null); }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else js("window.goHome && window.goHome()");
    }

    @Override protected void onDestroy() {
        activityVisible = false;
        unregisterPersonDetection();
        if (speaker != null) speaker.shutdown();
        stopRobotMotion();
        holdRecording = false;
        voiceTurnId++;
        try { wavRecorder.cancel(); } catch (Throwable ignored) { }
        voiceExecutor.shutdownNow();
        KurultaiApplication.get().setSpeechStateListener(null);
        if (webView != null) webView.removeCallbacks(robotReconnectRunnable);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
