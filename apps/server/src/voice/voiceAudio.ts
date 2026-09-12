// FILE: voiceAudio.ts
// Purpose: Validates a recorded voice clip before anything is done with it.
// Layer: Server utility
// Exports: decodeVoiceAudio, VOICE_MAX_DURATION_MS
// Depends on: node Buffer only.
//
// The validation is strict because the client is the only producer and it
// emits exactly one shape (see the web app's voiceRecorder: 24 kHz mono WAV).
// A single canonical format means this layer validates rather than transcodes,
// and it means the clip that reaches the speech engine on the server's disk
// can never be an arbitrary attacker-chosen file.

import { Buffer } from "node:buffer";

import type { ServerVoiceTranscriptionInput } from "@modesto/contracts";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const VOICE_MAX_DURATION_MS = 120_000;
const REQUIRED_SAMPLE_RATE_HZ = 24_000;

export function decodeVoiceAudio(input: ServerVoiceTranscriptionInput): Buffer {
  if (input.mimeType !== "audio/wav") {
    throw new Error("Only WAV audio is supported for voice transcription.");
  }
  if (input.sampleRateHz !== REQUIRED_SAMPLE_RATE_HZ) {
    throw new Error("Voice transcription requires 24 kHz mono WAV audio.");
  }
  if (input.durationMs <= 0) {
    throw new Error("Voice messages must include a positive duration.");
  }
  if (input.durationMs > VOICE_MAX_DURATION_MS) {
    throw new Error("Voice messages are limited to 120 seconds.");
  }

  const normalizedBase64 = normalizeBase64(input.audioBase64);
  if (!normalizedBase64 || !isLikelyBase64(normalizedBase64)) {
    throw new Error("The recorded audio could not be decoded.");
  }

  // Round-tripping rejects input that decodes lossily - Buffer is forgiving
  // about stray characters, and a clip that does not re-encode to exactly what
  // arrived is not the clip the client recorded.
  const audioBuffer = Buffer.from(normalizedBase64, "base64");
  if (!audioBuffer.length || audioBuffer.toString("base64") !== normalizedBase64) {
    throw new Error("The recorded audio could not be decoded.");
  }
  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new Error("Voice messages are limited to 10 MB.");
  }
  if (!isLikelyWavBuffer(audioBuffer)) {
    throw new Error("The recorded audio is not a valid WAV file.");
  }

  return audioBuffer;
}

function normalizeBase64(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, "");
  return normalized.length > 0 ? normalized : null;
}

function isLikelyBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function isLikelyWavBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  );
}
