import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { ComposerConversationModeToggle } from "./ComposerConversationModeToggle";

vi.mock("~/hooks/useSettings", () => ({ useInterfaceStyle: () => "github" }));

describe("ComposerConversationModeToggle", () => {
  it("shows the selected GitHub landing mode in a labeled menu trigger", () => {
    const html = renderToStaticMarkup(
      <ComposerConversationModeToggle value="code" onChange={() => {}} />,
    );

    expect(html).toContain("Work in a project");
    expect(html).toContain('aria-label="Conversation mode"');
    expect(html).toContain('aria-haspopup="menu"');
  });
});
