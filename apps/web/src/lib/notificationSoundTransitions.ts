export type SoundEvent = "started" | "completion" | "attention" | "interruption" | "error";
export interface SoundThreadState {
  key: string;
  turnId: string | null;
  state: string | null;
  attention: boolean;
}

/** Only observed transitions chime: initial hydration and replayed snapshots are silent. */
export function notificationSoundTransition(
  previous: SoundThreadState | undefined,
  next: SoundThreadState,
): SoundEvent | null {
  if (!previous) return null;
  if (next.attention && !previous.attention) return "attention";
  if (next.state === "running" && (previous.state !== "running" || previous.turnId !== next.turnId))
    return "started";
  if (previous.turnId !== next.turnId || previous.state !== "running") return null;
  if (next.state === "error") return "error";
  if (next.state === "interrupted") return "interruption";
  if (next.state === "completed" && !next.attention) return "completion";
  return null;
}
