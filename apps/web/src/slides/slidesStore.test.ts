import { describe, expect, it } from "vite-plus/test";

import { starterSlideDeckMarkdown } from "./slideDeck";
import { selectThreadSlideDeck, useSlidesStore } from "./slidesStore";

const ref = { environmentId: "env-1" as never, threadId: "thread-1" as never };

describe("slides store", () => {
  it("records a generating build, then stores extracted markdown for the thread", () => {
    useSlidesStore.setState({
      markdownByThreadKey: {},
      sourcePathByThreadKey: {},
      indexByThreadKey: {},
      generatingByThreadKey: {},
      dirtyByThreadKey: {},
      persistedMarkdownByThreadKey: {},
      persistRevisionByThreadKey: {},
    });
    const empty = selectThreadSlideDeck(useSlidesStore.getState(), ref);
    expect(empty.isStarter).toBe(true);
    expect(empty.generating).toBe(false);

    useSlidesStore.getState().beginBuild(ref);
    expect(selectThreadSlideDeck(useSlidesStore.getState(), ref).generating).toBe(true);

    const markdown = "# Title\n\nHi.\n\n---\n\n# Two\n\n- A\n";
    useSlidesStore.getState().setDeck(ref, markdown, "slides/overview.md");
    const ready = selectThreadSlideDeck(useSlidesStore.getState(), ref);
    expect(ready.generating).toBe(false);
    expect(ready.isStarter).toBe(false);
    expect(ready.markdown).toBe(markdown);
    expect(ready.sourcePath).toBe("slides/overview.md");
    expect(ready.deck.slides).toHaveLength(2);
    expect(ready.markdown).not.toBe(starterSlideDeckMarkdown());
  });

  it("applies user markdown immediately and ignores stale remote echoes while dirty", () => {
    useSlidesStore.setState({
      markdownByThreadKey: {},
      sourcePathByThreadKey: {},
      indexByThreadKey: {},
      generatingByThreadKey: {},
      dirtyByThreadKey: {},
      persistedMarkdownByThreadKey: {},
      persistRevisionByThreadKey: {},
    });
    const first = "# Title\n\nHi.\n\n---\n\n# Two\n\n- A\n";
    useSlidesStore.getState().setDeck(ref, first, "slides/overview.md");
    const edited = "# Title\n\nEdited.\n\n---\n\n# Two\n\n- A\n";
    useSlidesStore.getState().applyUserDeck(ref, edited, "slides/overview.md");
    expect(selectThreadSlideDeck(useSlidesStore.getState(), ref).markdown).toBe(edited);
    expect(selectThreadSlideDeck(useSlidesStore.getState(), ref).dirty).toBe(true);

    expect(useSlidesStore.getState().applyRemoteDeck(ref, first, "slides/overview.md")).toBe(
      "ignore",
    );
    expect(selectThreadSlideDeck(useSlidesStore.getState(), ref).markdown).toBe(edited);

    useSlidesStore.getState().markPersisted(ref, edited, "slides/overview.md");
    expect(useSlidesStore.getState().applyRemoteDeck(ref, edited, "slides/overview.md")).toBe(
      "ignore",
    );
    expect(selectThreadSlideDeck(useSlidesStore.getState(), ref).dirty).toBe(false);
  });
});
