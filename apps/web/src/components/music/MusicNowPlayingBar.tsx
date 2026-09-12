import { type PointerEvent as ReactPointerEvent, useState } from "react";

import {
  formatListeningRemaining,
  formatListeningTrackDuration,
  listeningPlaybackProgress,
  type ActiveListeningPlayback,
} from "~/music/musicLibraryAccess";
import { useDisplayedListeningPosition } from "~/music/useDisplayedListeningPosition";
import { cn } from "~/lib/utils";

export function MusicNowPlayingBar({
  playback,
  onSeek,
  compact = false,
}: {
  readonly playback: ActiveListeningPlayback | null;
  readonly onSeek?: ((positionSeconds: number) => void) | undefined;
  readonly compact?: boolean;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const livePosition = useDisplayedListeningPosition(playback);
  const durationSeconds = playback?.durationSeconds ?? 0;
  const shown = dragging ?? livePosition;
  const progress = listeningPlaybackProgress(shown, durationSeconds);
  const seekable = durationSeconds > 0 && onSeek != null;

  const commit = (value: number) => {
    setDragging(null);
    onSeek?.(value);
  };

  const stopMiniPlayerDrag = (event: ReactPointerEvent<HTMLInputElement>) => {
    event.stopPropagation();
  };

  return (
    <div className={cn("min-w-0", compact ? "mt-1.5" : "mt-2")}>
      <div className="relative h-3">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {seekable ? (
          <input
            type="range"
            min={0}
            max={durationSeconds}
            step={0.05}
            value={Math.min(durationSeconds, Math.max(0, shown))}
            aria-label="Seek in song"
            aria-valuetext={`${formatListeningTrackDuration(shown)} of ${formatListeningTrackDuration(durationSeconds)}`}
            className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-progress]:bg-transparent [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:top-1/2 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:-translate-y-1/2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
            onPointerDown={stopMiniPlayerDrag}
            onPointerMove={stopMiniPlayerDrag}
            onChange={(event) => setDragging(Number(event.currentTarget.value))}
            onPointerUp={(event) => {
              stopMiniPlayerDrag(event);
              commit(Number(event.currentTarget.value));
            }}
            onKeyUp={(event) => commit(Number(event.currentTarget.value))}
            onBlur={() => {
              if (dragging != null) commit(dragging);
            }}
          />
        ) : null}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center justify-between font-medium tabular-nums text-muted-foreground",
          compact ? "text-[10px]" : "text-[11px]",
        )}
      >
        <span>{formatListeningTrackDuration(shown)}</span>
        <span>
          {durationSeconds > 0
            ? formatListeningRemaining(shown, durationSeconds)
            : formatListeningTrackDuration(0)}
        </span>
      </div>
    </div>
  );
}
