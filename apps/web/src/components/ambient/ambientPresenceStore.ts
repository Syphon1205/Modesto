import { create } from "zustand";

import type { AmbientLiveSubagentSummary } from "./ambientBubbles.ts";

const POSITION_STORAGE_KEY = "modesto:ambient-presence-position:v1";

export interface AmbientPresencePosition {
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface AmbientPresenceStoreState {
  /** Live subagent summaries published by ChatView / Agents panel when present. */
  readonly liveSubagents: ReadonlyArray<AmbientLiveSubagentSummary>;
  /** Optional cluster offset from the default top-right anchor (in-app only). */
  readonly position: AmbientPresencePosition | null;
  readonly setLiveSubagents: (summaries: ReadonlyArray<AmbientLiveSubagentSummary>) => void;
  readonly setPosition: (position: AmbientPresencePosition | null) => void;
}

function readPersistedPosition(): AmbientPresencePosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AmbientPresencePosition>;
    if (typeof parsed.offsetX !== "number" || typeof parsed.offsetY !== "number") return null;
    if (!Number.isFinite(parsed.offsetX) || !Number.isFinite(parsed.offsetY)) return null;
    return { offsetX: parsed.offsetX, offsetY: parsed.offsetY };
  } catch {
    return null;
  }
}

function persistPosition(position: AmbientPresencePosition | null): void {
  if (typeof window === "undefined") return;
  try {
    if (position === null) {
      window.localStorage.removeItem(POSITION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Persistence is best-effort; overlay still works without it.
  }
}

/** Ambient presence extras: live subagents, plus the orb's drag offset. */
export const useAmbientPresenceStore = create<AmbientPresenceStoreState>()((set) => ({
  liveSubagents: [],
  position: readPersistedPosition(),
  setLiveSubagents: (summaries) => set({ liveSubagents: summaries }),
  setPosition: (position) => {
    persistPosition(position);
    set({ position });
  },
}));

export function setAmbientLiveSubagents(
  summaries: ReadonlyArray<AmbientLiveSubagentSummary>,
): void {
  useAmbientPresenceStore.getState().setLiveSubagents(summaries);
}
