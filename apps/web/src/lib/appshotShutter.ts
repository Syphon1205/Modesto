// FILE: appshotShutter.ts
// Purpose: Short synthesized shutter click when an Appshot lands in the renderer.
// Layer: Chat audio primitive (secondary to main-process afplay)

let sharedContext: AudioContext | null = null;

type AudioContextConstructor = typeof AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ??
    null
  );
}

function getAudioContext(): AudioContext | null {
  const Ctor = resolveAudioContextConstructor();
  if (!Ctor) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new Ctor();
  }
  if (sharedContext.state === "suspended") {
    void sharedContext.resume().catch(() => undefined);
  }
  return sharedContext;
}

/**
 * Brief descending click — distinct from the thinking chime so capture feedback
 * does not read as "turn started". Silently no-ops when Web Audio is unavailable.
 */
export function playAppshotShutter(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const startAt = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(880, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(220, startAt + 0.06);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.08, startAt + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.08);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.1);
}
