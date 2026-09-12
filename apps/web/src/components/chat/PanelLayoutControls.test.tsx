import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { PanelLayoutControls } from "./PanelLayoutControls";

describe("PanelLayoutControls", () => {
  it("keeps unavailable panel tooltip triggers interactive", () => {
    const markup = renderToStaticMarkup(
      <PanelLayoutControls
        showTerminalControl
        terminalAvailable={false}
        terminalOpen={false}
        terminalShortcutLabel={null}
        rightPanelAvailable={false}
        rightPanelOpen={false}
        rightPanelShortcutLabel={null}
        liveAgentCount={0}
        onToggleTerminal={() => {}}
        onToggleRightPanel={() => {}}
      />,
    );

    expect(markup.match(/data-slot="tooltip-trigger"/g)).toHaveLength(2);
    expect(markup.match(/data-slot="tooltip-trigger"[^>]*><button[^>]*disabled=""/g)).toHaveLength(
      2,
    );
  });

  it("separates usage from the surrounding header controls", () => {
    const markup = renderToStaticMarkup(
      <PanelLayoutControls
        showTerminalControl
        terminalAvailable
        terminalOpen={false}
        terminalShortcutLabel={null}
        rightPanelAvailable
        rightPanelOpen={false}
        rightPanelShortcutLabel={null}
        liveAgentCount={0}
        usageClock={<button type="button" aria-label="Usage for Grok, 100% remaining" />}
        onToggleTerminal={() => {}}
        onToggleRightPanel={() => {}}
      />,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Usage for Grok, 100% remaining");
    expect(markup).toContain("Toggle right panel");
  });
});
