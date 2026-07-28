// FILE: PluginLibrary.import.test.ts
// Purpose: Smoke-tests the provider-backed plugin directory module.

import { describe, expect, it, vi } from "vitest";

vi.mock("~/nativeApi", () => ({
  ensureNativeApi: vi.fn(),
}));

describe("PluginLibrary module", () => {
  it("loads the real provider-backed directory", async () => {
    vi.stubGlobal("self", globalThis);
    const module = await import("./PluginLibrary");
    expect(module.PluginLibrary).toBeTypeOf("function");
  });
});
