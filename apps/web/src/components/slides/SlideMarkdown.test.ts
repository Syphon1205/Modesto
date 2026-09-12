import { describe, expect, it } from "vite-plus/test";

import { resolveSlideImagePath } from "./SlideMarkdown";

describe("resolveSlideImagePath", () => {
  it("keeps workspace-rooted slide asset paths", () => {
    expect(resolveSlideImagePath("slides/assets/cursor.svg", "slides/cursor-proposal.md")).toBe(
      "slides/assets/cursor.svg",
    );
  });

  it("resolves paths relative to the deck file", () => {
    expect(resolveSlideImagePath("assets/cursor.svg", "slides/cursor-proposal.md")).toBe(
      "slides/assets/cursor.svg",
    );
  });

  it("ignores remote and data urls", () => {
    expect(resolveSlideImagePath("https://example.com/a.svg", "slides/deck.md")).toBeNull();
    expect(resolveSlideImagePath("data:image/svg+xml,abc", null)).toBeNull();
  });
});
