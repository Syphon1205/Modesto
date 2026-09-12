import { describe, expect, it } from "vite-plus/test";

import {
  isVideoPlaybackUrl,
  mediaSourceLabel,
  parsePreviewMediaMetadata,
  shouldShowCompactMediaCard,
} from "./previewMediaMetadata";

describe("preview media metadata", () => {
  it("uses compact cards for music without collapsing regular YouTube video", () => {
    const metadata = parsePreviewMediaMetadata(
      {
        title: "Archangel",
        artist: "Burial",
        artworkUrl: "/cover.jpg",
        hasMediaSessionMetadata: true,
      },
      "https://open.spotify.com/track/123",
      null,
    );
    expect(metadata).toMatchObject({
      title: "Archangel",
      artist: "Burial",
      artworkUrl: "https://open.spotify.com/cover.jpg",
      sourceLabel: "Spotify",
    });
    expect(
      shouldShowCompactMediaCard({
        audible: true,
        pageUrl: "https://open.spotify.com/track/123",
        metadata,
      }),
    ).toBe(true);
    expect(isVideoPlaybackUrl("https://www.youtube.com/watch?v=123")).toBe(true);
    expect(isVideoPlaybackUrl("https://music.youtube.com/watch?v=123")).toBe(false);
  });

  it("labels the playback source and rejects unsafe artwork URLs", () => {
    expect(mediaSourceLabel("https://soundcloud.com/artist/track")).toBe("SoundCloud");
    expect(
      parsePreviewMediaMetadata(
        {
          title: "Track",
          artworkUrl: "javascript:alert(1)",
          source: "Custom player",
          hasMediaSessionMetadata: true,
        },
        "https://example.com/player",
        null,
      ),
    ).toMatchObject({ artworkUrl: null, sourceLabel: "Custom player" });
  });

  it("does not collapse silent pages or generic audio without media metadata", () => {
    const metadata = parsePreviewMediaMetadata(
      { title: "Meeting", hasMediaSessionMetadata: false },
      "https://example.com/call",
      null,
    );
    expect(
      shouldShowCompactMediaCard({
        audible: false,
        pageUrl: "https://example.com/call",
        metadata,
      }),
    ).toBe(false);
    expect(
      shouldShowCompactMediaCard({
        audible: true,
        pageUrl: "https://example.com/call",
        metadata,
      }),
    ).toBe(false);
  });
});
