package kz.kurultai.assistant;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;

import java.io.ByteArrayOutputStream;

/**
 * Hold-to-talk recorder for OrionStar SG04.
 *
 * The robot exposes its microphone array as 16 kHz, 16-bit stereo PCM.  The useful
 * microphone signal is the left channel, which is extracted into a standards-compliant
 * mono WAV for OpenAI transcription.  Recording is entirely local and does not use the
 * Xiaobao/RobotOS ASR service.
 */
final class WavRecorder {
    private static final int SAMPLE_RATE = 16_000;
    private static final int MAX_RECORD_MILLIS = 30_000;

    interface LevelListener {
        void onLevel(int level);
    }

    private AudioRecord record;
    private AcousticEchoCanceler echoCanceler;
    private Thread thread;
    private volatile boolean running;
    private int channelCount = 2;
    private final ByteArrayOutputStream monoPcm = new ByteArrayOutputStream();

    synchronized void start(final LevelListener listener) {
        if (running) return;
        monoPcm.reset();

        int channelConfig = AudioFormat.CHANNEL_IN_STEREO;
        int minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, channelConfig, AudioFormat.ENCODING_PCM_16BIT);
        if (minBuffer <= 0) minBuffer = 4096;
        final int bufferSize = Math.max(minBuffer * 2, 4096);

        record = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
            channelConfig, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
        channelCount = 2;
        if (record.getState() != AudioRecord.STATE_INITIALIZED) {
            record.release();
            channelConfig = AudioFormat.CHANNEL_IN_MONO;
            minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, channelConfig, AudioFormat.ENCODING_PCM_16BIT);
            int monoBuffer = Math.max(minBuffer > 0 ? minBuffer * 2 : 4096, 4096);
            record = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
                channelConfig, AudioFormat.ENCODING_PCM_16BIT, monoBuffer);
            channelCount = 1;
            if (record.getState() != AudioRecord.STATE_INITIALIZED) {
                record.release(); record = null;
                throw new IllegalStateException("AudioRecord initialization failed");
            }
        }

        try {
            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(record.getAudioSessionId());
                if (echoCanceler != null) echoCanceler.setEnabled(true);
            }
        } catch (Throwable ignored) { echoCanceler = null; }
        record.startRecording();
        running = true;
        thread = new Thread(() -> capture(bufferSize, listener), "kurultai-mic-capture");
        thread.start();
    }

    private void capture(int bufferSize, LevelListener listener) {
        byte[] stereo = new byte[bufferSize];
        long deadline = System.currentTimeMillis() + MAX_RECORD_MILLIS;
        while (running && System.currentTimeMillis() < deadline) {
            AudioRecord current = record;
            if (current == null) break;
            int count = current.read(stereo, 0, stereo.length);
            if (count <= 0) continue;

            long amplitude = 0;
            int samples = 0;
            synchronized (monoPcm) {
                int frameSize = channelCount == 2 ? 4 : 2;
                for (int i = 0; i + frameSize - 1 < count; i += frameSize) {
                    monoPcm.write(stereo[i]);
                    monoPcm.write(stereo[i + 1]);
                    if ((samples & 3) == 0) {
                        short value = (short) ((stereo[i] & 0xff) | (stereo[i + 1] << 8));
                        amplitude += Math.abs((int) value);
                    }
                    samples++;
                }
            }
            if (listener != null && samples > 0) {
                listener.onLevel(Math.min(100, (int) (amplitude / Math.max(1, samples / 4) / 100)));
            }
        }
    }

    synchronized byte[] stop() {
        running = false;
        AudioRecord current = record;
        if (current != null) {
            try {
                if (current.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) current.stop();
            } catch (Throwable ignored) { }
        }
        if (thread != null) {
            try { thread.join(1000); } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            thread = null;
        }
        if (current != null) {
            try { current.release(); } catch (Throwable ignored) { }
        }
        record = null;
        if (echoCanceler != null) {
            try { echoCanceler.release(); } catch (Throwable ignored) { }
            echoCanceler = null;
        }

        byte[] pcm;
        synchronized (monoPcm) { pcm = monoPcm.toByteArray(); }
        return buildWav(pcm);
    }

    synchronized void cancel() {
        stop();
        synchronized (monoPcm) { monoPcm.reset(); }
    }

    private static byte[] buildWav(byte[] pcm) {
        byte[] wav = new byte[44 + pcm.length];
        ascii(wav, 0, "RIFF");
        int32(wav, 4, 36 + pcm.length);
        ascii(wav, 8, "WAVE");
        ascii(wav, 12, "fmt ");
        int32(wav, 16, 16);
        int16(wav, 20, 1);
        int16(wav, 22, 1);
        int32(wav, 24, SAMPLE_RATE);
        int32(wav, 28, SAMPLE_RATE * 2);
        int16(wav, 32, 2);
        int16(wav, 34, 16);
        ascii(wav, 36, "data");
        int32(wav, 40, pcm.length);
        System.arraycopy(pcm, 0, wav, 44, pcm.length);
        return wav;
    }

    private static void ascii(byte[] dst, int offset, String value) {
        for (int i = 0; i < value.length(); i++) dst[offset + i] = (byte) value.charAt(i);
    }

    private static void int16(byte[] dst, int offset, int value) {
        dst[offset] = (byte) value;
        dst[offset + 1] = (byte) (value >> 8);
    }

    private static void int32(byte[] dst, int offset, int value) {
        int16(dst, offset, value);
        int16(dst, offset + 2, value >> 16);
    }
}
