import { AsyncResult } from "effect/unstable/reactivity";
import type { ScopedThreadRef } from "@modesto/contracts";
import {
  GripVerticalIcon,
  PanelRightIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  XIcon,
} from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from "react";

import { AlbumCover } from "~/components/music/AlbumCover";
import { MusicNowPlayingBar } from "~/components/music/MusicNowPlayingBar";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import {
  isActiveListeningPlayback,
  isListeningLibraryGranted,
  musicNowPlayingStatus,
  resolveMusicNowPlaying,
  shouldShowMusicMiniPlayer,
} from "~/music/musicLibraryAccess";
import { listeningPlaybackPollMs } from "~/music/useDisplayedListeningPosition";
import { useMusicPlayerStore } from "~/music/musicPlayerStore";
import {
  clampPreviewMiniPlayerPosition,
  PREVIEW_MINI_PLAYER_EDGE_GAP,
} from "~/components/preview/previewMiniPlayerLayout";
import { useRightPanelStore } from "~/rightPanelStore";
import { listeningControl, listeningPlayback } from "~/state/listening";
import { useAtomCommand } from "~/state/use-atom-command";

const MUSIC_MINI_PLAYER_SIZE = { width: 372, height: 138 } as const;

interface DragState {
  readonly pointerId: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly playerX: number;
  readonly playerY: number;
}

export function MusicMiniPlayer({
  threadRef,
  bottomInset,
  musicPanelVisible,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly bottomInset: number;
  readonly musicPanelVisible: boolean;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const providerId = useMusicPlayerStore((state) => state.providerId);
  const granted = useMusicPlayerStore((state) =>
    isListeningLibraryGranted(state.grantedServiceIds, state.providerId),
  );
  const playback = useMusicPlayerStore((state) => state.playback);
  const lastPlayback = useMusicPlayerStore((state) => state.lastPlayback);
  const sessionHasPlayed = useMusicPlayerStore((state) => state.sessionHasPlayed);
  const dismissed = useMusicPlayerStore((state) => state.miniPlayerDismissed);
  const position = useMusicPlayerStore((state) => state.miniPlayerPosition);
  const setPlayback = useMusicPlayerStore((state) => state.setPlayback);
  const dismissMiniPlayer = useMusicPlayerStore((state) => state.dismissMiniPlayer);
  const moveMiniPlayer = useMusicPlayerStore((state) => state.moveMiniPlayer);
  const control = useAtomCommand(listeningControl, { reportFailure: false });
  const readPlayback = useAtomCommand(listeningPlayback, { reportFailure: false });
  const nativeLibrary = granted && providerId === "apple-music";
  const display = resolveMusicNowPlaying({
    playback,
    lastPlayback,
    tracks: [],
  });
  const status = musicNowPlayingStatus({ playback, display });
  const playing = playback.state === "playing";
  const visible = shouldShowMusicMiniPlayer({
    granted,
    nativeLibrary,
    playback,
    lastPlayback,
    sessionHasPlayed,
    dismissed,
    musicPanelVisible,
  });

  const refreshPlayback = useCallback(async () => {
    if (!nativeLibrary) return;
    try {
      const desktop = window.desktopBridge?.getListeningLibraryPlayback;
      const listed = desktop
        ? await desktop(providerId)
        : await (async () => {
            const result = await readPlayback({
              environmentId: threadRef.environmentId,
              input: { id: providerId },
            });
            if (!AsyncResult.isSuccess(result)) return null;
            return result.value;
          })();
      if (listed) setPlayback(listed);
    } catch {
      // Mini player polling is best-effort.
    }
  }, [nativeLibrary, providerId, readPlayback, setPlayback, threadRef.environmentId]);

  const runControl = useCallback(
    async (action: "pause" | "resume" | "next" | "previous" | "seek", positionSeconds?: number) => {
      const desktop = window.desktopBridge?.controlListeningLibrary;
      if (desktop) {
        await desktop({
          id: providerId,
          action,
          ...(positionSeconds === undefined ? {} : { positionSeconds }),
        });
      } else {
        const result = await control({
          environmentId: threadRef.environmentId,
          input: {
            id: providerId,
            action,
            ...(positionSeconds === undefined ? {} : { positionSeconds }),
          },
        });
        if (!AsyncResult.isSuccess(result)) return;
      }
      await refreshPlayback();
    },
    [control, providerId, refreshPlayback, threadRef.environmentId],
  );

  useEffect(() => {
    if (!nativeLibrary || musicPanelVisible) return;
    void refreshPlayback();
    const interval = window.setInterval(
      () => void refreshPlayback(),
      listeningPlaybackPollMs(playback.state),
    );
    return () => window.clearInterval(interval);
  }, [musicPanelVisible, nativeLibrary, playback.state, refreshPlayback]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const root = rootRef.current;
    const parent = root?.offsetParent;
    if (!root || !(parent instanceof HTMLElement)) return;
    const rootRect = root.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      playerX: rootRect.left - parentRect.left,
      playerY: rootRect.top - parentRect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    const parent = root?.offsetParent;
    if (!drag || drag.pointerId !== event.pointerId || !root || !(parent instanceof HTMLElement)) {
      return;
    }
    moveMiniPlayer(
      clampPreviewMiniPlayerPosition(
        {
          x: drag.playerX + event.clientX - drag.pointerX,
          y: drag.playerY + event.clientY - drag.pointerY,
        },
        { width: parent.clientWidth, height: parent.clientHeight },
        MUSIC_MINI_PLAYER_SIZE,
        bottomInset,
      ),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!visible || !display) return null;

  return (
    <section
      ref={rootRef}
      aria-label="Floating music player"
      data-music-mini-player=""
      className="pointer-events-none absolute z-[70] select-none"
      style={
        position
          ? {
              left: position.x,
              top: position.y,
              width: MUSIC_MINI_PLAYER_SIZE.width,
              height: MUSIC_MINI_PLAYER_SIZE.height,
            }
          : {
              left: PREVIEW_MINI_PLAYER_EDGE_GAP,
              bottom: PREVIEW_MINI_PLAYER_EDGE_GAP + bottomInset,
              width: MUSIC_MINI_PLAYER_SIZE.width,
              height: MUSIC_MINI_PLAYER_SIZE.height,
            }
      }
    >
      <div
        className="pointer-events-auto flex h-full cursor-grab items-center gap-2 overflow-hidden rounded-2xl bg-popover/96 p-2.5 pr-2 text-left shadow-2xl ring-1 ring-inset ring-border/80 backdrop-blur-xl active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GripVerticalIcon aria-hidden className="size-4 shrink-0 text-muted-foreground/70" />
        <AlbumCover
          url={display.artworkUrl}
          className="size-[72px] rounded-lg shadow-md ring-1 ring-inset ring-black/15"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {status === "playing"
              ? "Now playing"
              : status === "paused"
                ? "Paused"
                : status === "last-played"
                  ? "Last played"
                  : "Up next"}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{display.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[display.artist, display.album].filter(Boolean).join(" · ")}
          </p>
          <MusicNowPlayingBar
            compact
            playback={display}
            onSeek={(nextPosition) => {
              if (isActiveListeningPlayback(playback) || lastPlayback) {
                const source = isActiveListeningPlayback(playback) ? playback : lastPlayback!;
                setPlayback({ ...source, positionSeconds: nextPosition });
              }
              void runControl("seek", nextPosition);
            }}
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Open music in right panel"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => useRightPanelStore.getState().open(threadRef, "music")}
                  />
                }
              >
                <PanelRightIcon />
              </TooltipTrigger>
              <TooltipPopup side="top">Open Music</TooltipPopup>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Hide music player"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => dismissMiniPlayer()}
                  />
                }
              >
                <XIcon />
              </TooltipTrigger>
              <TooltipPopup side="top">Hide player</TooltipPopup>
            </Tooltip>
          </div>
          <div className="flex items-center">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Previous"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void runControl("previous")}
            >
              <SkipBackIcon />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="secondary"
              className="rounded-full"
              aria-label={playing ? "Pause" : "Play"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void runControl(playing ? "pause" : "resume")}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Next"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void runControl("next")}
            >
              <SkipForwardIcon />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
