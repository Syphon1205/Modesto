import { useEffect, useRef, useState } from "react";

import {
  interpolateListeningPosition,
  shouldResampleListeningPosition,
  type ActiveListeningPlayback,
} from "./musicLibraryAccess";

export function useDisplayedListeningPosition(playback: ActiveListeningPlayback | null): number {
  const sampleRef = useRef<{
    readonly state: string;
    readonly title: string;
    readonly artist: string;
    readonly positionSeconds: number;
    readonly durationSeconds: number;
    readonly sampledAtMs: number;
  } | null>(null);
  const [, setClock] = useState(0);

  if (playback) {
    const nowMs = Date.now();
    const previous = sampleRef.current;
    if (!previous || shouldResampleListeningPosition({ previous, next: playback, nowMs })) {
      sampleRef.current = {
        state: playback.state,
        title: playback.title,
        artist: playback.artist,
        positionSeconds: playback.positionSeconds,
        durationSeconds: playback.durationSeconds,
        sampledAtMs: nowMs,
      };
    }
  } else {
    sampleRef.current = null;
  }

  const playing = playback?.state === "playing";
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      setClock((value) => value + 1);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const sample = sampleRef.current;
  if (!playback || !sample) return 0;
  return interpolateListeningPosition(
    {
      state: playback.state,
      positionSeconds: sample.positionSeconds,
      durationSeconds: playback.durationSeconds,
    },
    sample.sampledAtMs,
    Date.now(),
  );
}

export const LISTENING_PLAYBACK_POLL_MS = {
  playing: 2_000,
  idle: 4_000,
} as const;

export function listeningPlaybackPollMs(state: "playing" | "paused" | "stopped"): number {
  return state === "playing" ? LISTENING_PLAYBACK_POLL_MS.playing : LISTENING_PLAYBACK_POLL_MS.idle;
}
