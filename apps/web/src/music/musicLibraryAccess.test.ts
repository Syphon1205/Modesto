import type { DesktopListeningLibrary } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import { LISTENING_SERVICES } from "./listeningServices";
import {
  formatListeningRemaining,
  formatListeningTrackDuration,
  interpolateListeningPosition,
  isListeningLibraryGranted,
  isSameListeningTrack,
  musicNowPlayingStatus,
  parseGrantedListeningServiceIds,
  partitionListeningServices,
  resolveMusicNowPlaying,
  shouldResampleListeningPosition,
  shouldShowMusicMiniPlayer,
  withGrantedListeningService,
  withoutGrantedListeningService,
} from "./musicLibraryAccess";

const libraries: DesktopListeningLibrary[] = [
  { id: "apple-music", installed: true, appPath: "/Applications/Music.app" },
  { id: "spotify", installed: true, appPath: "/Applications/Spotify.app" },
  { id: "youtube-music", installed: false, appPath: null },
  { id: "tidal", installed: false, appPath: null },
  { id: "soundcloud", installed: false, appPath: null },
  { id: "amazon-music", installed: false, appPath: null },
];

describe("musicLibraryAccess", () => {
  it("formats track durations", () => {
    expect(formatListeningTrackDuration(562)).toBe("9:22");
  });

  it("parses persisted grants", () => {
    expect(parseGrantedListeningServiceIds(["spotify", "nope", "spotify"])).toEqual(["spotify"]);
  });

  it("adds and removes grants", () => {
    expect(isListeningLibraryGranted(["apple-music"], "apple-music")).toBe(true);
    expect(withGrantedListeningService(["apple-music"], "spotify")).toEqual([
      "apple-music",
      "spotify",
    ]);
    expect(withoutGrantedListeningService(["apple-music", "spotify"], "apple-music")).toEqual([
      "spotify",
    ]);
  });

  it("splits detected installed apps from the rest", () => {
    const partitioned = partitionListeningServices(libraries, LISTENING_SERVICES);
    expect(partitioned.detectionAvailable).toBe(true);
    expect(partitioned.detected.map((service) => service.id)).toEqual(["apple-music", "spotify"]);
    expect(partitioned.other.map((service) => service.id)).toEqual([
      "youtube-music",
      "tidal",
      "soundcloud",
      "amazon-music",
    ]);
  });

  it("shows the floating mini player when Music is closed and this session has played", () => {
    const playing = {
      state: "playing" as const,
      title: "So What",
      artist: "Miles Davis",
      album: "Kind of Blue",
      durationSeconds: 547,
      positionSeconds: 12,
      trackId: "T1",
      artworkUrl: "/api/listening/artwork/abc",
    };
    expect(
      shouldShowMusicMiniPlayer({
        granted: true,
        nativeLibrary: true,
        playback: playing,
        lastPlayback: playing,
        sessionHasPlayed: true,
        dismissed: false,
        musicPanelVisible: false,
      }),
    ).toBe(true);
    expect(
      shouldShowMusicMiniPlayer({
        granted: true,
        nativeLibrary: true,
        playback: playing,
        lastPlayback: playing,
        sessionHasPlayed: true,
        dismissed: false,
        musicPanelVisible: true,
      }),
    ).toBe(false);
    expect(
      shouldShowMusicMiniPlayer({
        granted: true,
        nativeLibrary: true,
        playback: { state: "stopped" },
        lastPlayback: playing,
        sessionHasPlayed: true,
        dismissed: false,
        musicPanelVisible: false,
      }),
    ).toBe(true);
    expect(
      shouldShowMusicMiniPlayer({
        granted: true,
        nativeLibrary: true,
        playback: { state: "stopped" },
        lastPlayback: null,
        sessionHasPlayed: false,
        dismissed: false,
        musicPanelVisible: false,
      }),
    ).toBe(false);
  });

  it("treats a missing probe as undetected, so the user still picks a library", () => {
    const partitioned = partitionListeningServices(null, LISTENING_SERVICES);
    expect(partitioned.detectionAvailable).toBe(false);
    expect(partitioned.detected).toEqual([]);
    expect(partitioned.other).toHaveLength(LISTENING_SERVICES.length);
  });

  it("interpolates playback between Music.app samples without jumping on the same second", () => {
    expect(
      interpolateListeningPosition(
        { state: "playing", positionSeconds: 12, durationSeconds: 547 },
        1_000,
        1_500,
      ),
    ).toBe(12.5);
    expect(
      interpolateListeningPosition(
        { state: "paused", positionSeconds: 12, durationSeconds: 547 },
        1_000,
        1_500,
      ),
    ).toBe(12);
    expect(
      shouldResampleListeningPosition({
        previous: {
          state: "playing",
          title: "So What",
          artist: "Miles Davis",
          positionSeconds: 12,
          durationSeconds: 547,
          sampledAtMs: 1_000,
        },
        next: {
          state: "playing",
          title: "So What",
          artist: "Miles Davis",
          positionSeconds: 13,
          durationSeconds: 547,
        },
        nowMs: 2_800,
      }),
    ).toBe(false);
    expect(
      shouldResampleListeningPosition({
        previous: {
          state: "playing",
          title: "So What",
          artist: "Miles Davis",
          positionSeconds: 12,
          durationSeconds: 547,
          sampledAtMs: 1_000,
        },
        next: {
          state: "playing",
          title: "So What",
          artist: "Miles Davis",
          positionSeconds: 40,
          durationSeconds: 547,
        },
        nowMs: 1_400,
      }),
    ).toBe(true);
    expect(formatListeningRemaining(12, 547)).toBe("-8:55");
  });

  it("keeps Music.app's current song instead of the first playlist track", () => {
    const playing = {
      state: "playing" as const,
      title: "Blue in Green",
      artist: "Miles Davis",
      album: "Kind of Blue",
      durationSeconds: 338,
      positionSeconds: 40,
      trackId: "T2",
      artworkUrl: null,
    };
    expect(
      resolveMusicNowPlaying({
        playback: playing,
        lastPlayback: playing,
        tracks: [
          {
            id: "T1",
            title: "So What",
            artist: "Miles Davis",
            album: "Kind of Blue",
            durationSeconds: 547,
            artworkUrl: "/api/listening/artwork/abc",
          },
        ],
      }),
    ).toMatchObject({ title: "Blue in Green", positionSeconds: 40 });
    expect(musicNowPlayingStatus({ playback: playing, display: playing })).toBe("playing");
    expect(
      isSameListeningTrack(playing, { id: "T2", title: "Blue in Green", artist: "Miles Davis" }),
    ).toBe(true);
  });

  it("fills the dock from the first track before anything plays", () => {
    expect(
      resolveMusicNowPlaying({
        playback: { state: "stopped" },
        lastPlayback: null,
        tracks: [
          {
            id: "T1",
            title: "So What",
            artist: "Miles Davis",
            album: "Kind of Blue",
            durationSeconds: 547,
            artworkUrl: "/api/listening/artwork/abc",
          },
        ],
      }),
    ).toMatchObject({
      title: "So What",
      artist: "Miles Davis",
      artworkUrl: "/api/listening/artwork/abc",
      state: "paused",
    });
  });
});
