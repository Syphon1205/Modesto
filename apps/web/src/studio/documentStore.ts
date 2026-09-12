import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { ScopedThreadRef } from "@modesto/contracts";
import { create } from "zustand";

import { shouldApplyRemoteSlideDeck } from "../slides/slideDeckPersist";
import { isStarterStudioText, starterStudioText, type StudioKind } from "./studioKinds";

function recordKey(kind: StudioKind, ref: ScopedThreadRef): string {
  return `${kind}:${scopedThreadKey(ref)}`;
}

interface StudioDocumentStore {
  readonly textByKey: Record<string, string>;
  readonly sourcePathByKey: Record<string, string | null>;
  readonly generatingByKey: Record<string, boolean>;
  readonly dirtyByKey: Record<string, boolean>;
  readonly persistedByKey: Record<string, string>;
  readonly persistRevisionByKey: Record<string, number>;
  readonly beginBuild: (kind: StudioKind, ref: ScopedThreadRef) => void;
  readonly finishBuild: (kind: StudioKind, ref: ScopedThreadRef) => void;
  readonly setDocument: (
    kind: StudioKind,
    ref: ScopedThreadRef,
    text: string,
    sourcePath?: string | null,
  ) => void;
  readonly applyRemote: (
    kind: StudioKind,
    ref: ScopedThreadRef,
    text: string,
    sourcePath?: string | null,
  ) => "apply" | "ack-echo" | "ignore";
  readonly applyUser: (
    kind: StudioKind,
    ref: ScopedThreadRef,
    text: string,
    sourcePath?: string | null,
  ) => void;
  readonly markPersisted: (
    kind: StudioKind,
    ref: ScopedThreadRef,
    text: string,
    sourcePath?: string | null,
  ) => void;
}

export const useStudioDocumentStore = create<StudioDocumentStore>((set, get) => ({
  textByKey: {},
  sourcePathByKey: {},
  generatingByKey: {},
  dirtyByKey: {},
  persistedByKey: {},
  persistRevisionByKey: {},
  beginBuild: (kind, ref) => {
    const key = recordKey(kind, ref);
    set((state) => ({ generatingByKey: { ...state.generatingByKey, [key]: true } }));
  },
  finishBuild: (kind, ref) => {
    const key = recordKey(kind, ref);
    set((state) => {
      if (state.generatingByKey[key] !== true) return state;
      return { generatingByKey: { ...state.generatingByKey, [key]: false } };
    });
  },
  setDocument: (kind, ref, text, sourcePath) => {
    const key = recordKey(kind, ref);
    set((state) => ({
      textByKey: { ...state.textByKey, [key]: text },
      sourcePathByKey: {
        ...state.sourcePathByKey,
        [key]: sourcePath === undefined ? (state.sourcePathByKey[key] ?? null) : sourcePath,
      },
      generatingByKey: {
        ...state.generatingByKey,
        [key]: isStarterStudioText(kind, text) ? (state.generatingByKey[key] ?? false) : false,
      },
      dirtyByKey: { ...state.dirtyByKey, [key]: false },
      persistedByKey: { ...state.persistedByKey, [key]: text },
    }));
  },
  applyRemote: (kind, ref, text, sourcePath) => {
    const key = recordKey(kind, ref);
    const state = get();
    const decision = shouldApplyRemoteSlideDeck({
      dirty: state.dirtyByKey[key] === true,
      incoming: text,
      current: state.textByKey[key],
      persisted: state.persistedByKey[key],
    });
    const nextPath = sourcePath === undefined ? (state.sourcePathByKey[key] ?? null) : sourcePath;
    if (decision === "ignore") {
      if (nextPath && (state.sourcePathByKey[key] ?? null) !== nextPath) {
        set({ sourcePathByKey: { ...state.sourcePathByKey, [key]: nextPath } });
      }
      return decision;
    }
    if (decision === "ack-echo") {
      set({
        sourcePathByKey: { ...state.sourcePathByKey, [key]: nextPath },
        dirtyByKey: { ...state.dirtyByKey, [key]: false },
        persistedByKey: { ...state.persistedByKey, [key]: text },
      });
      return decision;
    }
    set({
      textByKey: { ...state.textByKey, [key]: text },
      sourcePathByKey: { ...state.sourcePathByKey, [key]: nextPath },
      generatingByKey: {
        ...state.generatingByKey,
        [key]: isStarterStudioText(kind, text) ? (state.generatingByKey[key] ?? false) : false,
      },
      persistedByKey: { ...state.persistedByKey, [key]: text },
    });
    return decision;
  },
  applyUser: (kind, ref, text, sourcePath) => {
    const key = recordKey(kind, ref);
    set((state) => ({
      textByKey: { ...state.textByKey, [key]: text },
      sourcePathByKey: {
        ...state.sourcePathByKey,
        [key]: sourcePath === undefined ? (state.sourcePathByKey[key] ?? null) : sourcePath,
      },
      dirtyByKey: { ...state.dirtyByKey, [key]: true },
      generatingByKey: { ...state.generatingByKey, [key]: false },
      persistRevisionByKey: {
        ...state.persistRevisionByKey,
        [key]: (state.persistRevisionByKey[key] ?? 0) + 1,
      },
    }));
  },
  markPersisted: (kind, ref, text, sourcePath) => {
    const key = recordKey(kind, ref);
    set((state) => {
      if (state.textByKey[key] !== text) return state;
      return {
        dirtyByKey: { ...state.dirtyByKey, [key]: false },
        persistedByKey: { ...state.persistedByKey, [key]: text },
        sourcePathByKey: {
          ...state.sourcePathByKey,
          [key]: sourcePath === undefined ? (state.sourcePathByKey[key] ?? null) : sourcePath,
        },
      };
    });
  },
}));

export function selectStudioDocument(
  state: Pick<
    StudioDocumentStore,
    "textByKey" | "sourcePathByKey" | "generatingByKey" | "dirtyByKey"
  >,
  kind: StudioKind,
  ref: ScopedThreadRef | null,
): {
  readonly text: string;
  readonly sourcePath: string | null;
  readonly generating: boolean;
  readonly dirty: boolean;
  readonly isStarter: boolean;
} {
  if (!ref) {
    const text = starterStudioText(kind);
    return { text, sourcePath: null, generating: false, dirty: false, isStarter: true };
  }
  const key = recordKey(kind, ref);
  const text = state.textByKey[key] ?? starterStudioText(kind);
  return {
    text,
    sourcePath: state.sourcePathByKey[key] ?? null,
    generating: state.generatingByKey[key] === true,
    dirty: state.dirtyByKey[key] === true,
    isStarter: isStarterStudioText(kind, text),
  };
}
