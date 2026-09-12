import { AsyncResult } from "effect/unstable/reactivity";
import type {
  ListeningLibraryPlayback,
  ListeningLibraryPlaylist,
  ListeningLibraryTrack,
  ListeningServiceId,
  ScopedThreadRef,
} from "@modesto/contracts";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AlbumCover } from "~/components/music/AlbumCover";
import { MusicNowPlayingBar } from "~/components/music/MusicNowPlayingBar";
import { Button } from "~/components/ui/button";
import {
  formatListeningTrackDuration,
  isActiveListeningPlayback,
  isSameListeningTrack,
  musicNowPlayingStatus,
  preferredListeningPlaylistId,
  resolveMusicNowPlaying,
} from "~/music/musicLibraryAccess";
import { listeningPlaybackPollMs } from "~/music/useDisplayedListeningPosition";
import { useMusicPlayerStore } from "~/music/musicPlayerStore";
import { cn } from "~/lib/utils";
import {
  listeningControl,
  listeningListPlaylists,
  listeningListTracks,
  listeningPlayback,
} from "~/state/listening";
import { useAtomCommand } from "~/state/use-atom-command";

function rpcFailed(result: Awaited<ReturnType<ReturnType<typeof useAtomCommand>>>): string | null {
  if (AsyncResult.isSuccess(result)) return null;
  return "Could not read your Music library.";
}

function trackSubtitle(track: ListeningLibraryTrack): string {
  return [track.artist, track.album, track.year ? String(track.year) : null]
    .filter(Boolean)
    .join(" · ");
}

export function MusicLibraryBrowser({
  threadRef,
  serviceId,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly serviceId: ListeningServiceId;
}) {
  const environmentId = threadRef.environmentId;
  const listPlaylists = useAtomCommand(listeningListPlaylists, { reportFailure: false });
  const listTracks = useAtomCommand(listeningListTracks, { reportFailure: false });
  const control = useAtomCommand(listeningControl, { reportFailure: false });
  const playback = useAtomCommand(listeningPlayback, { reportFailure: false });

  const setPlayback = useMusicPlayerStore((state) => state.setPlayback);
  const lastPlayback = useMusicPlayerStore((state) => state.lastPlayback);
  const [playlists, setPlaylists] = useState<readonly ListeningLibraryPlaylist[]>([]);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<readonly ListeningLibraryTrack[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<ListeningLibraryPlayback>({ state: "stopped" });
  const [error, setError] = useState<string | null>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    setError(null);
    try {
      const desktop = window.desktopBridge?.listListeningLibraryPlaylists;
      const listed = desktop
        ? await desktop(serviceId)
        : await (async () => {
            const result = await listPlaylists({ environmentId, input: { id: serviceId } });
            if (!AsyncResult.isSuccess(result)) throw new Error(rpcFailed(result) ?? "Failed");
            return result.value;
          })();
      if (!listed.native) {
        setUnsupported(true);
        return;
      }
      setPlaylists(listed.playlists);
      setPlaylistId((current) => current ?? preferredListeningPlaylistId(listed.playlists));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read your Music library.");
    } finally {
      setLoadingPlaylists(false);
    }
  }, [environmentId, listPlaylists, serviceId]);

  const loadTracks = useCallback(
    async (nextPlaylistId: string) => {
      setLoadingTracks(true);
      try {
        const desktop = window.desktopBridge?.listListeningLibraryTracks;
        const listed = desktop
          ? await desktop(serviceId, nextPlaylistId)
          : await (async () => {
              const result = await listTracks({
                environmentId,
                input: { id: serviceId, playlistId: nextPlaylistId },
              });
              if (!AsyncResult.isSuccess(result)) throw new Error(rpcFailed(result) ?? "Failed");
              return result.value;
            })();
        setTracks(listed.tracks);
        setTruncated(listed.truncated);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load songs.");
      } finally {
        setLoadingTracks(false);
      }
    },
    [environmentId, listTracks, serviceId],
  );

  const applyPlayback = useCallback(
    (listed: ListeningLibraryPlayback) => {
      setNowPlaying(listed);
      setPlayback(listed);
    },
    [setPlayback],
  );

  const refreshPlayback = useCallback(async () => {
    try {
      const desktop = window.desktopBridge?.getListeningLibraryPlayback;
      const listed = desktop
        ? await desktop(serviceId)
        : await (async () => {
            const result = await playback({ environmentId, input: { id: serviceId } });
            if (!AsyncResult.isSuccess(result)) return null;
            return result.value;
          })();
      if (listed) applyPlayback(listed);
    } catch {
      // Now playing is best-effort; the song list is the surface that matters.
    }
  }, [applyPlayback, environmentId, playback, serviceId]);

  const runControl = useCallback(
    async (input: {
      action: "play" | "playPlaylist" | "pause" | "resume" | "next" | "previous" | "seek";
      playlistId?: string | undefined;
      trackId?: string;
      positionSeconds?: number;
      optimistic?: ListeningLibraryPlayback;
    }) => {
      if (input.optimistic) applyPlayback(input.optimistic);
      const payload = {
        id: serviceId,
        action: input.action,
        ...(input.playlistId ? { playlistId: input.playlistId } : {}),
        ...(input.trackId ? { trackId: input.trackId } : {}),
        ...(typeof input.positionSeconds === "number"
          ? { positionSeconds: input.positionSeconds }
          : {}),
      };
      try {
        const desktop = window.desktopBridge?.controlListeningLibrary;
        if (desktop) {
          await desktop(payload);
        } else {
          const result = await control({
            environmentId,
            input: payload,
          });
          if (!AsyncResult.isSuccess(result)) {
            throw new Error("Music didn’t switch tracks.");
          }
        }
        await refreshPlayback();
      } catch {
        await refreshPlayback();
      }
    },
    [applyPlayback, control, environmentId, refreshPlayback, serviceId],
  );

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    if (!playlistId) return;
    void loadTracks(playlistId);
  }, [loadTracks, playlistId]);

  useEffect(() => {
    if (unsupported || loadingPlaylists || error) return;
    void refreshPlayback();
    const interval = window.setInterval(
      () => void refreshPlayback(),
      listeningPlaybackPollMs(nowPlaying.state),
    );
    return () => window.clearInterval(interval);
  }, [error, loadingPlaylists, nowPlaying.state, refreshPlayback, unsupported]);

  const display = resolveMusicNowPlaying({
    playback: nowPlaying,
    lastPlayback,
    tracks,
  });
  const liveTrack = isActiveListeningPlayback(nowPlaying) ? nowPlaying : lastPlayback;
  const playing = nowPlaying.state === "playing";
  const status = musicNowPlayingStatus({ playback: nowPlaying, display });
  const selected = playlists.find((playlist) => playlist.id === playlistId) ?? null;

  if (unsupported) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          This Mac’s Music library isn’t available here. Open the desktop app to browse songs in
          this tab.
        </p>
      </div>
    );
  }
  const statusLabel =
    status === "playing"
      ? "Now playing"
      : status === "paused"
        ? "Paused"
        : status === "last-played"
          ? "Last played"
          : status === "up-next"
            ? "Up next"
            : "Nothing playing";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 overflow-x-auto border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {playlists.map((playlist) => {
            const active = playlist.id === playlistId;
            return (
              <button
                key={playlist.id}
                type="button"
                onClick={() => setPlaylistId(playlist.id)}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {playlist.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadingPlaylists ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">Loading your library…</p>
        ) : error ? (
          <div className="px-4 py-6">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => void loadPlaylists()}>
              Try again
            </Button>
          </div>
        ) : loadingTracks ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">Loading songs…</p>
        ) : tracks.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">
            {selected
              ? `${selected.name} doesn’t have any songs yet.`
              : "No playlists in this library."}
          </p>
        ) : (
          <ul>
            {tracks.map((track) => {
              const current = liveTrack != null && isSameListeningTrack(liveTrack, track);
              const rowPlaying = current && playing;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() =>
                      void runControl({
                        action: "play",
                        playlistId: playlistId ?? undefined,
                        trackId: track.id,
                        optimistic: {
                          state: "playing",
                          title: track.title,
                          artist: track.artist,
                          album: track.album,
                          durationSeconds: track.durationSeconds,
                          positionSeconds: 0,
                          trackId: track.id,
                          artworkUrl: track.artworkUrl,
                        },
                      })
                    }
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left hover:bg-muted/50",
                      current ? "border-foreground bg-foreground/[0.06]" : "border-transparent",
                    )}
                  >
                    <span className="relative shrink-0">
                      <AlbumCover
                        url={track.artworkUrl}
                        className="size-11 rounded-md shadow-sm ring-1 ring-inset ring-black/10"
                      />
                      {current ? (
                        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-white">
                          {rowPlaying ? (
                            <PauseIcon className="size-3.5" />
                          ) : (
                            <PlayIcon className="size-3.5" />
                          )}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {track.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {current
                          ? `${rowPlaying ? "Playing" : "Paused"} · ${trackSubtitle(track)}`
                          : trackSubtitle(track)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatListeningTrackDuration(track.durationSeconds)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {truncated ? (
          <p className="px-3 py-2 text-[11px] text-muted-foreground">Showing the first 80 songs.</p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border/70 bg-muted/25 px-3 py-3">
        <div className="flex items-center gap-3">
          <AlbumCover
            url={display?.artworkUrl}
            className="size-16 rounded-lg shadow-md ring-1 ring-inset ring-black/15"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {statusLabel}
            </p>
            <p className="mt-0.5 truncate text-[15px] font-semibold leading-5 text-foreground">
              {display?.title ?? "Nothing playing"}
            </p>
            <p className="mt-0.5 truncate text-[12px] leading-4 text-muted-foreground">
              {display
                ? [display.artist, display.album].filter(Boolean).join(" · ")
                : loadingTracks
                  ? "Loading songs…"
                  : selected
                    ? `Browsing ${selected.name}`
                    : "Pick a playlist"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Previous"
              onClick={() => void runControl({ action: "previous" })}
            >
              <SkipBackIcon />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="size-9 rounded-full"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => {
                if (playing) {
                  void runControl({ action: "pause" });
                  return;
                }
                if (nowPlaying.state === "paused") {
                  void runControl({ action: "resume" });
                  return;
                }
                if (display?.trackId) {
                  void runControl({
                    action: "play",
                    playlistId: playlistId ?? undefined,
                    trackId: display.trackId,
                  });
                  return;
                }
                if (playlistId) {
                  void runControl({ action: "playPlaylist", playlistId });
                }
              }}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Next"
              onClick={() => void runControl({ action: "next" })}
            >
              <SkipForwardIcon />
            </Button>
          </div>
        </div>
        <MusicNowPlayingBar
          playback={display}
          onSeek={
            display
              ? (nextPosition) => {
                  if (isActiveListeningPlayback(nowPlaying) || lastPlayback) {
                    const source = isActiveListeningPlayback(nowPlaying)
                      ? nowPlaying
                      : lastPlayback!;
                    setNowPlaying({ ...source, positionSeconds: nextPosition });
                    setPlayback({ ...source, positionSeconds: nextPosition });
                  }
                  void runControl({ action: "seek", positionSeconds: nextPosition });
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
