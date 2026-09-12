import { describe, expect, it } from "vite-plus/test";

import {
  formatListeningTrackDuration,
  parseListeningLibraryPlayback,
  parseListeningLibraryPlaylists,
  parseListeningLibraryTracks,
  preferredListeningPlaylistId,
} from "./listeningLibraryAppleMusic.ts";
import {
  detectListeningLibraries,
  supportsNativeListeningLibrary,
} from "./listeningLibraryDetect.ts";

describe("listening library parsers", () => {
  it("reads TSV playlists", () => {
    expect(
      parseListeningLibraryPlaylists("library\tLibrary\nABCD12\tLate night\n../etc\tnope\n"),
    ).toEqual([
      { id: "library", name: "Library", trackCount: null },
      { id: "ABCD12", name: "Late night", trackCount: null },
    ]);
  });

  it("reads TSV tracks", () => {
    const listed = parseListeningLibraryTracks(
      "T1\tFlamenco Sketches\tMiles Davis\tKind of Blue\t562\t1959\n__TRUNCATED__\n",
    );
    expect(listed.truncated).toBe(true);
    expect(listed.tracks[0]).toEqual({
      id: "T1",
      title: "Flamenco Sketches",
      artist: "Miles Davis",
      album: "Kind of Blue",
      durationSeconds: 562,
      year: 1959,
      artworkUrl: null,
    });
  });

  it("formats durations", () => {
    expect(formatListeningTrackDuration(562)).toBe("9:22");
    expect(formatListeningTrackDuration(8)).toBe("0:08");
  });

  it("reads TSV playback", () => {
    expect(parseListeningLibraryPlayback("stopped")).toEqual({ state: "stopped" });
    expect(
      parseListeningLibraryPlayback("playing\tSo What\tMiles Davis\tKind of Blue\t547\t12"),
    ).toMatchObject({
      state: "playing",
      title: "So What",
      artworkUrl: null,
    });
  });
});

describe("listening library detection", () => {
  it("prefers Favorite Songs over the full library", () => {
    expect(
      preferredListeningPlaylistId([
        { id: "library", name: "Library", trackCount: null },
        { id: "AAAA", name: "Favorite Songs", trackCount: null },
      ]),
    ).toBe("AAAA");
  });

  it("only treats Apple Music on macOS as a native library", () => {
    expect(supportsNativeListeningLibrary("apple-music", "darwin")).toBe(true);
    expect(supportsNativeListeningLibrary("spotify", "darwin")).toBe(false);
    expect(supportsNativeListeningLibrary("apple-music", "win32")).toBe(false);
  });

  it("finds Music.app", () => {
    const libraries = detectListeningLibraries({
      platform: "darwin",
      homeDir: "/Users/ada",
      env: {},
      pathExists: (path) => path === "/Applications/Music.app",
    });
    expect(libraries.find((library) => library.id === "apple-music")?.installed).toBe(true);
  });
});
