import { scopedThreadKey } from "@modesto/client-runtime/environment";
import type { ListeningLibraryPlayback, ScopedThreadRef } from "@modesto/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "~/lib/storage";

import {
  DEFAULT_LISTENING_SERVICE_ID,
  isListeningServiceId,
  type ListeningServiceId,
} from "./listeningServices";
import {
  isActiveListeningPlayback,
  isSameListeningTrack,
  parseGrantedListeningServiceIds,
  type ActiveListeningPlayback,
  withGrantedListeningService,
  withoutGrantedListeningService,
} from "./musicLibraryAccess";

const MUSIC_PLAYER_STORAGE_KEY = "modesto:music-player:v1";

export interface MusicMiniPlayerPosition {
  readonly x: number;
  readonly y: number;
}

interface MusicPlayerStoreState {
  readonly providerId: ListeningServiceId;
  readonly grantedServiceIds: readonly ListeningServiceId[];
  readonly tabIdByThreadKey: Record<string, string>;
  readonly playback: ListeningLibraryPlayback;
  readonly lastPlayback: ActiveListeningPlayback | null;
  readonly sessionHasPlayed: boolean;
  readonly miniPlayerDismissed: boolean;
  readonly miniPlayerPosition: MusicMiniPlayerPosition | null;
  readonly setProviderId: (providerId: ListeningServiceId) => void;
  readonly grantService: (providerId: ListeningServiceId) => void;
  readonly revokeService: (providerId: ListeningServiceId) => void;
  readonly setTabId: (ref: ScopedThreadRef, tabId: string) => void;
  readonly clearTabId: (ref: ScopedThreadRef) => void;
  readonly setPlayback: (playback: ListeningLibraryPlayback) => void;
  readonly dismissMiniPlayer: () => void;
  readonly moveMiniPlayer: (position: MusicMiniPlayerPosition) => void;
}

export const useMusicPlayerStore = create<MusicPlayerStoreState>()(
  persist(
    (set) => ({
      providerId: DEFAULT_LISTENING_SERVICE_ID,
      grantedServiceIds: [],
      tabIdByThreadKey: {},
      playback: { state: "stopped" },
      lastPlayback: null,
      sessionHasPlayed: false,
      miniPlayerDismissed: false,
      miniPlayerPosition: null,
      setProviderId: (providerId) => set({ providerId }),
      grantService: (providerId) =>
        set((state) => ({
          grantedServiceIds: withGrantedListeningService(state.grantedServiceIds, providerId),
        })),
      revokeService: (providerId) =>
        set((state) => ({
          grantedServiceIds: withoutGrantedListeningService(state.grantedServiceIds, providerId),
        })),
      setTabId: (ref, tabId) =>
        set((state) => {
          const threadKey = scopedThreadKey(ref);
          if (state.tabIdByThreadKey[threadKey] === tabId) return state;
          return {
            tabIdByThreadKey: { ...state.tabIdByThreadKey, [threadKey]: tabId },
          };
        }),
      clearTabId: (ref) =>
        set((state) => {
          const threadKey = scopedThreadKey(ref);
          if (!(threadKey in state.tabIdByThreadKey)) return state;
          const { [threadKey]: _removed, ...tabIdByThreadKey } = state.tabIdByThreadKey;
          return { tabIdByThreadKey };
        }),
      setPlayback: (playback) =>
        set((state) => {
          const next =
            isActiveListeningPlayback(playback) &&
            !playback.artworkUrl &&
            state.lastPlayback &&
            isSameListeningTrack(state.lastPlayback, playback)
              ? { ...playback, artworkUrl: state.lastPlayback.artworkUrl }
              : playback;
          return {
            playback: next,
            lastPlayback: isActiveListeningPlayback(next) ? next : state.lastPlayback,
            sessionHasPlayed: state.sessionHasPlayed || isActiveListeningPlayback(next),
            miniPlayerDismissed: next.state === "playing" ? false : state.miniPlayerDismissed,
          };
        }),
      dismissMiniPlayer: () => set({ miniPlayerDismissed: true }),
      moveMiniPlayer: (miniPlayerPosition) => set({ miniPlayerPosition }),
    }),
    {
      name: MUSIC_PLAYER_STORAGE_KEY,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({
        providerId: state.providerId,
        grantedServiceIds: state.grantedServiceIds,
        tabIdByThreadKey: state.tabIdByThreadKey,
        miniPlayerPosition: state.miniPlayerPosition,
      }),
      merge: (persisted, current) => {
        const stored =
          persisted && typeof persisted === "object"
            ? (persisted as Partial<MusicPlayerStoreState>)
            : {};
        return {
          ...current,
          providerId: isListeningServiceId(stored.providerId)
            ? stored.providerId
            : current.providerId,
          grantedServiceIds: parseGrantedListeningServiceIds(stored.grantedServiceIds),
          tabIdByThreadKey:
            stored.tabIdByThreadKey && typeof stored.tabIdByThreadKey === "object"
              ? Object.fromEntries(
                  Object.entries(stored.tabIdByThreadKey).filter(
                    (entry): entry is [string, string] => typeof entry[1] === "string",
                  ),
                )
              : current.tabIdByThreadKey,
          miniPlayerPosition:
            stored.miniPlayerPosition &&
            typeof stored.miniPlayerPosition === "object" &&
            typeof stored.miniPlayerPosition.x === "number" &&
            typeof stored.miniPlayerPosition.y === "number"
              ? stored.miniPlayerPosition
              : current.miniPlayerPosition,
        };
      },
    },
  ),
);

export function musicPreviewTabIdForThread(
  tabIdByThreadKey: Record<string, string>,
  ref: ScopedThreadRef | null | undefined,
): string | null {
  if (!ref) return null;
  return tabIdByThreadKey[scopedThreadKey(ref)] ?? null;
}

export function browserTabIdsExcludingMusic(
  tabIds: readonly string[],
  musicTabId: string | null,
): string[] {
  if (musicTabId === null) return [...tabIds];
  return tabIds.filter((tabId) => tabId !== musicTabId);
}
