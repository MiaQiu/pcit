import ExpoModulesCore
import CoreHaptics

// expo-haptics only wraps UIImpactFeedbackGenerator/UINotificationFeedbackGenerator/
// UISelectionFeedbackGenerator — discrete, fixed-shape taps with no duration or
// amplitude-over-time control. A genuinely continuous, ramping buzz (e.g. "spin
// winds up, buzz builds and gets stronger, then stops") requires Core Haptics'
// `.hapticContinuous` event with a `CHHapticParameterCurve` driving intensity
// (and sharpness) across the event's duration — that's what this module exposes.
public class HapticEngineModule: Module {
  private var engine: CHHapticEngine?
  private var currentPlayer: CHHapticPatternPlayer?

  public func definition() -> ModuleDefinition {
    Name("HapticEngine")

    Function("supportsHaptics") { () -> Bool in
      CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    AsyncFunction("playRamp") { (
      durationMs: Double,
      startIntensity: Double,
      endIntensity: Double,
      startSharpness: Double,
      endSharpness: Double
    ) in
      try self.playRamp(
        durationMs: durationMs,
        startIntensity: startIntensity,
        endIntensity: endIntensity,
        startSharpness: startSharpness,
        endSharpness: endSharpness
      )
    }

    AsyncFunction("stop") {
      // Stop the current PLAYER, not the engine. `CHHapticEngine.stop()` shuts
      // down the whole engine — a caller that stops-then-immediately-replays
      // (e.g. re-opening the same celebration) would race a fresh
      // `playRamp()` against that async shutdown, since the engine isn't
      // instantly usable again after `stop()` returns. Player start/stop is
      // cheap and synchronous by comparison, and the engine is meant to stay
      // alive for the module's lifetime.
      try? self.currentPlayer?.stop(atTime: CHHapticTimeImmediate)
      self.currentPlayer = nil
    }
  }

  // Lazily starts (and restarts, if the system stopped it — e.g. backgrounding)
  // a single shared CHHapticEngine instance rather than one per call.
  private func ensureEngine() throws -> CHHapticEngine {
    if let engine = engine {
      return engine
    }
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
      throw HapticsUnsupportedError()
    }

    let newEngine = try CHHapticEngine()
    newEngine.stoppedHandler = { [weak self] _ in
      self?.engine = nil
    }
    newEngine.resetHandler = { [weak self] in
      self?.engine = nil
      _ = try? self?.ensureEngine()
    }
    try newEngine.start()
    engine = newEngine
    return newEngine
  }

  private func playRamp(
    durationMs: Double,
    startIntensity: Double,
    endIntensity: Double,
    startSharpness: Double,
    endSharpness: Double
  ) throws {
    let engine = try ensureEngine()
    let durationSeconds = durationMs / 1000.0

    let continuousEvent = CHHapticEvent(
      eventType: .hapticContinuous,
      parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(startIntensity)),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(startSharpness)),
      ],
      relativeTime: 0,
      duration: durationSeconds
    )

    // A bare 2-point (start, end) curve is mathematically linear/continuous,
    // but a constant-rate climb over a long duration can still read as
    // "textured" rather than one organic build. Interpolating through more
    // points along an ease-in shape (slow to start, accelerating toward the
    // end) smooths that out and better matches a "winding up" feel.
    let intensityCurve = CHHapticParameterCurve(
      parameterID: .hapticIntensityControl,
      controlPoints: easedControlPoints(from: startIntensity, to: endIntensity, duration: durationSeconds),
      relativeTime: 0
    )

    let sharpnessCurve = CHHapticParameterCurve(
      parameterID: .hapticSharpnessControl,
      controlPoints: easedControlPoints(from: startSharpness, to: endSharpness, duration: durationSeconds),
      relativeTime: 0
    )

    let pattern = try CHHapticPattern(events: [continuousEvent], parameterCurves: [intensityCurve, sharpnessCurve])
    let player = try engine.makePlayer(with: pattern)

    // Stop whatever the previous call was still playing before starting the
    // new one, so back-to-back triggers (re-opening the celebration quickly)
    // don't overlap two continuous events on the same engine.
    try? currentPlayer?.stop(atTime: CHHapticTimeImmediate)

    try player.start(atTime: CHHapticTimeImmediate)
    currentPlayer = player
  }

  private func easedControlPoints(
    from start: Double,
    to end: Double,
    duration: Double,
    steps: Int = 10
  ) -> [CHHapticParameterCurve.ControlPoint] {
    (0...steps).map { i in
      let t = Double(i) / Double(steps)
      let eased = t * t // ease-in: builds gradually, accelerates near the end
      let value = start + (end - start) * eased
      return CHHapticParameterCurve.ControlPoint(relativeTime: t * duration, value: Float(value))
    }
  }
}

struct HapticsUnsupportedError: Error, LocalizedError {
  var errorDescription: String? { "This device's hardware does not support Core Haptics." }
}
