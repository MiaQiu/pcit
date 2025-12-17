import AVFoundation
import React

@objc(AudioSessionManager)
class AudioSessionManager: NSObject, AVAudioRecorderDelegate {

  private var audioRecorder: AVAudioRecorder?
  private var recordingPath: String?
  private var startTime: Date?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func configureAudioSessionForRecording(_ resolve: @escaping RCTPromiseResolveBlock,
                                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    let audioSession = AVAudioSession.sharedInstance()

    do {
      // Use .playAndRecord category since we both record AND play completion sounds
      // This allows background recording and audio playback
      try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])

      // Activate the audio session
      try audioSession.setActive(true, options: [])

      print("[AudioSession] Configured for playAndRecord with background support")
      resolve(true)
    } catch {
      print("[AudioSession] Failed to configure: \(error.localizedDescription)")
      reject("AUDIO_SESSION_ERROR", "Failed to configure audio session: \(error.localizedDescription)", error)
    }
  }

  @objc
  func startRecording(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      // Configure audio session
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
      try audioSession.setActive(true, options: [])

      // Create recording path
      let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let timestamp = Int(Date().timeIntervalSince1970 * 1000)
      let audioFilename = documentsPath.appendingPathComponent("recording_\(timestamp).m4a")
      recordingPath = audioFilename.path

      // Configure recording settings
      let settings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 44100.0,
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
      ]

      // Create and start recorder
      audioRecorder = try AVAudioRecorder(url: audioFilename, settings: settings)
      audioRecorder?.delegate = self
      audioRecorder?.record()
      startTime = Date()

      print("[AudioRecorder] Started recording to: \(audioFilename.path)")
      resolve([
        "uri": audioFilename.path,
        "status": "recording"
      ])
    } catch {
      print("[AudioRecorder] Failed to start recording: \(error.localizedDescription)")
      reject("RECORDING_ERROR", "Failed to start recording: \(error.localizedDescription)", error)
    }
  }

  @objc
  func stopRecording(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let recorder = audioRecorder, recorder.isRecording else {
      reject("RECORDING_ERROR", "No active recording", nil)
      return
    }

    recorder.stop()

    let duration = startTime != nil ? Date().timeIntervalSince(startTime!) : 0
    let durationMillis = Int(duration * 1000)

    print("[AudioRecorder] Stopped recording. Duration: \(durationMillis)ms")

    resolve([
      "uri": recordingPath ?? "",
      "durationMillis": durationMillis
    ])

    audioRecorder = nil
    recordingPath = nil
    startTime = nil
  }

  @objc
  func getRecordingStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let recorder = audioRecorder else {
      resolve([
        "isRecording": false,
        "durationMillis": 0
      ])
      return
    }

    let duration = startTime != nil ? Date().timeIntervalSince(startTime!) : 0
    let durationMillis = Int(duration * 1000)

    resolve([
      "isRecording": recorder.isRecording,
      "durationMillis": durationMillis
    ])
  }

  @objc
  func deactivateAudioSession(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    let audioSession = AVAudioSession.sharedInstance()

    do {
      try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
      print("[AudioSession] Deactivated")
      resolve(true)
    } catch {
      print("[AudioSession] Failed to deactivate: \(error.localizedDescription)")
      reject("AUDIO_SESSION_ERROR", "Failed to deactivate audio session: \(error.localizedDescription)", error)
    }
  }

  // MARK: - AVAudioRecorderDelegate

  func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
    print("[AudioRecorder] Finished recording. Success: \(flag)")
  }

  func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
    print("[AudioRecorder] ❌ Encode error: \(error?.localizedDescription ?? "unknown")")
  }

  func audioRecorderBeginInterruption(_ recorder: AVAudioRecorder) {
    print("[AudioRecorder] ⚠️ INTERRUPTION BEGAN - Recording may have paused")
  }

  func audioRecorderEndInterruption(_ recorder: AVAudioRecorder, withOptions flags: Int) {
    print("[AudioRecorder] ⚠️ INTERRUPTION ENDED - Flags: \(flags)")
    // Resume recording if it was interrupted
    if !recorder.isRecording {
      print("[AudioRecorder] Resuming recording after interruption...")
      recorder.record()
    }
  }
}
