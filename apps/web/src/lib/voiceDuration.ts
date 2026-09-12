// FILE: voiceDuration.ts
// Purpose: Formats the elapsed dictation timer shown on the composer mic.
// Layer: Client utility
// Exports: formatVoiceRecordingDuration

export function formatVoiceRecordingDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
