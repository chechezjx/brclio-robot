let context: AudioContext | undefined;
export function unlockSound() {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch {
    /* Audio is an optional enhancement. */
  }
}
export function playTone(success = false) {
  if (!context || context.state !== 'running') return;
  try {
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(success ? 660 : 480, context.currentTime);
    if (success) oscillator.frequency.setValueAtTime(880, context.currentTime + 0.1);
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    /* No sound support must never affect execution. */
  }
}
