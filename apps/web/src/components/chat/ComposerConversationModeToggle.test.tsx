import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ComposerConversationModeToggle } from "./ComposerConversationModeToggle";

describe("ComposerConversationModeToggle", () => {
  it("labels the New Chat landing choice as Chat and Work", () => {
    const html = renderToStaticMarkup(
      <ComposerConversationModeToggle value="code" onChange={() => {}} />,
    );

    expect(html).toContain("Chat");
    expect(html).toContain("Work");
    expect(html).toContain('aria-label="Conversation mode"');
    expect(html).toContain("rounded-full");
  });
});
