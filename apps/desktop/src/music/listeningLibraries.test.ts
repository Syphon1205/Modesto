import { describe, expect, it } from "vite-plus/test";

import {
  candidateAppPaths,
  detectListeningLibraries,
  listeningLibraryAppById,
} from "./listeningLibraries.ts";

describe("detectListeningLibraries", () => {
  it("marks Music and Spotify installed when their macOS apps exist", () => {
    const existing = new Set(["/Applications/Music.app", "/Applications/Spotify.app"]);
    const libraries = detectListeningLibraries({
      platform: "darwin",
      homeDir: "/Users/ada",
      env: {},
      pathExists: (path) => existing.has(path),
    });
    expect(libraries.find((library) => library.id === "apple-music")).toEqual({
      id: "apple-music",
      installed: true,
      appPath: "/Applications/Music.app",
    });
    expect(libraries.find((library) => library.id === "spotify")).toEqual({
      id: "spotify",
      installed: true,
      appPath: "/Applications/Spotify.app",
    });
    expect(libraries.find((library) => library.id === "tidal")?.installed).toBe(false);
  });

  it("finds Spotify under LocalAppData on Windows", () => {
    const libraries = detectListeningLibraries({
      platform: "win32",
      homeDir: "C:\\Users\\ada",
      env: { LOCALAPPDATA: "C:\\Users\\ada\\AppData\\Local" },
      pathExists: (path) => path.endsWith("Spotify.exe"),
    });
    const spotify = libraries.find((library) => library.id === "spotify");
    expect(spotify?.installed).toBe(true);
    expect(spotify?.appPath?.endsWith("Spotify.exe")).toBe(true);
    expect(libraries.find((library) => library.id === "apple-music")?.installed).toBe(false);
  });

  it("looks in ~/Applications as well as /Applications", () => {
    const paths = candidateAppPaths(
      { platform: "darwin", homeDir: "/Users/ada", env: {}, pathExists: () => false },
      listeningLibraryAppById("tidal")!,
    );
    expect(paths).toContain("/Users/ada/Applications/TIDAL.app");
  });
});
