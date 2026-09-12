import { ProviderDriverKind } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import { DRIVER_OPTIONS, getDriverOption } from "./providerDriverMeta";

describe("provider client definitions", () => {
  it("exposes Kimi, Qwen, Poolside and Devin so Settings can render them", () => {
    for (const [driver, label] of [
      ["kimi", "Kimi"],
      ["qwen", "Qwen"],
      ["poolside", "Poolside"],
      ["devin", "Devin"],
    ] as const) {
      const option = getDriverOption(ProviderDriverKind.make(driver));
      expect(option, `missing driver option for ${driver}`).toBeDefined();
      expect(option?.label).toBe(label);
      // Every card renders an icon and a settings form; a driver missing
      // either would render as a blank row.
      expect(option?.icon).toBeTypeOf("function");
      expect(option?.settingsSchema.fields).toBeDefined();
    }
  });

  it("exposes GitHub Copilot so Settings can render it", () => {
    const option = getDriverOption(ProviderDriverKind.make("githubCopilot"));
    expect(option, "missing driver option for githubCopilot").toBeDefined();
    expect(option?.label).toBe("GitHub Copilot");
    expect(option?.icon).toBeTypeOf("function");
    expect(option?.settingsSchema.fields).toBeDefined();
  });

  it("exposes Meta so Settings can render Muse Code", () => {
    const option = getDriverOption(ProviderDriverKind.make("meta"));
    expect(option, "missing driver option for meta").toBeDefined();
    expect(option?.label).toBe("Meta");
    expect(option?.icon).toBeTypeOf("function");
    expect(option?.settingsSchema.fields).toBeDefined();
    expect(option?.badgeLabel).toBe("New");
  });

  it("keeps one definition per driver kind", () => {
    const values = DRIVER_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
