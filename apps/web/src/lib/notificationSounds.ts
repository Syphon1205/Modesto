import type { DesktopSystemSound } from "@modesto/contracts";

export interface SoundOption {
  readonly id: string;
  readonly label: string;
}

export const OPEN_CODE_SOUND_OPTIONS: readonly SoundOption[] = [
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `alert-${String(i + 1).padStart(2, "0")}`,
    label: `Alert ${i + 1}`,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `bip-bop-${String(i + 1).padStart(2, "0")}`,
    label: `Bip bop ${i + 1}`,
  })),
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `staplebops-${String(i + 1).padStart(2, "0")}`,
    label: `Staplebops ${i + 1}`,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `nope-${String(i + 1).padStart(2, "0")}`,
    label: `Nope ${i + 1}`,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `yup-${String(i + 1).padStart(2, "0")}`,
    label: `Yup ${i + 1}`,
  })),
];

export const MODESTO_SOUND_OPTIONS: readonly SoundOption[] = [
  { id: "modesto-start", label: "Start — Lift" },
  { id: "modesto-start-spark", label: "Start — Spark" },
  { id: "modesto-start-launch", label: "Start — Launch" },
  { id: "modesto-start-pulse", label: "Start — Pulse" },
  { id: "modesto-start-uplift", label: "Start — Uplift" },
  { id: "modesto-complete", label: "Complete — Resolve" },
  { id: "modesto-complete-bright", label: "Complete — Bright" },
  { id: "modesto-complete-cascade", label: "Complete — Cascade" },
  { id: "modesto-complete-fanfare", label: "Complete — Fanfare" },
  { id: "modesto-complete-clear", label: "Complete — Clear" },
  { id: "modesto-attention", label: "Needs input — Ask" },
  { id: "modesto-attention-knock", label: "Needs input — Knock" },
  { id: "modesto-attention-signal", label: "Needs input — Signal" },
  { id: "modesto-attention-rising", label: "Needs input — Rising" },
  { id: "modesto-attention-urgent", label: "Needs input — Urgent" },
  { id: "modesto-interrupted", label: "Interrupted — Drop" },
  { id: "modesto-interrupted-cutoff", label: "Interrupted — Cutoff" },
  { id: "modesto-interrupted-descending", label: "Interrupted — Descending" },
  { id: "modesto-interrupted-halt", label: "Interrupted — Halt" },
  { id: "modesto-interrupted-timeout", label: "Interrupted — Timeout" },
  { id: "modesto-error", label: "Error — Fault" },
  { id: "modesto-error-alarm", label: "Error — Alarm" },
  { id: "modesto-error-critical", label: "Error — Critical" },
  { id: "modesto-error-denied", label: "Error — Denied" },
  { id: "modesto-error-retry", label: "Error — Retry" },
  // Existing saved choices remain valid after the catalog becomes event-led.
  { id: "modesto-tap", label: "Legacy — Tap" },
  { id: "modesto-chime", label: "Legacy — Chime" },
  { id: "modesto-soft", label: "Legacy — Soft" },
  { id: "modesto-radar", label: "Legacy — Radar" },
];

const SYSTEM_SOUND_IDS = [
  "basso",
  "funk",
  "glass",
  "hero",
  "ping",
  "pop",
  "purr",
  "sosumi",
  "submarine",
  "tink",
] as const satisfies readonly DesktopSystemSound[];

export const SYSTEM_SOUND_OPTIONS: readonly SoundOption[] = SYSTEM_SOUND_IDS.map((id) => ({
  id: `system-${id}`,
  label: `System — ${id.charAt(0).toUpperCase()}${id.slice(1)}`,
}));

export const SOUND_OPTION_GROUPS = [
  { label: "OpenCode", options: OPEN_CODE_SOUND_OPTIONS },
  { label: "Modesto", options: MODESTO_SOUND_OPTIONS },
  { label: "System", options: SYSTEM_SOUND_OPTIONS },
] as const;

export const SOUND_OPTIONS: readonly SoundOption[] = SOUND_OPTION_GROUPS.flatMap(
  ({ options }) => options,
);

interface Tone {
  readonly frequency: number;
  readonly at: number;
  readonly duration: number;
  readonly gain?: number;
  readonly type?: OscillatorType;
}

const TONE_PATTERNS: Record<string, readonly Tone[]> = {
  "modesto-start": [
    { frequency: 261.63, at: 0, duration: 0.18, gain: 0.026 },
    { frequency: 329.63, at: 0.09, duration: 0.24, gain: 0.025 },
  ],
  "modesto-start-spark": [
    { frequency: 523.25, at: 0, duration: 0.1, gain: 0.032 },
    { frequency: 659.25, at: 0.07, duration: 0.16, gain: 0.029 },
  ],
  "modesto-start-launch": [
    { frequency: 220, at: 0, duration: 0.12, gain: 0.03, type: "triangle" },
    { frequency: 329.63, at: 0.07, duration: 0.13, gain: 0.028, type: "triangle" },
    { frequency: 440, at: 0.14, duration: 0.2, gain: 0.026 },
  ],
  "modesto-start-pulse": [
    { frequency: 392, at: 0, duration: 0.08, gain: 0.03, type: "square" },
    { frequency: 392, at: 0.12, duration: 0.08, gain: 0.027, type: "square" },
    { frequency: 523.25, at: 0.24, duration: 0.14, gain: 0.025 },
  ],
  "modesto-start-uplift": [
    { frequency: 293.66, at: 0, duration: 0.16, gain: 0.028 },
    { frequency: 440, at: 0.08, duration: 0.18, gain: 0.026 },
    { frequency: 587.33, at: 0.16, duration: 0.24, gain: 0.024 },
  ],
  "modesto-complete": [
    { frequency: 392, at: 0, duration: 0.2, gain: 0.028 },
    { frequency: 523.25, at: 0.1, duration: 0.3, gain: 0.026 },
  ],
  "modesto-complete-bright": [
    { frequency: 659.25, at: 0, duration: 0.16, gain: 0.029 },
    { frequency: 783.99, at: 0.1, duration: 0.26, gain: 0.026 },
  ],
  "modesto-complete-cascade": [
    { frequency: 523.25, at: 0, duration: 0.12, gain: 0.027 },
    { frequency: 659.25, at: 0.08, duration: 0.12, gain: 0.025 },
    { frequency: 783.99, at: 0.16, duration: 0.24, gain: 0.023 },
  ],
  "modesto-complete-fanfare": [
    { frequency: 392, at: 0, duration: 0.11, gain: 0.03, type: "triangle" },
    { frequency: 493.88, at: 0.1, duration: 0.11, gain: 0.028, type: "triangle" },
    { frequency: 587.33, at: 0.2, duration: 0.24, gain: 0.025 },
  ],
  "modesto-complete-clear": [
    { frequency: 440, at: 0, duration: 0.2, gain: 0.027 },
    { frequency: 659.25, at: 0.12, duration: 0.28, gain: 0.024 },
  ],
  "modesto-attention": [
    { frequency: 349.23, at: 0, duration: 0.16, gain: 0.027 },
    { frequency: 440, at: 0.18, duration: 0.2, gain: 0.025 },
  ],
  "modesto-attention-knock": [
    { frequency: 392, at: 0, duration: 0.07, gain: 0.032, type: "square" },
    { frequency: 392, at: 0.13, duration: 0.07, gain: 0.03, type: "square" },
  ],
  "modesto-attention-signal": [
    { frequency: 523.25, at: 0, duration: 0.1, gain: 0.028 },
    { frequency: 523.25, at: 0.16, duration: 0.1, gain: 0.026 },
    { frequency: 659.25, at: 0.32, duration: 0.18, gain: 0.024 },
  ],
  "modesto-attention-rising": [
    { frequency: 329.63, at: 0, duration: 0.14, gain: 0.028, type: "triangle" },
    { frequency: 440, at: 0.12, duration: 0.16, gain: 0.026, type: "triangle" },
    { frequency: 523.25, at: 0.24, duration: 0.2, gain: 0.024, type: "triangle" },
  ],
  "modesto-attention-urgent": [
    { frequency: 587.33, at: 0, duration: 0.09, gain: 0.03, type: "square" },
    { frequency: 587.33, at: 0.15, duration: 0.09, gain: 0.028, type: "square" },
    { frequency: 587.33, at: 0.3, duration: 0.12, gain: 0.026, type: "square" },
  ],
  "modesto-interrupted": [
    { frequency: 329.63, at: 0, duration: 0.18, gain: 0.024 },
    { frequency: 293.66, at: 0.1, duration: 0.25, gain: 0.021 },
  ],
  "modesto-interrupted-cutoff": [
    { frequency: 440, at: 0, duration: 0.11, gain: 0.027, type: "triangle" },
    { frequency: 293.66, at: 0.09, duration: 0.22, gain: 0.025, type: "triangle" },
  ],
  "modesto-interrupted-descending": [
    { frequency: 523.25, at: 0, duration: 0.12, gain: 0.026 },
    { frequency: 392, at: 0.1, duration: 0.12, gain: 0.024 },
    { frequency: 261.63, at: 0.2, duration: 0.2, gain: 0.022 },
  ],
  "modesto-interrupted-halt": [
    { frequency: 349.23, at: 0, duration: 0.12, gain: 0.03, type: "square" },
    { frequency: 220, at: 0.15, duration: 0.2, gain: 0.026, type: "square" },
  ],
  "modesto-interrupted-timeout": [
    { frequency: 329.63, at: 0, duration: 0.08, gain: 0.027, type: "triangle" },
    { frequency: 293.66, at: 0.12, duration: 0.08, gain: 0.025, type: "triangle" },
    { frequency: 261.63, at: 0.24, duration: 0.16, gain: 0.023, type: "triangle" },
  ],
  "modesto-error": [
    { frequency: 261.63, at: 0, duration: 0.2, gain: 0.027, type: "triangle" },
    { frequency: 220, at: 0.11, duration: 0.3, gain: 0.023, type: "triangle" },
  ],
  "modesto-error-alarm": [
    { frequency: 659.25, at: 0, duration: 0.1, gain: 0.031, type: "square" },
    { frequency: 523.25, at: 0.12, duration: 0.1, gain: 0.03, type: "square" },
    { frequency: 659.25, at: 0.24, duration: 0.14, gain: 0.028, type: "square" },
  ],
  "modesto-error-critical": [
    { frequency: 220, at: 0, duration: 0.1, gain: 0.034, type: "sawtooth" },
    { frequency: 220, at: 0.14, duration: 0.1, gain: 0.032, type: "sawtooth" },
    { frequency: 196, at: 0.28, duration: 0.22, gain: 0.03, type: "sawtooth" },
  ],
  "modesto-error-denied": [
    { frequency: 392, at: 0, duration: 0.13, gain: 0.031, type: "square" },
    { frequency: 261.63, at: 0.13, duration: 0.24, gain: 0.029, type: "square" },
  ],
  "modesto-error-retry": [
    { frequency: 493.88, at: 0, duration: 0.08, gain: 0.03, type: "triangle" },
    { frequency: 493.88, at: 0.12, duration: 0.08, gain: 0.028, type: "triangle" },
    { frequency: 349.23, at: 0.26, duration: 0.2, gain: 0.027, type: "triangle" },
  ],
  "modesto-tap": [{ frequency: 440, at: 0, duration: 0.08, gain: 0.035 }],
  "modesto-chime": [
    { frequency: 392, at: 0, duration: 0.18, gain: 0.03 },
    { frequency: 587.33, at: 0.1, duration: 0.3, gain: 0.027 },
  ],
  "modesto-soft": [
    { frequency: 293.66, at: 0, duration: 0.22, gain: 0.022 },
    { frequency: 392, at: 0.09, duration: 0.32, gain: 0.02 },
  ],
  "modesto-radar": [
    { frequency: 440, at: 0, duration: 0.09, gain: 0.029 },
    { frequency: 587.33, at: 0.13, duration: 0.09, gain: 0.027 },
    { frequency: 440, at: 0.26, duration: 0.13, gain: 0.024 },
  ],
};
const MAX_SYNTH_GAIN = 0.04;

let playingAudio: HTMLAudioElement | undefined;
let sharedContext: AudioContext | undefined;
const activeOscillators = new Set<OscillatorNode>();
const audioCache = new Map<string, HTMLAudioElement>();
let playbackGeneration = 0;

function stopSynthesizedSound() {
  for (const oscillator of activeOscillators) {
    oscillator.onended = null;
    try {
      oscillator.stop();
    } catch {
      // It may have naturally ended between iteration and stop().
    }
    oscillator.disconnect();
  }
  activeOscillators.clear();
}

export function stopNotificationSound() {
  playbackGeneration += 1;
  playingAudio?.pause();
  if (playingAudio) playingAudio.currentTime = 0;
  playingAudio = undefined;
  stopSynthesizedSound();
}

function getAudioContext(): AudioContext | undefined {
  if (typeof AudioContext === "undefined") return undefined;
  sharedContext ??= new AudioContext({ latencyHint: "interactive" });
  return sharedContext;
}

export async function primeNotificationAudio(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;
  try {
    await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function preloadNotificationSound(id: string): void {
  if (
    typeof Audio === "undefined" ||
    !OPEN_CODE_SOUND_OPTIONS.some((sound) => sound.id === id) ||
    audioCache.has(id)
  )
    return;
  const audio = new Audio(`${import.meta.env.BASE_URL}sounds/opencode/${id}.mp3`);
  audio.preload = "auto";
  audio.load();
  audioCache.set(id, audio);
}

async function playTonePattern(
  pattern: readonly Tone[],
  volume: number,
  generation: number,
): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;
  try {
    await context.resume();
    if (generation !== playbackGeneration) return false;
    const baseTime = context.currentTime + 0.003;
    const volumeScale = Math.min(1, Math.max(0, volume / 100));
    for (const tone of pattern) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type ?? "sine";
      oscillator.frequency.value = tone.frequency;
      const start = baseTime + tone.at;
      const end = start + tone.duration;
      gain.gain.setValueAtTime(0.0001, start);
      const peakGain = Math.min(MAX_SYNTH_GAIN, tone.gain ?? 0.025) * volumeScale;
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(context.destination);
      activeOscillators.add(oscillator);
      oscillator.onended = () => {
        activeOscillators.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(end + 0.01);
    }
    return true;
  } catch {
    stopSynthesizedSound();
    return false;
  }
}

async function playSystemSound(id: string, volume: number, generation: number): Promise<boolean> {
  const systemId = id.slice("system-".length) as DesktopSystemSound;
  if (!SYSTEM_SOUND_IDS.includes(systemId)) return false;
  try {
    if (await window.desktopBridge?.playSystemSound?.(systemId, volume)) return true;
  } catch {
    // A browser fallback keeps previews useful with an older desktop shell.
  }
  if (generation !== playbackGeneration) return false;
  const index = SYSTEM_SOUND_IDS.indexOf(systemId);
  return playTonePattern(
    [{ frequency: 320 + index * 32, at: 0, duration: 0.16, gain: 0.025 }],
    volume,
    generation,
  );
}

/** Lazy audio loading; one web voice avoids overlapping previews and simultaneous alerts. */
export async function playNotificationSound(id: string, volume: number): Promise<boolean> {
  stopNotificationSound();
  const generation = playbackGeneration;
  if (
    typeof window === "undefined" ||
    volume <= 0 ||
    !SOUND_OPTIONS.some((sound) => sound.id === id)
  )
    return false;
  if (id.startsWith("system-")) return playSystemSound(id, volume, generation);
  const pattern = TONE_PATTERNS[id];
  if (pattern) return playTonePattern(pattern, volume, generation);
  if (typeof Audio === "undefined") return false;
  preloadNotificationSound(id);
  const cachedAudio = audioCache.get(id);
  if (!cachedAudio) return false;
  const audio = cachedAudio.cloneNode() as HTMLAudioElement;
  audio.preload = "auto";
  playingAudio = audio;
  audio.currentTime = 0;
  audio.volume = Math.min(1, Math.max(0, volume / 100));
  audio.onended = () => {
    if (playingAudio === audio) playingAudio = undefined;
  };
  try {
    await audio.play();
    return generation === playbackGeneration;
  } catch {
    if (playingAudio === audio) playingAudio = undefined;
    return false;
  }
}
