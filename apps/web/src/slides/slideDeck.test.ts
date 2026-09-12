import { describe, expect, it } from "vite-plus/test";

import {
  defaultSlidesTopic,
  extractSlideDeckMarkdown,
  findSlideDeckMarkdownPath,
  isSlideDeckPath,
  parseSlideDeck,
  parseSlidesComposerCommand,
  rebuildSlideDeckMarkdown,
  replaceSlideMarkdown,
  resolveSlideDeckFromTranscript,
  resolveSlidesSendPrompt,
  serializeSlideMarkdown,
  slidesBuildPrompt,
  starterSlideDeckMarkdown,
  suggestSlideDeckPath,
} from "./slideDeck";

const SAMPLE_DECK = `---
marp: true
---

# Hello

A subtitle.

---

# Second

- One
- Two

???

Say this out loud.
`;

describe("slide decks", () => {
  it("parses HTML section decks as the native slide language", () => {
    const deck = parseSlideDeck(
      `<!DOCTYPE html><html><body><section><h1>Hello</h1></section><section><h1>Second</h1></section></body></html>`,
    );
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]?.title).toBe("Hello");
    expect(suggestSlideDeckPath(starterSlideDeckMarkdown())).toBe("slides/slide.html");
  });

  it("splits Marp-style markdown on --- after front matter", () => {
    const deck = parseSlideDeck(SAMPLE_DECK);
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]?.title).toBe("Hello");
    expect(deck.slides[1]?.title).toBe("Second");
    expect(deck.slides[1]?.notes).toBe("Say this out loud.");
  });

  it("rebuilds a deck from per-slide markdown and preserves notes", () => {
    const parsed = parseSlideDeck(SAMPLE_DECK);
    const rebuilt = rebuildSlideDeckMarkdown({
      frontMatter: "---\nmarp: true\n---",
      slides: parsed.slides,
    });
    const again = parseSlideDeck(rebuilt);
    expect(again.slides).toHaveLength(2);
    expect(again.slides[1]?.notes).toBe("Say this out loud.");
    expect(serializeSlideMarkdown(again.slides[1]!)).toContain("???");

    const replaced = replaceSlideMarkdown(SAMPLE_DECK, 1, "# Second\n\n- One\n- Two\n- Three");
    const afterReplace = parseSlideDeck(replaced);
    expect(afterReplace.slides).toHaveLength(2);
    expect(afterReplace.slides[0]?.title).toBe("Hello");
    expect(afterReplace.slides[1]?.markdown).toContain("- Three");
    expect(afterReplace.slides[1]?.notes).toBeNull();
    expect(suggestSlideDeckPath(SAMPLE_DECK)).toBe("slides/hello.html");
  });

  it("treats slides/*.md as a deck path", () => {
    expect(isSlideDeckPath("slides/pitch.md")).toBe(true);
    expect(isSlideDeckPath("slides/pitch.html")).toBe(true);
    expect(isSlideDeckPath("reports/q4.md")).toBe(false);
    expect(isSlideDeckPath("deck.pptx")).toBe(true);
  });

  it("treats bare /slides as a default build, not a panel-only command", () => {
    expect(parseSlidesComposerCommand(" /slides ")).toEqual({ kind: "build", task: null });
    expect(parseSlidesComposerCommand("/slides pitch the v0 launch")).toEqual({
      kind: "build",
      task: "pitch the v0 launch",
    });
    expect(parseSlidesComposerCommand("/plan")).toBeNull();
    const rewritten = resolveSlidesSendPrompt(
      { kind: "build", task: null },
      { threadTitle: "Auth rewrite", projectTitle: "Modesto" },
    );
    expect(rewritten).toContain("Build an in-app slide deck");
    expect(rewritten).toContain("Auth rewrite");
    expect(rewritten).toContain("Topic:");
    expect(slidesBuildPrompt("pitch")).toContain("pitch");
    expect(defaultSlidesTopic({})).toContain("overview");
  });

  it("extracts HTML decks, and lifts leftover Markdown into HTML sections", () => {
    expect(extractSlideDeckMarkdown("Just a paragraph with --- in the middle.")).toBeNull();
    expect(
      extractSlideDeckMarkdown(
        `Sure — here it is:\n\n\`\`\`html\n<section><h1>Hello</h1></section>\n<section><h1>Second</h1></section>\n\`\`\``,
      ),
    ).toContain("<h1>Hello</h1>");
    expect(extractSlideDeckMarkdown(SAMPLE_DECK)).toContain("<h1>Hello</h1>");
    expect(extractSlideDeckMarkdown(SAMPLE_DECK)).toContain("<h1>Second</h1>");
    expect(findSlideDeckMarkdownPath("Saved as `slides/launch.html`.")).toBe("slides/launch.html");
    expect(findSlideDeckMarkdownPath("Saved as `slides/launch.md`.")).toBe("slides/launch.md");
  });

  it("live-updates from the assistant turn after a slides build prompt", () => {
    const prompt = resolveSlidesSendPrompt(
      { kind: "build", task: "pitch the launch" },
      { threadTitle: null, projectTitle: null },
    );
    const streaming = resolveSlideDeckFromTranscript({
      messages: [
        { role: "user", text: prompt },
        {
          role: "assistant",
          text: "```html\n<section><h1>Launch</h1><p>Ready.</p></section>\n<section><h1>Why now</h1><ul><li>Timing</li></ul></section>\n```",
        },
      ],
    });
    expect(streaming.markdown).toContain("<h1>Launch</h1>");
    expect(streaming.markdown).toContain("<h1>Why now</h1>");

    const withFile = resolveSlideDeckFromTranscript({
      messages: [
        { role: "user", text: prompt },
        { role: "assistant", text: "Wrote `slides/launch.md`." },
      ],
      checkpointFiles: [{ path: "slides/launch.md" }],
    });
    expect(withFile.sourcePath).toBe("slides/launch.md");
  });
});
