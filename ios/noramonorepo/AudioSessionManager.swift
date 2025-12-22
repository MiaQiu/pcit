import Foundation
import AVFoundation
import React

@objc(AudioSessionManager)
class AudioSessionManager: NSObject {

  static func moduleName() -> String! {
    return "AudioSessionManager"
  }

  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private var audioRecorder: AVAudioRecorder?
  private var recordingStartTime: Date?
  private var recordingURL: URL?

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
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Stop any existing recording
    if audioRecorder?.isRecording == true {
      audioRecorder?.stop()
      audioRecorder = nil
    }

    do {
      // Configure audio session
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
      try audioSession.setActive(true)

      // Create unique file name
      let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let timestamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
      let fileName = "recording_\(timestamp).m4a"
      let audioURL = documentsPath.appendingPathComponent(fileName)

      // Audio recording settings
      let settings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 44100.0,
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
      ]

      // Create and start recorder
      audioRecorder = try AVAudioRecorder(url: audioURL, settings: settings)
      audioRecorder?.isMeteringEnabled = true
      audioRecorder?.prepareToRecord()

      guard audioRecorder?.record() == true else {
        reject("RECORDING_ERROR", "Failed to start recording", nil)
        return
      }

      recordingStartTime = Date()
      recordingURL = audioURL

      print("[AudioSessionManager] Recording started: \(audioURL.path)")

      resolve([
        "uri": audioURL.path,
        "status": "recording"
      ])
    } catch {
      print("[AudioSessionManager] Failed to start recording: \(error.localizedDescription)")
      reject("RECORDING_ERROR", "Failed to start recording: \(error.localizedDescription)", error)
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
    audioRecorder = nil
    recordingStartTime = nil
    let finalURL = recordingURL
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
}
