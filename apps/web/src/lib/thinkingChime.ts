// FILE: thinkingChime.ts
// Purpose: A short, synthesized two-note chime marking "a turn just started
//          thinking" - not text-to-speech, not a bundled audio asset. Built
//          entirely from the Web Audio API so there is no sound file to
//          source, license, or ship.
// Layer: Chat audio primitive
//
// A rising two-note interval (D5 -> A5, a perfect fifth) rather than a flat
// single beep: a single tone reads as an alert/error in most UI sound
// languages, where a short rising pair reads as "starting" - closer to a
// message-sent chime than a warning.

let sharedContext: AudioContext | null = null;

type AudioContextConstructor = typeof AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  // Safari historically only exposed the prefixed constructor; still checked
  // defensively since this runs in Electron's bundled Chromium too, where it
  // is unnecessary but harmless.
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
  // A freshly constructed context (or one created before any user gesture)
  // starts suspended; resuming an already-running context is a harmless
  // no-op. This call itself only ever happens in response to a turn actually
  // starting, which is downstream of the user having interacted with the
  // page, so autoplay policies are satisfied.
  if (sharedContext.state === "suspended") {
    void sharedContext.resume().catch(() => undefined);
  }
  return sharedContext;
}

function playTone(
  ctx: AudioContext,
  input: {
    readonly frequencyHz: number;
    readonly startOffsetSeconds: number;
    readonly durationSeconds: number;
    readonly peakGain: number;
  },
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = input.frequencyHz;

  const startAt = ctx.currentTime + input.startOffsetSeconds;
  const endAt = startAt + input.durationSeconds;
  // A short linear attack/decay envelope instead of an instant on/off gain
  // step - the step is audible as a hard click at the start and end of the
  // tone, which a synthesized "chime" should not have.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(input.peakGain, startAt + 0.015);
  gain.gain.linearRampToValueAtTime(0, endAt);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  // Stop slightly after the gain reaches zero so the ramp is never cut short.
  oscillator.stop(endAt + 0.02);
}

/**
 * Play the thinking chime once. Silently does nothing where the Web Audio
 * API is unavailable (SSR, an unsupported embedder) rather than throwing -
 * this is a nicety, never something a caller should have to guard.
 */
export function playThinkingChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  // Deliberately quiet (peak gain well under 0.1): this can fire once per
  // turn, so it needs to stay in the background rather than announce itself.
  playTone(ctx, {
    frequencyHz: 587.33 /* D5 */,
    startOffsetSeconds: 0,
    durationSeconds: 0.09,
    peakGain: 0.05,
  });
  playTone(ctx, {
    frequencyHz: 880 /* A5 */,
    startOffsetSeconds: 0.07,
    durationSeconds: 0.12,
    peakGain: 0.045,
  });
}
