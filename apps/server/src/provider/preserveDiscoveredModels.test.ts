import * as NodeAssert from "node:assert/strict";

import type { ServerProvider, ServerProviderModel } from "@modesto/contracts";
import { describe, it } from "vite-plus/test";

import { preserveDiscoveredModels } from "./preserveDiscoveredModels.ts";

const model = (slug: string): ServerProviderModel => ({
  slug,
  name: slug,
  isCustom: false,
  capabilities: { optionDescriptors: [] },
});

const snapshot = (overrides: Partial<ServerProvider>): ServerProvider =>
  ({
    instanceId: "cursor",
    driver: "cursor",
    displayName: "Cursor",
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "unknown" },
    checkedAt: "2026-09-03T00:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...overrides,
  }) as ServerProvider;

describe("preserveDiscoveredModels", () => {
  it("carries the previous list forward when a refresh discovers nothing", () => {
    const previous = snapshot({ models: [model("composer-2"), model("gpt-5.4")] });
    const next = snapshot({ models: [], message: "ACP model discovery timed out." });

    NodeAssert.deepEqual(
      preserveDiscoveredModels(previous, next).models.map((entry) => entry.slug),
      ["composer-2", "gpt-5.4"],
    );
  });

  it("keeps everything else from the new snapshot", () => {
    const previous = snapshot({ models: [model("composer-2")], status: "ready" });
    const next = snapshot({ models: [], status: "error", message: "CLI failed to run." });

    const merged = preserveDiscoveredModels(previous, next);
    NodeAssert.equal(merged.status, "error");
    NodeAssert.equal(merged.message, "CLI failed to run.");
  });

  it("lets a real discovery replace the list, even a shorter one", () => {
    const previous = snapshot({ models: [model("a"), model("b")] });
    const next = snapshot({ models: [model("a")] });

    NodeAssert.deepEqual(
      preserveDiscoveredModels(previous, next).models.map((entry) => entry.slug),
      ["a"],
    );
  });

  it("does not resurrect models for a provider that was turned off", () => {
    const previous = snapshot({ models: [model("a")] });
    NodeAssert.deepEqual(
      preserveDiscoveredModels(previous, snapshot({ models: [], enabled: false })).models,
      [],
    );
    NodeAssert.deepEqual(
      preserveDiscoveredModels(previous, snapshot({ models: [], status: "disabled" })).models,
      [],
    );
  });

  it("does not resurrect models for a provider whose binary is gone", () => {
    const previous = snapshot({ models: [model("a")] });
    const next = snapshot({ models: [], installed: false, status: "error" });

    NodeAssert.deepEqual(preserveDiscoveredModels(previous, next).models, []);
  });

  it("passes the first snapshot through untouched", () => {
    const next = snapshot({ models: [model("a")] });
    NodeAssert.equal(preserveDiscoveredModels(null, next), next);
  });
});
