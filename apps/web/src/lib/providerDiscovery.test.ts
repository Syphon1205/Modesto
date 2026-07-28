// FILE: providerDiscovery.test.ts
// Purpose: Verifies provider discovery search normalization and ranking behavior.
// Layer: Web lib tests
// Exports: Vitest cases for composer/plugin discovery helpers.

import type { ProviderPluginDescriptor, ProviderSkillDescriptor } from "@modesto/contracts";
import { describe, expect, it } from "vitest";
import {
  buildSkillSearchFields,
  isInstalledProviderPlugin,
  rankProviderDiscoveryItems,
  supportsProviderDiscoveryTab,
} from "./providerDiscovery";

function makeSkill(partial: Partial<ProviderSkillDescriptor>): ProviderSkillDescriptor {
  return {
    name: "example-skill",
    description: "Example skill",
    path: "/Users/tester/.codex/skills/example-skill/SKILL.md",
    enabled: true,
    scope: "user",
    ...partial,
  };
}

describe("rankProviderDiscoveryItems", () => {
  it("prioritizes skill name and display-name matches over weaker field matches", () => {
    const skills = [
      makeSkill({
        name: "swiftui-liquid-glass",
        description: "Audit SwiftUI checks and platform UI behavior.",
        path: "/Users/tester/.codex/skills/swiftui-liquid-glass/SKILL.md",
        interface: {
          displayName: "SwiftUI Liquid Glass",
          shortDescription: "Build SwiftUI Liquid Glass features",
        },
      }),
      makeSkill({
        name: "check-code",
        description: "Review recent code changes to find bugs and risks.",
        path: "/Users/tester/.codex/skills/check-code/SKILL.md",
        interface: {
          displayName: "Check Code",
          shortDescription: "Review code changes for bugs and refactor ideas",
        },
      }),
      makeSkill({
        name: "stripe-integration",
        description: "Implement Stripe checkout, subscriptions, and webhooks.",
        path: "/Users/tester/.codex/skills/stripe-integration/SKILL.md",
        interface: {
          displayName: "Stripe Integration",
          shortDescription: "Implement Stripe checkout",
        },
      }),
      makeSkill({
        name: "name-prospector",
        description: "Generate names and map similar-name competitors.",
        path: "/Users/tester/.codex/skills/name-prospector/SKILL.md",
        interface: {
          displayName: "Name Prospector",
          shortDescription: "Generate names and check domains",
        },
      }),
    ];

    const ranked = rankProviderDiscoveryItems(skills, "check", buildSkillSearchFields);

    expect(ranked[0]?.name).toBe("check-code");
    expect(ranked.map((skill) => skill.name)).toEqual([
      "check-code",
      "swiftui-liquid-glass",
      "stripe-integration",
      "name-prospector",
    ]);
  });

  it("matches compact queries across normalized separators", () => {
    const ranked = rankProviderDiscoveryItems(
      [
        makeSkill({
          name: "release-prep",
          interface: { displayName: "Release Prep" },
        }),
        makeSkill({
          name: "check-code",
          interface: { displayName: "Check Code" },
        }),
      ],
      "checkcode",
      buildSkillSearchFields,
    );

    expect(ranked.map((skill) => skill.name)).toEqual(["check-code"]);
  });
});

describe("isInstalledProviderPlugin", () => {
  const plugin = (partial: Partial<ProviderPluginDescriptor>): ProviderPluginDescriptor => ({
    id: "figma@openai-curated",
    name: "figma",
    source: { type: "local", path: "/tmp/plugins/figma" },
    installed: false,
    enabled: true,
    installPolicy: "AVAILABLE",
    authPolicy: "ON_INSTALL",
    ...partial,
  });

  it("does not treat an enabled marketplace entry as installed", () => {
    expect(isInstalledProviderPlugin(plugin({}))).toBe(false);
  });

  it("recognizes explicit and bundled installations", () => {
    expect(isInstalledProviderPlugin(plugin({ installed: true }))).toBe(true);
    expect(isInstalledProviderPlugin(plugin({ installPolicy: "INSTALLED_BY_DEFAULT" }))).toBe(true);
  });
});

describe("supportsProviderDiscoveryTab", () => {
  it("keeps Codex marketplace skills available without workspace skill discovery", () => {
    expect(
      supportsProviderDiscoveryTab({
        provider: "codex",
        tab: "skills",
        capabilities: { plugins: true, skills: false },
      }),
    ).toBe(true);
  });

  it("does not imply skill support from plugin support for other providers", () => {
    expect(
      supportsProviderDiscoveryTab({
        provider: "claudeAgent",
        tab: "skills",
        capabilities: { plugins: true, skills: false },
      }),
    ).toBe(false);
  });
});
