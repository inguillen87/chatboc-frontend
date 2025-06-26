export const playBeep = (
  frequency = 600,
  duration = 0.15,
  volume = 0.1
) => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // ignore errors
  }
};

export const playOpenSound = () => playBeep(500, 0.18, 0.12);
export const playMessageSound = () => playBeep(620, 0.15, 0.12);
