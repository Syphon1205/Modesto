// FILE: speechSynthesis.ts
// Purpose: Thin wrapper around the browser SpeechSynthesis API for reading
//          assistant replies aloud (system TTS — not Whisper / STT).
// Layer: Client utility
// Exports: isSpeechSynthesisSupported, prepareSpeechText,
//          findLatestFinalAssistantReply, createSpeechSynthesisController

export interface SpeakableAssistantMessage {
  readonly id: string;
  readonly role: string;
  readonly text: string;
  readonly streaming: boolean;
}

export interface SpeechSynthesisController {
  readonly speak: (
    text: string,
    options?: {
      readonly lang?: string;
      readonly onStart?: () => void;
      readonly onEnd?: () => void;
      readonly onError?: (error: unknown) => void;
    },
  ) => boolean;
  readonly cancel: () => void;
  readonly isSpeaking: () => boolean;
}

/** Slightly relaxed pacing keeps dense technical replies from sounding clipped. */
export const NATURAL_SPEECH_RATE = 0.94;

const NOVELTY_VOICE_PATTERN =
  /albert|bad news|bahh|bells|boing|bubbles|cellos|fred|good news|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox/i;

// Apple's newer conversational voices are considerably less synthetic than
// its legacy defaults. Premium/enhanced voices still win when the user has
// downloaded one in System Settings.
const NATURAL_VOICE_NAMES = [
  "ava",
  "zoe",
  "allison",
  "susan",
  "tom",
  "flo",
  "reed",
  "sandy",
  "shelley",
  "rocko",
  "eddy",
  "samantha",
  "daniel",
] as const;

/** Pick the strongest installed voice for a locale instead of trusting the browser default. */
export function selectNaturalSpeechVoice(
  voices: ReadonlyArray<SpeechSynthesisVoice>,
  requestedLanguage: string,
): SpeechSynthesisVoice | null {
  const requested = requestedLanguage.toLowerCase();
  const requestedBase = requested.split("-")[0] ?? requested;
  let best: { voice: SpeechSynthesisVoice; score: number } | null = null;
  const compatibleVoices = voices.filter(
    (voice) => (voice.lang.toLowerCase().split("-")[0] ?? "") === requestedBase,
  );
  const exactVoices = compatibleVoices.filter((voice) => voice.lang.toLowerCase() === requested);

  for (const voice of exactVoices.length > 0 ? exactVoices : compatibleVoices) {
    const language = voice.lang.toLowerCase();

    const name = voice.name.toLowerCase();
    let score = language === requested ? 80 : 50;
    if (voice.localService) score += 10;
    if (voice.default) score += 5;
    if (/premium|enhanced|neural|natural/.test(name)) score += 300;
    const preferredIndex = NATURAL_VOICE_NAMES.findIndex((candidate) => name.includes(candidate));
    if (preferredIndex >= 0) score += 180 - preferredIndex * 5;
    if (/compact/.test(name)) score -= 80;
    if (NOVELTY_VOICE_PATTERN.test(name)) score -= 1_000;

    if (best === null || score > best.score) {
      best = { voice, score };
    }
  }

  return best?.voice ?? null;
}

/**
 * Collapses markdown/noise into something tolerable for system TTS.
 * Keeps prose; drops fenced code and common markdown chrome.
 */
export function prepareSpeechText(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");

  // Fenced code blocks (``` … ```), including an optional language tag.
  text = text.replace(/```[\s\S]*?```/g, " ");
  // Inline code.
  text = text.replace(/`([^`]+)`/g, "$1");
  // Images ![alt](url) → alt; links [label](url) → label.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Headings / emphasis / strikethrough markers.
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/~~(.*?)~~/g, "$1");
  // List bullets / numbered markers at line start. Keep the line boundaries
  // for a beat between items; flattening them into spaces makes TTS rush a
  // whole list as though it were one sentence.
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/^\s*>\s?/gm, "");
  text = text.trim();
  text = text.replace(/([.!?:;,])\s*\n+/g, "$1 ");
  text = text.replace(/\n+/g, ". ");
  text = text.replace(/\.\s+([.!?])/g, "$1 ");
  // Collapse whitespace.
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export function isSpeechSynthesisSupported(host: typeof globalThis = globalThis): boolean {
  return (
    typeof host.speechSynthesis !== "undefined" &&
    typeof host.SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Latest assistant message that has finished streaming and has speakable text.
 * Returns null when there is nothing ready to read aloud.
 */
export function findLatestFinalAssistantReply(
  messages: ReadonlyArray<SpeakableAssistantMessage>,
): SpeakableAssistantMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "assistant" || message.streaming) continue;
    if (prepareSpeechText(message.text).length === 0) continue;
    return message;
  }
  return null;
}

/** True when a user message appears after `messageId` in the transcript. */
export function hasUserTurnAfterMessage(
  messages: ReadonlyArray<SpeakableAssistantMessage>,
  messageId: string,
): boolean {
  let seenTarget = false;
  for (const message of messages) {
    if (message.id === messageId) {
      seenTarget = true;
      continue;
    }
    if (seenTarget && message.role === "user") {
      return true;
    }
  }
  return false;
}

export function createSpeechSynthesisController(
  host: typeof globalThis = globalThis,
): SpeechSynthesisController | null {
  if (!isSpeechSynthesisSupported(host)) {
    return null;
  }

  const synthesis = host.speechSynthesis;
  let active: SpeechSynthesisUtterance | null = null;
  let generation = 0;

  const cancel = () => {
    generation += 1;
    active = null;
    try {
      synthesis.cancel();
    } catch {
      // Some engines throw if nothing is queued; ignore.
    }
  };

  const speak: SpeechSynthesisController["speak"] = (rawText, options) => {
    const text = prepareSpeechText(rawText);
    if (text.length === 0) {
      cancel();
      return false;
    }

    cancel();
    const token = generation;
    const utterance = new host.SpeechSynthesisUtterance(text);
    const requestedLanguage = options?.lang ?? host.navigator?.language ?? "en-US";
    const voice = selectNaturalSpeechVoice(synthesis.getVoices(), requestedLanguage);
    utterance.voice = voice;
    utterance.lang = voice?.lang ?? requestedLanguage;
    utterance.rate = NATURAL_SPEECH_RATE;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (token !== generation) return;
      options?.onStart?.();
    };
    utterance.onend = () => {
      if (token !== generation) return;
      active = null;
      options?.onEnd?.();
    };
    utterance.onerror = (event) => {
      if (token !== generation) return;
      active = null;
      // "interrupted" / "canceled" are expected when we cancel for a new turn.
      const errorName =
        typeof event === "object" && event !== null && "error" in event
          ? String((event as { error?: unknown }).error ?? "")
          : "";
      if (errorName === "interrupted" || errorName === "canceled") {
        options?.onEnd?.();
        return;
      }
      options?.onError?.(event);
      options?.onEnd?.();
    };

    active = utterance;
    synthesis.speak(utterance);
    return true;
  };

  return {
    speak,
    cancel,
    isSpeaking: () => active !== null && synthesis.speaking,
  };
}
