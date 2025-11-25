// Sound effect utilities using Web Audio API
// No external audio files needed - all sounds generated programmatically

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Play a sound effect by name
 * @param {string} soundName - One of: 'gentle-ding', 'success-chime', 'soft-bell', 'triple-beep', 'subtle-pop'
 */
export const playSound = (soundName) => {
  const soundFunctions = {
    'gentle-ding': playGentleDing,
    'success-chime': playSuccessChime,
    'soft-bell': playSoftBell,
    'triple-beep': playTripleBeep,
    'subtle-pop': playSubtlePop
  };

  const soundFunction = soundFunctions[soundName];
  if (soundFunction) {
    soundFunction();
  } else {
    console.warn(`Unknown sound: ${soundName}`);
  }
};

/**
 * Option 1: Gentle Ding
 * A soft, pleasant notification chime (single tone)
 */
const playGentleDing = () => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 800; // E5 note
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

/**
 * Option 2: Success Chime
 * A two-tone ascending chime (sounds like success/completion)
 */
const playSuccessChime = () => {
  // First tone (lower)
  const osc1 = audioContext.createOscillator();
  const gain1 = audioContext.createGain();
  osc1.connect(gain1);
  gain1.connect(audioContext.destination);
  osc1.frequency.value = 523; // C5
  osc1.type = 'sine';
  gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  osc1.start(audioContext.currentTime);
  osc1.stop(audioContext.currentTime + 0.3);

  // Second tone (higher, slightly delayed)
  const osc2 = audioContext.createOscillator();
  const gain2 = audioContext.createGain();
  osc2.connect(gain2);
  gain2.connect(audioContext.destination);
  osc2.frequency.value = 659; // E5
  osc2.type = 'sine';
  gain2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  osc2.start(audioContext.currentTime + 0.15);
  osc2.stop(audioContext.currentTime + 0.5);
};

/**
 * Option 3: Soft Bell
 * A single bell-like tone with harmonics
 */
const playSoftBell = () => {
  const fundamental = 880; // A5
  const harmonics = [1, 2, 3]; // Harmonic series
  const now = audioContext.currentTime;

  harmonics.forEach((harmonic, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = fundamental * harmonic;
    oscillator.type = 'sine';

    // Each harmonic decays at different rates
    const volume = 0.2 / (harmonic * 1.5);
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    oscillator.start(now);
    oscillator.stop(now + 0.8);
  });
};

/**
 * Option 4: Triple Beep
 * Three short beeps in succession
 */
const playTripleBeep = () => {
  const beepTimes = [0, 0.15, 0.3]; // Three beeps with 150ms gaps
  const now = audioContext.currentTime;

  beepTimes.forEach((time) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000; // 1kHz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.25, now + time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + time + 0.1);

    oscillator.start(now + time);
    oscillator.stop(now + time + 0.1);
  });
};

/**
 * Option 5: Subtle Pop
 * A quiet, soft pop sound (short noise burst)
 */
const playSubtlePop = () => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 100;
  oscillator.type = 'sine';

  filter.type = 'lowpass';
  filter.frequency.value = 800;

  gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.08);
};

export default {
  playSound,
  playGentleDing,
  playSuccessChime,
  playSoftBell,
  playTripleBeep,
  playSubtlePop
};
