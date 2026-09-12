import { describe, expect, it } from "vite-plus/test";

import { parseSlideTransition, setSlideTransitionFrontMatter } from "./slideTransition";
import { buildSlideDeckPptx, suggestPptxFilename } from "./slidePptx";

describe("slide export", () => {
  it("names the pptx from the title slide", () => {
    expect(suggestPptxFilename("# Launch\n\nHi\n")).toBe("launch.pptx");
  });

  it("builds a pptx zip with one slide part per slide", async () => {
    const bytes = await buildSlideDeckPptx("# One\n\nHi\n\n---\n\n# Two\n\n- A\n");
    expect(bytes.byteLength).toBeGreaterThan(800);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("ppt/slides/slide1.xml");
    expect(text).toContain("ppt/slides/slide2.xml");
  });
});

describe("slide transition", () => {
  it("defaults to fade and can rewrite front matter", () => {
    expect(parseSlideTransition("---\nmarp: true\n---")).toBe("fade");
    expect(
      parseSlideTransition(setSlideTransitionFrontMatter("---\nmarp: true\n---", "slide")),
    ).toBe("slide");
  });
});
