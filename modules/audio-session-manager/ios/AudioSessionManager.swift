import Foundation
import AVFoundation
import React

@objc(AudioSessionManager)
class AudioSessionManager: RCTEventEmitter {

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

    // Setup silent audio player for background recording
    setupSilentAudioPlayer()
  }

  deinit {
    // CRITICAL: Remove observers to prevent memory leaks
    NotificationCenter.default.removeObserver(self)
    stopSilentAudio()
    silentAudioPlayer = nil
    cleanupRecording()
    endBackgroundTask()
  }

  @objc private func handleMemoryWarning() {
    NSLog("[AudioSessionManager] ⚠️ MEMORY WARNING RECEIVED")

    // Clean up non-essential resources
    if audioRecorder?.isRecording != true {
      // Not recording - safe to clean up everything
      stopSilentAudio()
      cleanupRecording()
      recordingURL = nil
      recordingStartTime = nil
      NSLog("[AudioSessionManager] 🧹 Cleaned up non-recording resources")
    } else {
      // Still recording - keep silent audio playing to maintain background state
      NSLog("[AudioSessionManager] 🎙️ Still recording - keeping essential resources including silent audio")
    }
  }

  @objc private func appDidEnterBackground() {
    // Audio session keeps the app alive while recording (via UIBackgroundModes: audio)
    // We DON'T need a background task here - only after recording stops for upload
    if let recorder = audioRecorder, recorder.isRecording {
      NSLog("[AudioSessionManager] 📱 App entered background while recording")

      // CRITICAL: Ensure audio session stays active when backgrounding
      let audioSession = AVAudioSession.sharedInstance()
      do {
        // Re-activate the audio session to ensure it stays active
        // Use .notifyOthersOnDeactivation for smooth transitions with other audio apps
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        NSLog("[AudioSessionManager] ✅ Re-activated audio session in background")
      } catch {
        NSLog("[AudioSessionManager] ❌ Failed to re-activate audio session: %@", error.localizedDescription)
      }
    } else {
      NSLog("[AudioSessionManager] ⚠️ App backgrounded but recorder not active!")
    }
  }

  private var audioRecorder: AVAudioRecorder?
  private var recordingStartTime: Date?
  private var recordingURL: URL?
  private var autoStopTimer: Timer?
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
  private var keepAliveTimer: Timer?
  private var silentAudioPlayer: AVAudioPlayer?

  // MARK: - Silent Audio Player (keeps app alive in background)

  private func setupSilentAudioPlayer() {
    // Create a 1-second silent audio file if it doesn't exist
    let fileManager = FileManager.default
    let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let silentAudioURL = documentsPath.appendingPathComponent("silence.m4a")

    // Only create the file once
    if !fileManager.fileExists(atPath: silentAudioURL.path) {
      NSLog("[AudioSessionManager] 🔇 Creating silent audio file...")

      // Create a 1-second silent audio buffer
      let sampleRate = 44100.0
      let duration = 1.0
      let frameCount = Int(sampleRate * duration)

      guard let format = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                       sampleRate: sampleRate,
                                       channels: 1,
                                       interleaved: false) else {
        NSLog("[AudioSessionManager] ⚠️ Failed to create audio format")
        return
      }

      guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frameCount)) else {
        NSLog("[AudioSessionManager] ⚠️ Failed to create audio buffer")
        return
      }
      buffer.frameLength = AVAudioFrameCount(frameCount)

      // Buffer is already silent (zeros by default)

      do {
        let audioFile = try AVAudioFile(forWriting: silentAudioURL,
                                         settings: [
                                           AVFormatIDKey: kAudioFormatMPEG4AAC,
                                           AVSampleRateKey: sampleRate,
                                           AVNumberOfChannelsKey: 1,
                                           AVEncoderAudioQualityKey: AVAudioQuality.min.rawValue
                                         ])
        try audioFile.write(from: buffer)
        NSLog("[AudioSessionManager] ✅ Silent audio file created")
      } catch {
        NSLog("[AudioSessionManager] ❌ Failed to create silent audio file: %@", error.localizedDescription)
        return
      }
    }

    // Create the player
    do {
      silentAudioPlayer = try AVAudioPlayer(contentsOf: silentAudioURL)
      silentAudioPlayer?.numberOfLoops = -1 // Loop indefinitely
      silentAudioPlayer?.volume = 0.0 // Silent
      silentAudioPlayer?.prepareToPlay()
      NSLog("[AudioSessionManager] ✅ Silent audio player prepared")
    } catch {
      NSLog("[AudioSessionManager] ❌ Failed to create silent audio player: %@", error.localizedDescription)
    }
  }

  private func startSilentAudio() {
    guard let player = silentAudioPlayer else {
      NSLog("[AudioSessionManager] ⚠️ Silent audio player not initialized")
      setupSilentAudioPlayer()
      return
    }

    if !player.isPlaying {
      player.play()
      NSLog("[AudioSessionManager] 🔇 Started silent audio playback (keeps app alive)")
    }
  }

  private func stopSilentAudio() {
    silentAudioPlayer?.stop()
    NSLog("[AudioSessionManager] 🔇 Stopped silent audio playback")
  }

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
    withResolver resolve: @escaping RCTPromiseResolveBlock,
    withRejecter reject: @escaping RCTPromiseRejectBlock
  ) {
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
      audioRecorder?.isMeteringEnabled = true
      audioRecorder?.prepareToRecord()

      // Start Recording
      guard audioRecorder?.record() == true else {
        reject("RECORDING_ERROR", "Failed to start recording", nil)
        return
      }

      recordingStartTime = Date()
      recordingURL = audioURL

      // Start silent audio to keep app alive in background
      startSilentAudio()

      // ============================================================
      // CRITICAL FIX: TIMERS MUST RUN ON MAIN THREAD
      // ============================================================
      // iOS suspends background queues when locked.
      // The Main Thread is kept alive by the "Audio" entitlement.

      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }

        // A. LIGHTWEIGHT Keep Alive Timer
        // CRITICAL: No logging, no disk I/O - only updateMeters() is safe on main thread
        // when device is locked. Any blocking operations trigger watchdog kills.
        self.keepAliveTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            // This is the ONLY thing safe to do frequently on main thread in background
            self?.audioRecorder?.updateMeters()
        }

        // B. Auto-Stop Timer (lightweight - just calls the stop method)
        let autoStopDuration = autoStopSeconds.doubleValue
        if autoStopDuration > 0 {
            self.autoStopTimer = Timer.scheduledTimer(withTimeInterval: autoStopDuration, repeats: false) { [weak self] _ in
                self?.autoStopRecording()
            }
        }
      }
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

  // Auto-stop callback - saves recording info and sends event to JavaScript
  private func autoStopRecording() {
    NSLog("[AudioSessionManager] 🔴 autoStopRecording() called")

    guard let recorder = audioRecorder, recorder.isRecording else {
      NSLog("[AudioSessionManager] ❌ Auto-stop called but no active recording")
      return
    }

    NSLog("[AudioSessionManager] ✅ Auto-stopping recording")

    // Start background task to keep app alive for upload
    beginBackgroundTask()

    recorder.stop()

    let durationMillis = recordingStartTime.map { Int(Date().timeIntervalSince($0) * 1000) } ?? 0
    let uri = recordingURL?.path ?? ""

    // Save to UserDefaults so JavaScript can pick it up when app comes to foreground
    let defaults = UserDefaults.standard
    defaults.set(uri, forKey: "pendingRecordingUri")
    defaults.set(durationMillis, forKey: "pendingRecordingDuration")
    defaults.set(true, forKey: "pendingRecordingAutoStopped")
    defaults.synchronize()

    NSLog("[AudioSessionManager] Saved auto-stopped recording to UserDefaults: %@", uri)
    NSLog("[AudioSessionManager] Background task started - app will stay alive for upload")

    // Send event to JavaScript (may not be received if app is backgrounded)
    sendEvent(withName: "onRecordingAutoStopped", body: [
      "uri": uri,
      "durationMillis": durationMillis
    ])

    // Clean up
    cleanupRecording()
    recordingStartTime = nil
    recordingURL = nil

    // Deactivate audio session after a short delay
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
      } catch {
        print("[AudioSessionManager] Failed to deactivate audio session: \(error.localizedDescription)")
      }
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

    keepAliveTimer?.invalidate()
    keepAliveTimer = nil

    // Stop silent audio
    stopSilentAudio()

    // Stop recording if active
    if audioRecorder?.isRecording == true {
      audioRecorder?.stop()
    }
    audioRecorder = nil
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
}
