package com.chromamind.nora.audiosessionmanager

import android.content.Context
import android.media.AudioFormat
import android.media.AudioManager
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class AudioSessionManagerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AudioSessionManager"
        private const val EVENT_AUTO_STOPPED = "onRecordingAutoStopped"
        private const val PREF_NAME = "AudioSessionManagerPrefs"
        private const val PREF_PENDING_URI = "pendingRecordingUri"
        private const val PREF_PENDING_DURATION = "pendingRecordingDuration"
        private const val PREF_PENDING_AUTO_STOPPED = "pendingRecordingAutoStopped"
    }

    override fun getName() = "AudioSessionManager"

    private var mediaRecorder: MediaRecorder? = null
    private var recordingFile: File? = null
    private var recordingStartTime: Long = 0
    private var autoStopHandler: Handler? = null
    private var autoStopRunnable: Runnable? = null

    // --------------------------------------------------------------------------
    // configureAudioSessionForRecording
    // --------------------------------------------------------------------------

    @ReactMethod
    fun configureAudioSessionForRecording(promise: Promise) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            }
            Log.d(TAG, "Audio session configured for recording")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to configure audio session: ${e.message}")
            promise.reject("AUDIO_SESSION_ERROR", "Failed to configure audio session: ${e.message}", e)
        }
    }

    // --------------------------------------------------------------------------
    // setCompletionSound — no-op on Android (sound handled by expo-av in JS)
    // --------------------------------------------------------------------------

    @ReactMethod
    fun setCompletionSound(soundName: String) {
        Log.d(TAG, "setCompletionSound: $soundName (no-op on Android)")
    }

    // --------------------------------------------------------------------------
    // startRecording
    // --------------------------------------------------------------------------

    @ReactMethod
    fun startRecording(autoStopSeconds: Double, promise: Promise) {
        cleanupRecording()

        try {
            // Create output file in app's files directory
            val dir = reactApplicationContext.filesDir
            val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH-mm-ss", Locale.US).format(Date())
            val file = File(dir, "recording_$timestamp.m4a")
            recordingFile = file

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(reactApplicationContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioChannels(1)
                setAudioEncodingBitRate(128000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }

            mediaRecorder = recorder
            recordingStartTime = System.currentTimeMillis()

            Log.d(TAG, "Recording started: ${file.absolutePath}")

            // Schedule auto-stop if requested
            if (autoStopSeconds > 0) {
                val handler = Handler(Looper.getMainLooper())
                val runnable = Runnable { handleAutoStop() }
                handler.postDelayed(runnable, (autoStopSeconds * 1000).toLong())
                autoStopHandler = handler
                autoStopRunnable = runnable
            }

            promise.resolve(
                Arguments.createMap().apply {
                    putString("uri", file.absolutePath)
                    putString("status", "recording")
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording: ${e.message}")
            cleanupRecording()
            promise.reject("RECORDING_ERROR", "Failed to start recording: ${e.message}", e)
        }
    }

    // --------------------------------------------------------------------------
    // stopRecording
    // --------------------------------------------------------------------------

    @ReactMethod
    fun stopRecording(promise: Promise) {
        val recorder = mediaRecorder
        if (recorder == null) {
            promise.reject("RECORDING_ERROR", "No active recording to stop")
            return
        }

        try {
            // Cancel any pending auto-stop
            autoStopRunnable?.let { autoStopHandler?.removeCallbacks(it) }
            autoStopHandler = null
            autoStopRunnable = null

            recorder.stop()
            recorder.release()
            mediaRecorder = null

            val durationMillis = (System.currentTimeMillis() - recordingStartTime).toInt()
            val uri = recordingFile?.absolutePath ?: ""

            Log.d(TAG, "Recording stopped. Duration: ${durationMillis}ms")

            recordingFile = null
            recordingStartTime = 0

            promise.resolve(
                Arguments.createMap().apply {
                    putString("uri", uri)
                    putInt("durationMillis", durationMillis)
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop recording: ${e.message}")
            promise.reject("RECORDING_ERROR", "Failed to stop recording: ${e.message}", e)
        }
    }

    // --------------------------------------------------------------------------
    // getRecordingStatus
    // --------------------------------------------------------------------------

    @ReactMethod
    fun getRecordingStatus(promise: Promise) {
        val isRecording = mediaRecorder != null
        val durationMillis = if (isRecording) (System.currentTimeMillis() - recordingStartTime).toInt() else 0

        promise.resolve(
            Arguments.createMap().apply {
                putBoolean("isRecording", isRecording)
                putInt("durationMillis", durationMillis)
            }
        )
    }

    // --------------------------------------------------------------------------
    // deactivateAudioSession
    // --------------------------------------------------------------------------

    @ReactMethod
    fun deactivateAudioSession(promise: Promise) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioManager.mode = AudioManager.MODE_NORMAL
            }
            Log.d(TAG, "Audio session deactivated")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to deactivate audio session: ${e.message}")
            promise.reject("AUDIO_SESSION_ERROR", "Failed to deactivate: ${e.message}", e)
        }
    }

    // --------------------------------------------------------------------------
    // getPendingRecording
    // --------------------------------------------------------------------------

    @ReactMethod
    fun getPendingRecording(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val autoStopped = prefs.getBoolean(PREF_PENDING_AUTO_STOPPED, false)
        val uri = prefs.getString(PREF_PENDING_URI, null)

        if (autoStopped && !uri.isNullOrEmpty()) {
            val durationMillis = prefs.getInt(PREF_PENDING_DURATION, 0)

            Log.d(TAG, "Found pending auto-stopped recording: $uri")

            prefs.edit()
                .remove(PREF_PENDING_URI)
                .remove(PREF_PENDING_DURATION)
                .remove(PREF_PENDING_AUTO_STOPPED)
                .apply()

            promise.resolve(
                Arguments.createMap().apply {
                    putString("uri", uri)
                    putInt("durationMillis", durationMillis)
                }
            )
        } else {
            promise.resolve(null)
        }
    }

    // --------------------------------------------------------------------------
    // endBackgroundTask — no-op on Android (no UIBackgroundTask equivalent)
    // --------------------------------------------------------------------------

    @ReactMethod
    fun endBackgroundTask(promise: Promise) {
        Log.d(TAG, "endBackgroundTask: no-op on Android")
        promise.resolve(true)
    }

    // --------------------------------------------------------------------------
    // Auto-stop handler
    // --------------------------------------------------------------------------

    private fun handleAutoStop() {
        val recorder = mediaRecorder ?: return

        try {
            recorder.stop()
            recorder.release()
            mediaRecorder = null

            val durationMillis = (System.currentTimeMillis() - recordingStartTime).toInt()
            val uri = recordingFile?.absolutePath ?: ""

            Log.d(TAG, "Auto-stop triggered. Duration: ${durationMillis}ms, uri: $uri")

            // Persist to SharedPreferences so JS can pick it up when app resumes
            val prefs = reactApplicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(PREF_PENDING_URI, uri)
                .putInt(PREF_PENDING_DURATION, durationMillis)
                .putBoolean(PREF_PENDING_AUTO_STOPPED, true)
                .apply()

            recordingFile = null
            recordingStartTime = 0

            // Emit event to JS
            sendEvent(
                EVENT_AUTO_STOPPED,
                Arguments.createMap().apply {
                    putString("uri", uri)
                    putInt("durationMillis", durationMillis)
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Auto-stop failed: ${e.message}")
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // --------------------------------------------------------------------------
    // Cleanup
    // --------------------------------------------------------------------------

    private fun cleanupRecording() {
        autoStopRunnable?.let { autoStopHandler?.removeCallbacks(it) }
        autoStopHandler = null
        autoStopRunnable = null

        mediaRecorder?.let {
            try { it.stop() } catch (_: Exception) {}
            try { it.release() } catch (_: Exception) {}
        }
        mediaRecorder = null
    }

    override fun onCatalystInstanceDestroy() {
        cleanupRecording()
    }

    // Required for NativeEventEmitter on JS side
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Double) {}
}
