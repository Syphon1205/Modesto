import { describe, expect, it } from "vite-plus/test";

import { resolveSlideDeckPersistPath, shouldApplyRemoteSlideDeck } from "./slideDeckPersist";

describe("slide deck persist guards", () => {
  it("does not clobber in-progress typing, but acknowledges our own write echo", () => {
    expect(
      shouldApplyRemoteSlideDeck({
        dirty: true,
        incoming: "# Old",
        current: "# Draft",
        persisted: "# Old",
      }),
    ).toBe("ignore");
    expect(
      shouldApplyRemoteSlideDeck({
        dirty: true,
        incoming: "# Draft",
        current: "# Draft",
        persisted: "# Old",
      }),
    ).toBe("ack-echo");
    expect(
      shouldApplyRemoteSlideDeck({
        dirty: false,
        incoming: "# From disk",
        current: "# Old",
        persisted: "# Old",
      }),
    ).toBe("apply");
    expect(
      shouldApplyRemoteSlideDeck({
        dirty: false,
        incoming: "# Same",
        current: "# Same",
        persisted: "# Same",
      }),
    ).toBe("ignore");
  });

  it("writes decks under slides/ as HTML and ignores pptx as a persist target", () => {
    expect(resolveSlideDeckPersistPath("slides/launch.md", "# Hello")).toBe("slides/launch.md");
    expect(resolveSlideDeckPersistPath("slides/launch.html", "<h1>Hello</h1>")).toBe(
      "slides/launch.html",
    );
    expect(resolveSlideDeckPersistPath("deck.pptx", "# Hello\n\nHi")).toBe("slides/hello.html");
    expect(resolveSlideDeckPersistPath(null, "# Q4 Plan\n\nGo")).toBe("slides/q4-plan.html");
  });
});
