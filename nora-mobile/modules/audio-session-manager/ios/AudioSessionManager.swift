import Foundation
import AVFoundation
import React

@objc(AudioSessionManager)
class AudioSessionManager: RCTEventEmitter, AVAudioRecorderDelegate {

  override static func moduleName() -> String! {
    return "AudioSessionManager"
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["onRecordingAutoStopped"]
  }

  override init() {
    super.init()

    // Monitor app state changes to start background task when app backgrounds during recording
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(appDidEnterBackground),
      name: UIApplication.didEnterBackgroundNotification,
      object: nil
    )

    // Monitor memory warnings
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleMemoryWarning),
      name: UIApplication.didReceiveMemoryWarningNotification,
      object: nil
    )

    // REMOVED: Silent audio player - not needed with UIBackgroundModes: audio
  }

  deinit {
    // CRITICAL: Remove observers to prevent memory leaks
    NotificationCenter.default.removeObserver(self)
    cleanupRecording()
    endBackgroundTask()
  }

  @objc private func handleMemoryWarning() {
    NSLog("[AudioSessionManager] ⚠️ MEMORY WARNING RECEIVED")

    // Clean up non-essential resources
    if audioRecorder?.isRecording != true {
      // Not recording - safe to clean up everything
      cleanupRecording()
      recordingURL = nil
      recordingStartTime = nil
      NSLog("[AudioSessionManager] 🧹 Cleaned up non-recording resources")
    } else {
      // Still recording - keep essential resources
      NSLog("[AudioSessionManager] 🎙️ Still recording - keeping essential resources")
    }
  }

  @objc private func appDidEnterBackground() {
    // SIMPLIFIED: Just log - don't interfere with audio session
    // The test app proves we don't need to re-activate the session
    // UIBackgroundModes: audio + AVAudioRecorder handles everything
    if let recorder = audioRecorder, recorder.isRecording {
      NSLog("[AudioSessionManager] 📱 App entered background while recording - continuing...")
    } else {
      NSLog("[AudioSessionManager] ⚠️ App backgrounded but recorder not active!")
    }
  }

  private var audioRecorder: AVAudioRecorder?
  private var recordingStartTime: Date?
  private var recordingURL: URL?
  private var autoStopTimer: Timer?
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
  private var completionSoundName: String = "Win"
  private var audioPlayer: AVAudioPlayer?

  // MARK: - Audio Session Configuration

  @objc
  func configureAudioSessionForRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
      try audioSession.setActive(true, options: [])

      print("[AudioSessionManager] Audio session configured for recording")
      resolve(true)
    } catch {
      print("[AudioSessionManager] Failed to configure audio session: \(error.localizedDescription)")
      reject("AUDIO_SESSION_ERROR", "Failed to configure audio session: \(error.localizedDescription)", error)
    }
  }

  // MARK: - Recording Control

  @objc
  func startRecording(
    _ autoStopSeconds: NSNumber,
    soundName: String,
    withResolver resolve: @escaping RCTPromiseResolveBlock,
    withRejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Store the completion sound name
    completionSoundName = soundName
    NSLog("[AudioSessionManager] 🔊 Completion sound set to: %@", soundName)

    // 1. Cleanup previous state
    cleanupRecording()

    do {
      // 2. Configure Session
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
      try audioSession.setActive(true)

      // 3. File Setup
      let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let timestamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
      let fileName = "recording_\(timestamp).m4a"
      let audioURL = documentsPath.appendingPathComponent(fileName)

      // ============================================================
      // CRITICAL FIX: PRE-CREATE FILE WITH NO PROTECTION
      // ============================================================
      // We create the empty file with FileProtectionType.none BEFORE
      // AVAudioRecorder opens it. This prevents iOS from rejecting
      // our protection settings due to file lock contention.

      let fileAttributes = [FileAttributeKey.protectionKey: FileProtectionType.none]

      let success = FileManager.default.createFile(
          atPath: audioURL.path,
          contents: nil,
          attributes: fileAttributes
      )

      if success {
          NSLog("[AudioSessionManager] ✅ Pre-created unprotected file: %@", fileName)

          // Verify the file protection was actually set
          do {
              let attrs = try FileManager.default.attributesOfItem(atPath: audioURL.path)
              if let protection = attrs[.protectionKey] as? FileProtectionType {
                  NSLog("[AudioSessionManager] 🔍 Verified file protection: %@", protection.rawValue)
              } else {
                  NSLog("[AudioSessionManager] ⚠️ Could not read file protection attribute")
              }
          } catch {
              NSLog("[AudioSessionManager] ⚠️ Failed to verify file attributes: %@", error.localizedDescription)
          }
      } else {
          NSLog("[AudioSessionManager] ⚠️ Failed to create file explicitly")
      }
      // ============================================================

      // 4. Recorder Setup
      let settings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 44100.0,
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
      ]

      // Initialize the Recorder (will write to the file we just created)
      audioRecorder = try AVAudioRecorder(url: audioURL, settings: settings)
      audioRecorder?.delegate = self  // CRITICAL: Set delegate to get auto-stop callback
      audioRecorder?.isMeteringEnabled = true
      audioRecorder?.prepareToRecord()

      // ============================================================
      // SIMPLIFIED APPROACH: Use AVFoundation's built-in duration handling
      // ============================================================
      // The test app proves we don't need keep-alive timers or silent audio
      // AVFoundation + UIBackgroundModes: audio handles background recording

      let autoStopDuration = autoStopSeconds.doubleValue

      // Start Recording with duration (let AVFoundation handle it)
      guard audioRecorder?.record(forDuration: autoStopDuration) == true else {
        reject("RECORDING_ERROR", "Failed to start recording", nil)
        return
      }

      recordingStartTime = Date()
      recordingURL = audioURL

      // ============================================================
      // DELEGATE-BASED AUTO-STOP: Reliable in background
      // ============================================================
      // AVFoundation will call audioRecorderDidFinishRecording when duration expires
      // This is more reliable than DispatchQueue.main.asyncAfter in background
      // No additional timers needed - the delegate method handles everything
      // ============================================================

      NSLog("[AudioSessionManager] 🎙️ Recording started: %@", audioURL.path)

      resolve([
        "uri": audioURL.path,
        "status": "recording"
      ])
    } catch {
      print("[AudioSessionManager] Failed to start: \(error.localizedDescription)")
      reject("RECORDING_ERROR", "Failed to start: \(error.localizedDescription)", error)
    }
  }

  private func beginBackgroundTask() {
    backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "RecordingUpload") { [weak self] in
      // Called if the task takes too long
      print("[AudioSessionManager] Background task expired")
      self?.endBackgroundTask()
    }
    print("[AudioSessionManager] Background task started: \(backgroundTask.rawValue)")
  }

  @objc
  func endBackgroundTask(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    endBackgroundTask()
    resolve(true)
  }

  private func endBackgroundTask() {
    guard backgroundTask != .invalid else { return }
    print("[AudioSessionManager] Ending background task: \(backgroundTask.rawValue)")
    UIApplication.shared.endBackgroundTask(backgroundTask)
    backgroundTask = .invalid
  }

  private func cleanupRecording() {
    // Invalidate timers
    autoStopTimer?.invalidate()
    autoStopTimer = nil

    // Stop recording if active
    if audioRecorder?.isRecording == true {
      audioRecorder?.stop()
    }
    audioRecorder = nil
  }

  private func playCompletionSound() {
    NSLog("[AudioSessionManager] 🔊 Playing completion sound: %@", completionSoundName)

    // Try to find the sound file in the bundle
    // React Native/Expo bundles assets, so we look for the sound file
    guard let soundURL = Bundle.main.url(forResource: completionSoundName, withExtension: "mp3") else {
      NSLog("[AudioSessionManager] ⚠️ Sound file not found: %@.mp3", completionSoundName)
      return
    }

    do {
      // Configure audio session for playback (it was set for recording)
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playback, mode: .default, options: [.duckOthers])
      try audioSession.setActive(true)

      // Create and play the sound
      audioPlayer = try AVAudioPlayer(contentsOf: soundURL)
      audioPlayer?.volume = 1.0
      audioPlayer?.play()

      NSLog("[AudioSessionManager] ✅ Completion sound playing")
    } catch {
      NSLog("[AudioSessionManager] ❌ Failed to play completion sound: %@", error.localizedDescription)
    }
  }

  @objc
  func stopRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let recorder = audioRecorder, recorder.isRecording else {
      reject("RECORDING_ERROR", "No active recording to stop", nil)
      return
    }

    recorder.stop()

    let durationMillis = recordingStartTime.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
    let uri = recordingURL?.path ?? ""

    print("[AudioSessionManager] Recording stopped. Duration: \(durationMillis)ms")

    // Clean up
    cleanupRecording()
    recordingStartTime = nil
    recordingURL = nil

    resolve([
      "uri": uri,
      "durationMillis": durationMillis
    ])

    // Deactivate audio session after a short delay to allow other audio to play
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
      } catch {
        print("[AudioSessionManager] Failed to deactivate audio session: \(error.localizedDescription)")
      }
    }
  }

  @objc
  func getRecordingStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let isRecording = audioRecorder?.isRecording ?? false
    let durationMillis = recordingStartTime.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0

    resolve([
      "isRecording": isRecording,
      "durationMillis": durationMillis
    ])
  }

  @objc
  func deactivateAudioSession(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setActive(false, options: .notifyOthersOnDeactivation)

      print("[AudioSessionManager] Audio session deactivated")
      resolve(true)
    } catch {
      print("[AudioSessionManager] Failed to deactivate audio session: \(error.localizedDescription)")
      reject("AUDIO_SESSION_ERROR", "Failed to deactivate audio session: \(error.localizedDescription)", error)
    }
  }

  @objc
  func getPendingRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let defaults = UserDefaults.standard

    if let uri = defaults.string(forKey: "pendingRecordingUri"),
       defaults.bool(forKey: "pendingRecordingAutoStopped") {
      let durationMillis = defaults.integer(forKey: "pendingRecordingDuration")

      print("[AudioSessionManager] Found pending auto-stopped recording: \(uri)")

      // Clear the pending recording
      defaults.removeObject(forKey: "pendingRecordingUri")
      defaults.removeObject(forKey: "pendingRecordingDuration")
      defaults.removeObject(forKey: "pendingRecordingAutoStopped")
      defaults.synchronize()

      resolve([
        "uri": uri,
        "durationMillis": durationMillis
      ])
    } else {
      resolve(NSNull())
    }
  }

  // MARK: - AVAudioRecorderDelegate

  // This delegate method is called automatically when recording finishes
  // Either due to duration expiring OR manual stop
  func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
    NSLog("[AudioSessionManager] 🔴 audioRecorderDidFinishRecording called, success: %@", flag ? "true" : "false")

    // Only handle auto-stop case here
    // Manual stops are already handled by stopRecording() method
    guard flag else {
      NSLog("[AudioSessionManager] ❌ Recording finished unsuccessfully")
      return
    }

    // Check if this was an auto-stop (recorder stopped itself after duration)
    // vs manual stop (user clicked stop button)
    if recorder.isRecording == false && recordingURL != nil {
      NSLog("[AudioSessionManager] ✅ Auto-stop detected - handling cleanup")

      // Start background task to keep app alive for upload
      beginBackgroundTask()

      // Play completion sound immediately (works even in background)
      playCompletionSound()

      let durationMillis = recordingStartTime.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
      let uri = recordingURL?.path ?? ""

      // Save to UserDefaults so JavaScript can pick it up when app comes to foreground
      let defaults = UserDefaults.standard
      defaults.set(uri, forKey: "pendingRecordingUri")
      defaults.set(durationMillis, forKey: "pendingRecordingDuration")
      defaults.set(true, forKey: "pendingRecordingAutoStopped")
      defaults.synchronize()

      NSLog("[AudioSessionManager] 💾 Saved auto-stopped recording to UserDefaults: %@", uri)
      NSLog("[AudioSessionManager] ⏱️ Duration: %d ms", durationMillis)

      // Send event to JavaScript (may not be received if app is backgrounded)
      sendEvent(withName: "onRecordingAutoStopped", body: [
        "uri": uri,
        "durationMillis": durationMillis
      ])

      // Clean up
      cleanupRecording()
      recordingStartTime = nil
      recordingURL = nil

      // Deactivate audio session after sound finishes (approx 2 seconds)
      DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
        self?.audioPlayer = nil  // Release the player
        do {
          try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
          NSLog("[AudioSessionManager] 🔇 Audio session deactivated")
        } catch {
          NSLog("[AudioSessionManager] ❌ Failed to deactivate audio session: %@", error.localizedDescription)
        }
      }
    }
  }
}
