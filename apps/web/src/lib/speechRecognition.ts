// FILE: speechRecognition.ts
// Purpose: Thin wrapper around the browser's built-in SpeechRecognition API
//          (the system/browser speech service, not a local Whisper model).
// Layer: Client utility
// Exports: getSpeechRecognitionConstructor, collectSpeechTranscript,
//          describeSpeechRecognitionError

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item?: (index: number) => SpeechRecognitionAlternativeLike;
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  item?: (index: number) => SpeechRecognitionResultLike;
  readonly [index: number]: SpeechRecognitionResultLike | undefined;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { readonly results: SpeechRecognitionResultListLike }) => void) | null;
  onerror: ((event: { readonly error: string; readonly message?: string }) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const host = globalThis as typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function resultAt(
  results: SpeechRecognitionResultListLike,
  index: number,
): SpeechRecognitionResultLike | undefined {
  return results.item?.(index) ?? results[index];
}

function alternativeAt(
  result: SpeechRecognitionResultLike,
  index: number,
): SpeechRecognitionAlternativeLike | undefined {
  return result.item?.(index) ?? result[index];
}

/**
 * Concatenates every final result, then the trailing interim result if any.
 *
 * SpeechRecognition reports a growing list: finals stay put, and the last
 * entry is often still interim. Callers that only want committed text should
 * use `finalText`.
 */
export function collectSpeechTranscript(results: SpeechRecognitionResultListLike): {
  readonly finalText: string;
  readonly previewText: string;
} {
  const finals: string[] = [];
  let interim = "";

  for (let index = 0; index < results.length; index += 1) {
    const result = resultAt(results, index);
    if (!result) continue;
    const alternative = alternativeAt(result, 0);
    const piece = alternative?.transcript.trim() ?? "";
    if (piece.length === 0) continue;
    if (result.isFinal) {
      finals.push(piece);
    } else {
      interim = piece;
    }
  }

  const finalText = finals.join(" ").trim();
  const previewText = [finalText, interim]
    .filter((part) => part.length > 0)
    .join(" ")
    .trim();
  return { finalText, previewText };
}

export function describeSpeechRecognitionError(error: unknown): string {
  if (typeof error === "string") {
    return describeSpeechRecognitionErrorName(error);
  }
  const name = error instanceof Error ? error.name : "";
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (name === "NotAllowedError" || /permission|denied|not-allowed/i.test(raw)) {
    return describeSpeechRecognitionErrorName("not-allowed");
  }
  if (name === "NotFoundError" || /no microphone|device not found|audio-capture/i.test(raw)) {
    return describeSpeechRecognitionErrorName("audio-capture");
  }
  if (/network/i.test(raw)) {
    return describeSpeechRecognitionErrorName("network");
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "Speech recognition failed.";
}

export function describeSpeechRecognitionErrorName(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Allow it in your system settings and try again.";
    case "audio-capture":
      return "No microphone was found.";
    case "no-speech":
      return "No speech was detected.";
    case "network":
      return "The system speech service could not be reached. Check your network and try again.";
    case "language-not-supported":
      return "Speech recognition does not support this language.";
    case "aborted":
      return "";
    default:
      return error.trim().length > 0 ? error : "Speech recognition failed.";
  }
}
