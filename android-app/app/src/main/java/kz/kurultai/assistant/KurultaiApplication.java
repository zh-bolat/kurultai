package kz.kurultai.assistant;

import android.app.Application;
import android.util.Log;

import com.ainirobot.coreservice.client.ApiListener;
import com.ainirobot.coreservice.client.RobotApi;
import com.ainirobot.coreservice.client.speech.SkillApi;

/** Keeps the OrionStar native speech connection alive for the whole app process. */
public final class KurultaiApplication extends Application {
    private static final String TAG = "KurultaiRobot";
    private static KurultaiApplication instance;

    interface SpeechStateListener {
        void onSpeechState(String state, boolean ready);
    }

    private volatile SkillApi skillApi;
    private volatile boolean speechReady;
    private volatile String state = "RobotOS подключается";
    private volatile SpeechStateListener listener;
    private volatile boolean robotConnecting;
    private volatile long connectStartedAt;

    public static KurultaiApplication get() { return instance; }

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        connectRobot();
    }

    synchronized void reconnectRobot() {
        SkillApi current = connectedSkillApi();
        if (current != null) return;
        if (robotConnecting && System.currentTimeMillis() - connectStartedAt < 15000L) return;
        try {
            if (RobotApi.getInstance().isApiConnectedService()) {
                connectSpeech();
                return;
            }
        } catch (Throwable ignored) { }
        connectRobot();
    }

    private void connectRobot() {
        long now = System.currentTimeMillis();
        if (robotConnecting && now - connectStartedAt < 15000L) return;
        robotConnecting = true;
        connectStartedAt = now;
        update("RobotOS подключается", false);
        try {
            RobotApi.getInstance().connectServer(this, new ApiListener() {
                @Override public void handleApiDisabled() { robotConnecting = false; update("RobotApi disabled", false); }
                @Override public void handleApiConnected() {
                    robotConnecting = false;
                    update("RobotApi connected", false);
                    connectSpeech();
                }
                @Override public void handleApiDisconnected() { robotConnecting = false; update("RobotApi disconnected", false); }
            });
        } catch (Throwable error) {
            robotConnecting = false;
            Log.w(TAG, "RobotApi connection failed", error);
            String message = error.getMessage();
            update("RobotOS error: " + error.getClass().getSimpleName() +
                (message == null || message.trim().isEmpty() ? "" : " — " + message), false);
        }
    }

    private void connectSpeech() {
        try {
            SkillApi current = skillApi;
            if (current != null && current.isApiConnectedService()) {
                update("Голос робота готов", true);
                return;
            }
            final SkillApi api = new SkillApi();
            skillApi = api;
            api.addApiEventListener(new ApiListener() {
                @Override public void handleApiDisabled() { update("SkillApi disabled", false); }
                @Override public void handleApiConnected() {
                    try {
                        // Hubl uses the connected SkillApi directly for playText; no ASR scene is needed.
                        api.setTTSSpeechSpeed(50);
                    } catch (Throwable ignored) { }
                    update("Голос робота готов", true);
                }
                @Override public void handleApiDisconnected() { update("SkillApi disconnected", false); }
            });
            api.connectApi(this);
        } catch (Throwable error) {
            Log.w(TAG, "SkillApi connection failed", error);
            skillApi = null;
            String message = error.getMessage();
            update("SkillApi error: " + error.getClass().getSimpleName() +
                (message == null || message.trim().isEmpty() ? "" : " — " + message), false);
        }
    }

    SkillApi connectedSkillApi() {
        SkillApi api = skillApi;
        if (!speechReady || api == null) return null;
        try { return api.isApiConnectedService() ? api : null; }
        catch (Throwable error) { return null; }
    }

    String robotState() { return state; }
    String stateText() { return state; }

    void setSpeechStateListener(SpeechStateListener value) {
        listener = value;
        if (value != null) value.onSpeechState(state, speechReady);
    }

    private void update(String value, boolean ready) {
        state = value;
        speechReady = ready;
        Log.i(TAG, value);
        SpeechStateListener current = listener;
        if (current != null) current.onSpeechState(value, ready);
    }
}
