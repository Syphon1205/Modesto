import { describe, expect, it } from "vite-plus/test";

import {
  buildPreviewProxyAgentScript,
  PREVIEW_AGENT_OPERATIONS,
  PREVIEW_AGENT_READY_KEY,
  PREVIEW_AGENT_REQUEST_KEY,
  PREVIEW_AGENT_RESPONSE_KEY,
} from "./previewProxyAgent.ts";

const build = (overrides: Partial<Parameters<typeof buildPreviewProxyAgentScript>[0]> = {}) =>
  buildPreviewProxyAgentScript({ origin: "https://app.example", ...overrides });

describe("buildPreviewProxyAgentScript", () => {
  it("produces syntactically valid JavaScript", () => {
    // Compiling without running is the cheap way to catch a broken template
    // before it is injected into somebody's page.
    expect(() => new Function(build())).not.toThrow();
  });

  it("stays valid with the Playwright install expression spliced in", () => {
    expect(
      () => new Function(build({ playwrightInstallExpression: "(() => { return true; })()" })),
    ).not.toThrow();
  });

  it("embeds the host origin so only the framing app can drive the page", () => {
    const script = build({ origin: "https://app.example" });
    expect(script).toContain('var HOST_ORIGIN = "https://app.example"');
    expect(script).toContain("event.origin !== HOST_ORIGIN");
  });

  it("escapes an origin so it cannot break out of its string literal", () => {
    const hostile = '"; evil(); var x="';
    const script = build({ origin: hostile });
    // The payload may appear inside the literal; what matters is that its
    // quotes are escaped, so it stays data instead of becoming statements.
    expect(script).toContain(`var HOST_ORIGIN = ${JSON.stringify(hostile)}`);
    expect(script).not.toContain(`var HOST_ORIGIN = "${hostile}"`);
    expect(() => new Function(script)).not.toThrow();
  });

  it("handles every operation it advertises", () => {
    const script = build();
    for (const operation of PREVIEW_AGENT_OPERATIONS) {
      expect(script).toContain(`case "${operation}"`);
    }
  });

  it("does not claim to handle frame-level operations the host owns", () => {
    const script = build();
    for (const operation of ["open", "resize", "setColorScheme"]) {
      expect(script).not.toContain(`case "${operation}"`);
    }
  });

  it("uses the shared message keys in both directions", () => {
    const script = build();
    expect(script).toContain(PREVIEW_AGENT_REQUEST_KEY);
    expect(script).toContain(PREVIEW_AGENT_RESPONSE_KEY);
    expect(script).toContain(PREVIEW_AGENT_READY_KEY);
  });

  it("reports the missing screenshot rather than faking one", () => {
    const script = build();
    expect(script).toContain("screenshot: null");
    expect(script).toContain("screenshotUnavailableReason");
  });

  it("installs itself only once per document", () => {
    const script = build();
    expect(script).toContain(`if (window.${PREVIEW_AGENT_READY_KEY}) return;`);
  });

  it("falls back to a literal false when no Playwright expression is supplied", () => {
    // The agent must still load and serve CSS selectors when the bundle could
    // not be extracted, rather than throwing at install time.
    expect(build()).toContain("if (!globalThis.__t3PlaywrightInjected) { false; }");
  });
});
