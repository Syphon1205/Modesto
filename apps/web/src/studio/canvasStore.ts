import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { ScopedThreadRef } from "@modesto/contracts";
import { create } from "zustand";

import type { CanvasMode } from "./canvasCommand";

interface CanvasStoreState {
  readonly modeByThreadKey: Record<string, CanvasMode>;
  readonly startedByThreadKey: Record<string, boolean>;
  readonly setMode: (ref: ScopedThreadRef, mode: CanvasMode) => void;
  readonly start: (ref: ScopedThreadRef, mode?: CanvasMode) => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  modeByThreadKey: {},
  startedByThreadKey: {},
  setMode: (ref, mode) => {
    const key = scopedThreadKey(ref);
    set((state) => {
      if (state.modeByThreadKey[key] === mode) return state;
      return { modeByThreadKey: { ...state.modeByThreadKey, [key]: mode } };
    });
  },
  start: (ref, mode) => {
    const key = scopedThreadKey(ref);
    set((state) => ({
      startedByThreadKey: { ...state.startedByThreadKey, [key]: true },
      modeByThreadKey: {
        ...state.modeByThreadKey,
        [key]: mode ?? state.modeByThreadKey[key] ?? "dashboard",
      },
    }));
  },
}));

export function selectCanvasMode(ref: ScopedThreadRef | null): CanvasMode {
  if (!ref) return "dashboard";
  return useCanvasStore.getState().modeByThreadKey[scopedThreadKey(ref)] ?? "dashboard";
}
