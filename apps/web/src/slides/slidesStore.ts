import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { ScopedThreadRef } from "@modesto/contracts";
import { create } from "zustand";

import {
  isStarterSlideDeckMarkdown,
  parseSlideDeck,
  starterSlideDeckMarkdown,
  type SlideDeck,
} from "./slideDeck";
import { shouldApplyRemoteSlideDeck } from "./slideDeckPersist";

interface SlidesStoreState {
  readonly markdownByThreadKey: Record<string, string>;
  readonly sourcePathByThreadKey: Record<string, string | null>;
  readonly indexByThreadKey: Record<string, number>;
  readonly generatingByThreadKey: Record<string, boolean>;
  readonly dirtyByThreadKey: Record<string, boolean>;
  readonly persistedMarkdownByThreadKey: Record<string, string>;
  readonly persistRevisionByThreadKey: Record<string, number>;
  readonly beginBuild: (ref: ScopedThreadRef) => void;
  readonly finishBuild: (ref: ScopedThreadRef) => void;
  readonly setDeck: (ref: ScopedThreadRef, markdown: string, sourcePath?: string | null) => void;
  readonly applyRemoteDeck: (
    ref: ScopedThreadRef,
    markdown: string,
    sourcePath?: string | null,
  ) => "apply" | "ack-echo" | "ignore";
  readonly applyUserDeck: (
    ref: ScopedThreadRef,
    markdown: string,
    sourcePath?: string | null,
  ) => void;
  readonly markPersisted: (
    ref: ScopedThreadRef,
    markdown: string,
    sourcePath?: string | null,
  ) => void;
  readonly setIndex: (ref: ScopedThreadRef, index: number) => void;
}

function clampIndex(markdown: string, index: number): number {
  const count = parseSlideDeck(markdown).slides.length;
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(index)));
}

export const useSlidesStore = create<SlidesStoreState>((set, get) => ({
  markdownByThreadKey: {},
  sourcePathByThreadKey: {},
  indexByThreadKey: {},
  generatingByThreadKey: {},
  dirtyByThreadKey: {},
  persistedMarkdownByThreadKey: {},
  persistRevisionByThreadKey: {},
  beginBuild: (ref) => {
    const key = scopedThreadKey(ref);
    set((state) => ({
      generatingByThreadKey: { ...state.generatingByThreadKey, [key]: true },
    }));
  },
  finishBuild: (ref) => {
    const key = scopedThreadKey(ref);
    set((state) => {
      if (state.generatingByThreadKey[key] !== true) return state;
      return {
        generatingByThreadKey: { ...state.generatingByThreadKey, [key]: false },
      };
    });
  },
  setDeck: (ref, markdown, sourcePath) => {
    const key = scopedThreadKey(ref);
    set((state) => ({
      markdownByThreadKey: { ...state.markdownByThreadKey, [key]: markdown },
      sourcePathByThreadKey: {
        ...state.sourcePathByThreadKey,
        [key]: sourcePath === undefined ? (state.sourcePathByThreadKey[key] ?? null) : sourcePath,
      },
      indexByThreadKey: {
        ...state.indexByThreadKey,
        [key]: clampIndex(markdown, state.indexByThreadKey[key] ?? 0),
      },
      generatingByThreadKey: {
        ...state.generatingByThreadKey,
        [key]: isStarterSlideDeckMarkdown(markdown)
          ? (state.generatingByThreadKey[key] ?? false)
          : false,
      },
      dirtyByThreadKey: { ...state.dirtyByThreadKey, [key]: false },
      persistedMarkdownByThreadKey: {
        ...state.persistedMarkdownByThreadKey,
        [key]: markdown,
      },
    }));
  },
  applyRemoteDeck: (ref, markdown, sourcePath) => {
    const key = scopedThreadKey(ref);
    const state = get();
    const decision = shouldApplyRemoteSlideDeck({
      dirty: state.dirtyByThreadKey[key] === true,
      incoming: markdown,
      current: state.markdownByThreadKey[key],
      persisted: state.persistedMarkdownByThreadKey[key],
    });
    const nextPath =
      sourcePath === undefined ? (state.sourcePathByThreadKey[key] ?? null) : sourcePath;

    if (decision === "ignore") {
      if (nextPath && (state.sourcePathByThreadKey[key] ?? null) !== nextPath) {
        set({
          sourcePathByThreadKey: { ...state.sourcePathByThreadKey, [key]: nextPath },
        });
      }
      return decision;
    }

    if (decision === "ack-echo") {
      set({
        sourcePathByThreadKey: { ...state.sourcePathByThreadKey, [key]: nextPath },
        dirtyByThreadKey: { ...state.dirtyByThreadKey, [key]: false },
        persistedMarkdownByThreadKey: {
          ...state.persistedMarkdownByThreadKey,
          [key]: markdown,
        },
      });
      return decision;
    }

    set({
      markdownByThreadKey: { ...state.markdownByThreadKey, [key]: markdown },
      sourcePathByThreadKey: { ...state.sourcePathByThreadKey, [key]: nextPath },
      indexByThreadKey: {
        ...state.indexByThreadKey,
        [key]: clampIndex(markdown, state.indexByThreadKey[key] ?? 0),
      },
      generatingByThreadKey: {
        ...state.generatingByThreadKey,
        [key]: isStarterSlideDeckMarkdown(markdown)
          ? (state.generatingByThreadKey[key] ?? false)
          : false,
      },
      persistedMarkdownByThreadKey: {
        ...state.persistedMarkdownByThreadKey,
        [key]: markdown,
      },
    });
    return decision;
  },
  applyUserDeck: (ref, markdown, sourcePath) => {
    const key = scopedThreadKey(ref);
    set((state) => ({
      markdownByThreadKey: { ...state.markdownByThreadKey, [key]: markdown },
      sourcePathByThreadKey: {
        ...state.sourcePathByThreadKey,
        [key]: sourcePath === undefined ? (state.sourcePathByThreadKey[key] ?? null) : sourcePath,
      },
      indexByThreadKey: {
        ...state.indexByThreadKey,
        [key]: clampIndex(markdown, state.indexByThreadKey[key] ?? 0),
      },
      dirtyByThreadKey: { ...state.dirtyByThreadKey, [key]: true },
      generatingByThreadKey: { ...state.generatingByThreadKey, [key]: false },
      persistRevisionByThreadKey: {
        ...state.persistRevisionByThreadKey,
        [key]: (state.persistRevisionByThreadKey[key] ?? 0) + 1,
      },
    }));
  },
  markPersisted: (ref, markdown, sourcePath) => {
    const key = scopedThreadKey(ref);
    set((state) => {
      if (state.markdownByThreadKey[key] !== markdown) return state;
      return {
        dirtyByThreadKey: { ...state.dirtyByThreadKey, [key]: false },
        persistedMarkdownByThreadKey: {
          ...state.persistedMarkdownByThreadKey,
          [key]: markdown,
        },
        sourcePathByThreadKey: {
          ...state.sourcePathByThreadKey,
          [key]: sourcePath === undefined ? (state.sourcePathByThreadKey[key] ?? null) : sourcePath,
        },
      };
    });
  },
  setIndex: (ref, index) => {
    const key = scopedThreadKey(ref);
    set((state) => {
      const markdown = state.markdownByThreadKey[key] ?? starterSlideDeckMarkdown();
      return {
        indexByThreadKey: { ...state.indexByThreadKey, [key]: clampIndex(markdown, index) },
      };
    });
  },
}));

export function selectThreadSlideDeck(
  state: SlidesStoreState,
  ref: ScopedThreadRef | null,
): {
  readonly markdown: string;
  readonly sourcePath: string | null;
  readonly index: number;
  readonly deck: SlideDeck;
  readonly generating: boolean;
  readonly isStarter: boolean;
  readonly dirty: boolean;
  readonly persistRevision: number;
} {
  if (!ref) {
    const markdown = starterSlideDeckMarkdown();
    return {
      markdown,
      sourcePath: null,
      index: 0,
      deck: parseSlideDeck(markdown),
      generating: false,
      isStarter: true,
      dirty: false,
      persistRevision: 0,
    };
  }
  const key = scopedThreadKey(ref);
  const markdown = state.markdownByThreadKey[key] ?? starterSlideDeckMarkdown();
  const deck = parseSlideDeck(markdown);
  const index = clampIndex(markdown, state.indexByThreadKey[key] ?? 0);
  return {
    markdown,
    sourcePath: state.sourcePathByThreadKey[key] ?? null,
    index,
    deck,
    generating: state.generatingByThreadKey[key] === true,
    isStarter: isStarterSlideDeckMarkdown(markdown),
    dirty: state.dirtyByThreadKey[key] === true,
    persistRevision: state.persistRevisionByThreadKey[key] ?? 0,
  };
}
