import { DEFAULT_SERVER_SETTINGS, type ServerSettings } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import {
  defaultCloudAgentModelSelection,
  filterCloudAgentModelSelections,
  isCloudAgentProviderEnabled,
  listCloudAgentProviders,
} from "./cloudAgents.ts";

function withProviders(
  patch: Partial<ServerSettings["providers"]>,
): ServerSettings["providers"] {
  return {
    ...DEFAULT_SERVER_SETTINGS.providers,
    ...patch,
  };
}

describe("cloudAgents", () => {
  it("treats missing enabled flags as allowed", () => {
    expect(isCloudAgentProviderEnabled(DEFAULT_SERVER_SETTINGS.providers, "codex")).toBe(true);
  });

  it("respects disabled providers", () => {
    const providers = withProviders({
      cursor: { ...DEFAULT_SERVER_SETTINGS.providers.cursor, enabled: false },
    });
    expect(isCloudAgentProviderEnabled(providers, "cursor")).toBe(false);
    expect(isCloudAgentProviderEnabled(providers, "claudeAgent")).toBe(true);
  });

  it("lists only enabled, non-hidden providers in order", () => {
    const providers = withProviders({
      gemini: { ...DEFAULT_SERVER_SETTINGS.providers.gemini, enabled: false },
      pi: { ...DEFAULT_SERVER_SETTINGS.providers.pi, enabled: false },
    });
    expect(
      listCloudAgentProviders({
        providers,
        providerOrder: ["claudeAgent", "codex", "cursor"],
        hiddenProviders: ["grok"],
      }),
    ).toEqual([
      "claudeAgent",
      "codex",
      "cursor",
      "droid",
      "kilo",
      "opencode",
    ]);
  });

  it("keeps currently allowed providers visible even when disabled", () => {
    const providers = withProviders({
      cursor: { ...DEFAULT_SERVER_SETTINGS.providers.cursor, enabled: false },
    });
    expect(
      listCloudAgentProviders({
        providers,
        currentlyAllowed: ["cursor"],
        hiddenProviders: ["cursor"],
      }),
    ).toContain("cursor");
  });

  it("filters allowlist selections to enabled providers", () => {
    const providers = withProviders({
      cursor: { ...DEFAULT_SERVER_SETTINGS.providers.cursor, enabled: false },
    });
    expect(
      filterCloudAgentModelSelections(
        [
          { provider: "codex", model: "gpt-5.5" },
          { provider: "cursor", model: "auto" },
        ],
        providers,
      ),
    ).toEqual([{ provider: "codex", model: "gpt-5.5" }]);
  });

  it("builds default model selections for cloud-agent providers", () => {
    expect(defaultCloudAgentModelSelection("claudeAgent")).toEqual({
      provider: "claudeAgent",
      model: "claude-sonnet-5",
    });
    expect(defaultCloudAgentModelSelection("pi").provider).toBe("pi");
    expect(defaultCloudAgentModelSelection("pi").model.length).toBeGreaterThan(0);
  });
});
