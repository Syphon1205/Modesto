import { describe, expect, it } from "vite-plus/test";

import {
  isListeningServiceId,
  listeningServiceById,
  searchUrlForListeningService,
  urlBelongsToListeningService,
} from "./listeningServices";

describe("listeningServices", () => {
  it("accepts known service ids only", () => {
    expect(isListeningServiceId("apple-music")).toBe(true);
    expect(isListeningServiceId("spotify")).toBe(true);
    expect(isListeningServiceId("pandora")).toBe(false);
  });

  it("builds each service's search URL", () => {
    expect(searchUrlForListeningService(listeningServiceById("apple-music"), "kind of blue")).toBe(
      "https://music.apple.com/search?term=kind%20of%20blue",
    );
    expect(searchUrlForListeningService(listeningServiceById("spotify"), "kind of blue")).toBe(
      "https://open.spotify.com/search/kind%20of%20blue",
    );
    expect(
      searchUrlForListeningService(listeningServiceById("youtube-music"), "kind of blue"),
    ).toBe("https://music.youtube.com/search?q=kind%20of%20blue");
  });

  it("falls back to home when search is empty", () => {
    expect(searchUrlForListeningService(listeningServiceById("tidal"), "   ")).toBe(
      "https://listen.tidal.com",
    );
  });

  it("recognizes service hosts, including regional subdomains", () => {
    const apple = listeningServiceById("apple-music");
    expect(urlBelongsToListeningService("https://music.apple.com/us/playlist/foo", apple)).toBe(
      true,
    );
    expect(urlBelongsToListeningService("https://open.spotify.com/playlist/1", apple)).toBe(false);
    expect(urlBelongsToListeningService("https://beta.music.apple.com/listen-now", apple)).toBe(
      true,
    );
  });
});
