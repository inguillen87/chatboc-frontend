let audioCtx: AudioContext | null = null;
let isAudioContextInitialized = false;

const initializeAudioContext = () => {
  if (typeof window !== 'undefined' && !audioCtx) {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        // Check if context is suspended, and resume if necessary
        // This is often needed if it's created before a user gesture
        if (audioCtx.state === 'suspended') {
          // Resume will be attempted on first sound play after user gesture
        }
        isAudioContextInitialized = true; // Mark that we tried to init
      }
    } catch (e) {
      console.error("Error initializing AudioContext:", e);
      audioCtx = null; // Ensure it's null if init failed
      isAudioContextInitialized = true; // Still mark as init attempted to avoid retries
    }
  }
  return audioCtx;
};

// Function to be called on first user gesture
export const resumeAudioContext = async () => {
  if (!audioCtx) {
    initializeAudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (e) {
      console.error("Error resuming AudioContext:", e);
    }
  }
};

export const playBeep = (
  frequency = 600,
  duration = 0.15,
  volume = 0.1
) => {
  if (typeof window === 'undefined') return;

  // Initialize or get existing AudioContext
  // We don't call resumeAudioContext directly here on every beep,
  // it should be called by a user gesture first.
  // However, initializeAudioContext will create it if not present.
  const ctx = initializeAudioContext();

  if (!ctx || ctx.state !== 'running') {
    // If context is not running (e.g. suspended and not yet resumed, or failed to init),
    // do not attempt to play sound, or log a warning.
    // The warning from the browser about suspended context is usually sufficient.
    if (ctx && ctx.state === 'suspended' && isAudioContextInitialized) {
        // This specific console log can be helpful during development
        // console.warn("AudioContext is suspended. Sound will not play until a user gesture resumes it.");
    }
    return;
  }

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime); // Start immediately
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error("Error playing beep:", e);
  }
};

export const playOpenSound = () => playBeep(500, 0.18, 0.12);
export const playMessageSound = () => playBeep(620, 0.15, 0.12);
export const playProactiveSound = () => playBeep(700, 0.1, 0.08); // Un beep ligeramente más agudo y corto/suave
