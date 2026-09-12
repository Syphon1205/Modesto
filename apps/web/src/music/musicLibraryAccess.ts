import type {
  DesktopListeningLibrary,
  ListeningLibraryPlayback,
  ListeningServiceId,
} from "@modesto/contracts";

import {
  isListeningServiceId,
  LISTENING_SERVICES,
  type ListeningService,
} from "./listeningServices";

export function parseGrantedListeningServiceIds(value: unknown): ListeningServiceId[] {
  if (!Array.isArray(value)) return [];
  const ids: ListeningServiceId[] = [];
  for (const entry of value) {
    if (isListeningServiceId(entry) && !ids.includes(entry)) ids.push(entry);
  }
  return ids;
}

export function isListeningLibraryGranted(
  granted: readonly ListeningServiceId[],
  id: ListeningServiceId,
): boolean {
  return granted.includes(id);
}

export function withGrantedListeningService(
  granted: readonly ListeningServiceId[],
  id: ListeningServiceId,
): ListeningServiceId[] {
  if (granted.includes(id)) return [...granted];
  return [...granted, id];
}

export function withoutGrantedListeningService(
  granted: readonly ListeningServiceId[],
  id: ListeningServiceId,
): ListeningServiceId[] {
  return granted.filter((candidate) => candidate !== id);
}

export function preferredListeningPlaylistId(
  playlists: ReadonlyArray<{ readonly id: string; readonly name: string }>,
): string | null {
  const favorite =
    playlists.find((playlist) => playlist.name === "Favorite Songs") ??
    playlists.find((playlist) => playlist.name === "Recently Added") ??
    playlists.find((playlist) => playlist.id !== "library");
  return favorite?.id ?? playlists[0]?.id ?? null;
}

export function formatListeningTrackDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatListeningRemaining(positionSeconds: number, durationSeconds: number): string {
  if (durationSeconds <= 0) return "0:00";
  return `-${formatListeningTrackDuration(Math.max(0, durationSeconds - positionSeconds))}`;
}

export function listeningPlaybackProgress(
  positionSeconds: number,
  durationSeconds: number,
): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, positionSeconds / durationSeconds));
}

export function isSameListeningTrack(
  left: { readonly title: string; readonly artist: string; readonly trackId?: string | null },
  right: {
    readonly title: string;
    readonly artist: string;
    readonly id?: string;
    readonly trackId?: string | null;
  },
): boolean {
  const rightId = right.trackId ?? right.id ?? null;
  if (left.trackId && rightId) return left.trackId === rightId;
  return left.title === right.title && left.artist === right.artist;
}

export function interpolateListeningPosition(
  playback: {
    readonly state: "playing" | "paused";
    readonly positionSeconds: number;
    readonly durationSeconds: number;
  },
  sampledAtMs: number,
  nowMs: number,
): number {
  const base = Math.max(0, playback.positionSeconds);
  if (playback.state !== "playing") return base;
  const next = base + Math.max(0, nowMs - sampledAtMs) / 1000;
  if (playback.durationSeconds > 0) return Math.min(playback.durationSeconds, next);
  return next;
}

export function shouldResampleListeningPosition(input: {
  readonly previous: {
    readonly state: string;
    readonly title: string;
    readonly artist: string;
    readonly positionSeconds: number;
    readonly sampledAtMs: number;
    readonly durationSeconds: number;
  };
  readonly next: {
    readonly state: string;
    readonly title: string;
    readonly artist: string;
    readonly positionSeconds: number;
    readonly durationSeconds: number;
  };
  readonly nowMs: number;
}): boolean {
  if (input.previous.state !== input.next.state) return true;
  if (input.previous.title !== input.next.title || input.previous.artist !== input.next.artist) {
    return true;
  }
  const interpolated = interpolateListeningPosition(
    {
      state: input.previous.state === "playing" ? "playing" : "paused",
      positionSeconds: input.previous.positionSeconds,
      durationSeconds: input.next.durationSeconds || input.previous.durationSeconds,
    },
    input.previous.sampledAtMs,
    input.nowMs,
  );
  // Music.app samples are late and often whole seconds. Ignore small drift so
  // the bar never snaps backward; only treat a real seek as a new sample.
  return Math.abs(interpolated - input.next.positionSeconds) >= 2.5;
}

export type ActiveListeningPlayback = Extract<
  ListeningLibraryPlayback,
  { readonly state: "playing" | "paused" }
>;

export function isActiveListeningPlayback(
  playback: ListeningLibraryPlayback,
): playback is ActiveListeningPlayback {
  return playback.state === "playing" || playback.state === "paused";
}

export function shouldShowMusicMiniPlayer(input: {
  readonly granted: boolean;
  readonly nativeLibrary: boolean;
  readonly playback: ListeningLibraryPlayback;
  readonly lastPlayback: ActiveListeningPlayback | null;
  readonly sessionHasPlayed: boolean;
  readonly dismissed: boolean;
  readonly musicPanelVisible: boolean;
}): boolean {
  if (!input.granted || !input.nativeLibrary || input.dismissed || input.musicPanelVisible) {
    return false;
  }
  if (isActiveListeningPlayback(input.playback)) return true;
  return input.sessionHasPlayed && input.lastPlayback !== null;
}

function artworkForPlayback(
  playback: ActiveListeningPlayback,
  tracks: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly artist: string;
    readonly artworkUrl: string | null;
  }>,
): string | null {
  if (playback.artworkUrl) return playback.artworkUrl;
  const byId = playback.trackId
    ? tracks.find((track) => track.id === playback.trackId)?.artworkUrl
    : undefined;
  if (byId) return byId;
  return (
    tracks.find((track) => track.title === playback.title && track.artist === playback.artist)
      ?.artworkUrl ?? null
  );
}

export function resolveMusicNowPlaying(input: {
  readonly playback: ListeningLibraryPlayback;
  readonly lastPlayback: ActiveListeningPlayback | null;
  readonly tracks: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly artist: string;
    readonly album: string;
    readonly durationSeconds: number;
    readonly artworkUrl: string | null;
  }>;
}): ActiveListeningPlayback | null {
  const active = isActiveListeningPlayback(input.playback) ? input.playback : input.lastPlayback;
  if (active) {
    return { ...active, artworkUrl: artworkForPlayback(active, input.tracks) };
  }
  const first = input.tracks[0];
  if (!first) return null;
  return {
    state: "paused",
    title: first.title,
    artist: first.artist,
    album: first.album,
    durationSeconds: first.durationSeconds,
    positionSeconds: 0,
    trackId: first.id,
    artworkUrl: first.artworkUrl,
  };
}

export function musicNowPlayingStatus(input: {
  readonly playback: ListeningLibraryPlayback;
  readonly display: ActiveListeningPlayback | null;
}): "playing" | "paused" | "last-played" | "up-next" | "idle" {
  if (isActiveListeningPlayback(input.playback)) {
    return input.playback.state === "playing" ? "playing" : "paused";
  }
  if (!input.display) return "idle";
  if (input.display.positionSeconds > 0) return "last-played";
  return "up-next";
}

export function partitionListeningServices(
  libraries: readonly DesktopListeningLibrary[] | null,
  services: readonly ListeningService[] = LISTENING_SERVICES,
): {
  readonly detected: readonly ListeningService[];
  readonly other: readonly ListeningService[];
  readonly detectionAvailable: boolean;
} {
  if (libraries === null) {
    return { detected: [], other: services, detectionAvailable: false };
  }
  const installed = new Set(
    libraries.filter((library) => library.installed).map((library) => library.id),
  );
  return {
    detectionAvailable: true,
    detected: services.filter((service) => installed.has(service.id)),
    other: services.filter((service) => !installed.has(service.id)),
  };
}
