import * as NodeAssert from "node:assert/strict";

import {
  DEFAULT_SERVER_SETTINGS,
  defaultInstanceIdForDriver,
  providerInstanceConfigEnabledFlag,
} from "@modesto/contracts";
import { describe, it } from "vite-plus/test";

import { BUILT_IN_DRIVERS } from "./builtInDrivers.ts";
import { deriveProviderInstanceConfigMap } from "./Layers/ProviderInstanceRegistryHydration.ts";

describe("BUILT_IN_DRIVERS", () => {
  it("registers every shipped driver kind exactly once", () => {
    const kinds = BUILT_IN_DRIVERS.map((driver) => driver.driverKind);
    NodeAssert.equal(new Set(kinds).size, kinds.length);
    for (const expected of [
      "codex",
      "claudeAgent",
      "cursor",
      "grok",
      "gemini",
      "meta",
      "opencode",
      "kilo",
      "kimi",
      "qwen",
      "poolside",
      "devin",
      "githubCopilot",
      "droid",
      "pi",
      "customAcp",
    ]) {
      NodeAssert.ok(
        kinds.includes(expected as (typeof kinds)[number]),
        `missing driver ${expected}`,
      );
    }
  });

  it("materializes a default instance for the providers that ship visible in Settings", () => {
    const instances = deriveProviderInstanceConfigMap(DEFAULT_SERVER_SETTINGS);

    // Kimi, Qwen, Poolside, Devin, and GitHub Copilot carry legacy
    // `providers.<kind>` entries so they appear in Settings -> Providers
    // out of the box, disabled until the user turns them on.
    for (const kind of ["kimi", "qwen", "poolside", "devin", "githubCopilot"] as const) {
      const instance = instances[defaultInstanceIdForDriver(kind as never)];
      NodeAssert.ok(instance, `expected a default instance for ${kind}`);
      NodeAssert.equal(instance?.driver, kind);
      // The legacy hydration path carries the flag inside the config blob;
      // the envelope-level `enabled` is only set for explicit instances.
      NodeAssert.equal(providerInstanceConfigEnabledFlag(instance?.config), false);
    }
  });
});
