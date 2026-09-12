import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind } from "@modesto/contracts";

import type { ComposerCommandItem } from "./ComposerCommandMenu";
import { searchSlashCommandItems } from "./composerSlashCommandSearch";

describe("searchSlashCommandItems", () => {
  const claudeDriver = ProviderDriverKind.make("claudeAgent");

  it("moves exact provider command matches ahead of broader description matches", () => {
    const items = [
      {
        id: "slash:default",
        type: "slash-command",
        command: "default",
        label: "/default",
        description: "Switch this thread back to normal build mode",
      },
      {
        id: "provider-slash-command:claudeAgent:ui",
        type: "provider-slash-command",
        provider: claudeDriver,
        command: { name: "ui" },
        label: "/ui",
        description: "Explore, build, and refine UI.",
      },
      {
        id: "provider-slash-command:claudeAgent:frontend-design",
        type: "provider-slash-command",
        provider: claudeDriver,
        command: { name: "frontend-design" },
        label: "/frontend-design",
        description: "Create distinctive, production-grade frontend interfaces",
      },
    ] satisfies Array<
      Extract<ComposerCommandItem, { type: "slash-command" | "provider-slash-command" | "skill" }>
    >;

    expect(searchSlashCommandItems(items, "ui").map((item) => item.id)).toEqual([
      "provider-slash-command:claudeAgent:ui",
      "slash:default",
    ]);
  });

  it("supports fuzzy provider command matches", () => {
    const items = [
      {
        id: "provider-slash-command:claudeAgent:gh-fix-ci",
        type: "provider-slash-command",
        provider: claudeDriver,
        command: { name: "gh-fix-ci" },
        label: "/gh-fix-ci",
        description: "Fix failing GitHub Actions",
      },
      {
        id: "provider-slash-command:claudeAgent:github",
        type: "provider-slash-command",
        provider: claudeDriver,
        command: { name: "github" },
        label: "/github",
        description: "General GitHub help",
      },
    ] satisfies Array<
      Extract<ComposerCommandItem, { type: "slash-command" | "provider-slash-command" | "skill" }>
    >;

    expect(searchSlashCommandItems(items, "gfc").map((item) => item.id)).toEqual([
      "provider-slash-command:claudeAgent:gh-fix-ci",
    ]);
  });

  it("includes skills by name and description", () => {
    const items = [
      {
        id: "skill:claudeAgent:browser",
        type: "skill",
        provider: claudeDriver,
        skill: {
          name: "browser",
          path: "/skills/browser/SKILL.md",
          enabled: true,
          shortDescription: "Open and control the in-app browser",
        },
        label: "skill:browser",
        description: "Open and control the in-app browser",
      },
    ] satisfies Array<Extract<ComposerCommandItem, { type: "skill" }>>;

    expect(searchSlashCommandItems(items, "browser").map((item) => item.id)).toEqual([
      "skill:claudeAgent:browser",
    ]);
    expect(searchSlashCommandItems(items, "control").map((item) => item.id)).toEqual([
      "skill:claudeAgent:browser",
    ]);
  });

  it("matches skills by display name", () => {
    const items = [
      {
        id: "skill:claudeAgent:browser",
        type: "skill",
        provider: claudeDriver,
        skill: {
          name: "browser",
          displayName: "Web Navigator",
          path: "/skills/browser/SKILL.md",
          enabled: true,
          shortDescription: "Open and control the in-app browser",
        },
        label: "skill:browser",
        description: "Open and control the in-app browser",
      },
    ] satisfies Array<Extract<ComposerCommandItem, { type: "skill" }>>;

    expect(searchSlashCommandItems(items, "navigator").map((item) => item.id)).toEqual([
      "skill:claudeAgent:browser",
    ]);
  });

  it("matches skills by their rendered prefix", () => {
    const items = [
      {
        id: "skill:claudeAgent:browser",
        type: "skill",
        provider: claudeDriver,
        skill: {
          name: "browser",
          path: "/skills/browser/SKILL.md",
          enabled: true,
        },
        label: "skill:browser",
        description: "Open and control the in-app browser",
      },
    ] satisfies Array<Extract<ComposerCommandItem, { type: "skill" }>>;

    expect(searchSlashCommandItems(items, "/skill:brow").map((item) => item.id)).toEqual([
      "skill:claudeAgent:browser",
    ]);
    expect(searchSlashCommandItems(items, "/sk")).toEqual([]);
    expect(searchSlashCommandItems(items, "/ill")).toEqual([]);
  });

  it("keeps skills alongside commands for an empty slash query", () => {
    const items = [
      {
        id: "slash:model",
        type: "slash-command",
        command: "model",
        label: "/model",
        description: "Switch model",
      },
      {
        id: "skill:claudeAgent:unslop",
        type: "skill",
        provider: claudeDriver,
        skill: {
          name: "unslop",
          path: "/skills/unslop/SKILL.md",
          enabled: true,
        },
        label: "skill:unslop",
        description: "Cut AI tells from writing",
      },
    ] satisfies Array<Extract<ComposerCommandItem, { type: "slash-command" | "skill" }>>;

    expect(searchSlashCommandItems(items, "").map((item) => item.id)).toEqual([
      "slash:model",
      "skill:claudeAgent:unslop",
    ]);
  });

  it("surfaces web apps from a slash typo as Did you mean", () => {
    const items = [
      {
        id: "web-app:slack",
        type: "web-app",
        app: {
          id: "slack",
          name: "Slack",
          description: "Read and post in your Slack workspaces.",
          category: "chat",
          homeUrl: "https://app.slack.com/client",
          signInUrl: "https://slack.com/signin",
          cookieDomain: ".slack.com",
          sessionCookieNames: ["d"],
          mentionAliases: ["slack-chat"],
          capabilityHint: "read and send messages",
        },
        label: "@slack",
        description: "read and send messages",
      },
    ] satisfies Array<Extract<ComposerCommandItem, { type: "web-app" }>>;

    const result = searchSlashCommandItems(items, "slak");
    expect(result).toEqual([expect.objectContaining({ id: "web-app:slack", didYouMean: true })]);
  });

  it("resolves the silent /spawn alias to /multiagent", () => {
    const items = [
      {
        id: "slash:side",
        type: "slash-command",
        command: "side",
        label: "/side",
        description: "Start a sidechat in this conversation",
      },
      {
        id: "slash:multiagent",
        type: "slash-command",
        command: "multiagent",
        label: "/multiagent",
        description: "Spawn additional agents",
        aliases: ["spawn"],
      },
    ] satisfies Array<Extract<ComposerCommandItem, { type: "slash-command" }>>;

    expect(searchSlashCommandItems(items, "spawn").map((item) => item.id)).toEqual([
      "slash:multiagent",
    ]);
    expect(searchSlashCommandItems(items, "side").map((item) => item.id)).toEqual(["slash:side"]);
  });
});
