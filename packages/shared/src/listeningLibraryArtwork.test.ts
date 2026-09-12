import { describe, expect, it } from "vite-plus/test";

import {
  detectListeningArtworkExtension,
  listeningArtworkId,
  listeningArtworkLookupKey,
  listeningArtworkUrl,
  parseAppleMusicArtworkIndex,
} from "./listeningLibraryArtwork.ts";

describe("listening library artwork", () => {
  it("keys albums together so one cover fills every track on the record", () => {
    expect(
      listeningArtworkLookupKey({ artist: "Miles Davis", album: "Kind of Blue", title: "So What" }),
    ).toBe(
      listeningArtworkLookupKey({
        artist: "Miles Davis",
        album: "Kind of Blue",
        title: "Flamenco Sketches",
      }),
    );
  });

  it("builds a stable local artwork URL", () => {
    const input = { artist: "Miles Davis", album: "Kind of Blue", title: "So What" };
    const id = listeningArtworkId(input);
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(listeningArtworkId(input)).toBe(id);
    expect(listeningArtworkUrl(input)).toBe(`/api/listening/artwork/${id}`);
  });

  it("reads the AppleScript artwork index", () => {
    expect(
      parseAppleMusicArtworkIndex("1\tMiles Davis\tKind of Blue\n2\tJohn Coltrane\tGiant Steps\n"),
    ).toEqual([
      { index: "1", artist: "Miles Davis", album: "Kind of Blue" },
      { index: "2", artist: "John Coltrane", album: "Giant Steps" },
    ]);
  });

  it("sniffs JPEG and PNG magic", () => {
    expect(detectListeningArtworkExtension(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(detectListeningArtworkExtension(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(detectListeningArtworkExtension(Uint8Array.from([0x00, 0x01]))).toBeNull();
  });
});
