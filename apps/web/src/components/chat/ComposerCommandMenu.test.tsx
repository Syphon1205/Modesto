import { renderToStaticMarkup } from "react-dom/server";
import { ProviderDriverKind } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import { ComposerCommandMenu } from "./ComposerCommandMenu";

describe("ComposerCommandMenu", () => {
  it("renders slash-command results as an attached composer drawer", () => {
    const markup = renderToStaticMarkup(
      <ComposerCommandMenu
        items={[]}
        resolvedTheme="dark"
        isLoading={false}
        triggerKind="slash-command"
        activeItemId={null}
        onHighlightedItemChange={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain('data-composer-command-drawer="true"');
    expect(markup).toContain("chat-composer-drawer-surface");
    expect(markup).toContain("chat-composer-drawer-attached");
    expect(markup).not.toContain("dropdown-glass");
  });

  it("renders a path result with a file icon", () => {
    const markup = renderToStaticMarkup(
      <ComposerCommandMenu
        items={[
          {
            id: "path:README.md",
            type: "path",
            path: "README.md",
            pathKind: "file",
            label: "README.md",
            description: "Project file",
          },
        ]}
        resolvedTheme="dark"
        isLoading={false}
        triggerKind="path"
        activeItemId="path:README.md"
        onHighlightedItemChange={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain("README.md");
    expect(markup).toContain("Project file");
    expect(markup).toContain("<svg");
  });

  it("renders a command icon next to /model", () => {
    const markup = renderToStaticMarkup(
      <ComposerCommandMenu
        items={[
          {
            id: "slash:model",
            type: "slash-command",
            command: "model",
            label: "/model",
            description: "Switch response model for this thread",
          },
        ]}
        resolvedTheme="dark"
        isLoading={false}
        triggerKind="slash-command"
        activeItemId="slash:model"
        onHighlightedItemChange={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain("/model");
    expect(markup).toContain("Switch response model for this thread");
    expect(markup).not.toContain("Built-in");
    expect(markup).toContain("<svg");
    expect(markup).toContain("font-sans text-xs font-medium");
    expect(markup).not.toContain("font-mono");
    expect(markup).toContain("text-right");
  });

  it("renders /side and /multiagent with their descriptions", () => {
    const markup = renderToStaticMarkup(
      <ComposerCommandMenu
        items={[
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
        ]}
        resolvedTheme="dark"
        isLoading={false}
        triggerKind="slash-command"
        activeItemId="slash:side"
        onHighlightedItemChange={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain("/side");
    expect(markup).toContain("Start a sidechat in this conversation");
    expect(markup).toContain("/multiagent");
    expect(markup).toContain("Spawn additional agents");
    expect(markup).not.toContain("/spawn");
  });

  it("renders an svg icon next to /slides", () => {
    const markup = renderToStaticMarkup(
      <ComposerCommandMenu
        items={[
          {
            id: "slash:slides",
            type: "slash-command",
            command: "slides",
            label: "/slides",
            description: "Open the Slides panel",
          },
        ]}
        resolvedTheme="dark"
        isLoading={false}
        triggerKind="slash-command"
        activeItemId="slash:slides"
        onHighlightedItemChange={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain("/slides");
    expect(markup).toContain("<svg");
  });

  it("renders a skill source icon with an accessible source label", () => {
    const markup = renderToStaticMarkup(
      <ComposerCommandMenu
        items={[
          {
            id: "skill:codex:browser",
            type: "skill",
            provider: ProviderDriverKind.make("codex"),
            skill: {
              name: "browser",
              path: "/Users/maria/.codex/plugins/browser/skills/browser/SKILL.md",
              scope: "user",
              enabled: true,
            },
            label: "Browser",
            description: "Open and control the in-app browser",
          },
        ]}
        resolvedTheme="dark"
        isLoading={false}
        triggerKind="skill"
        activeItemId="skill:codex:browser"
        onHighlightedItemChange={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain("Browser");
    expect(markup).toContain('<span class="sr-only">App skill</span>');
    expect(markup).toContain("<svg");
    expect(markup).toContain("text-icon-muted");
  });

  it("renders slash skill results with only the skill prefix dimmed", () => {
    const markup = renderToStaticMarkup(
      <ComposerCommandMenu
        items={[
          {
            id: "skill:codex:browser",
            type: "skill",
            provider: ProviderDriverKind.make("codex"),
            skill: {
              name: "browser",
              path: "/skills/browser/SKILL.md",
              enabled: true,
            },
            label: "skill:browser",
            description: "Open and control the in-app browser",
          },
        ]}
        resolvedTheme="dark"
        isLoading={false}
        triggerKind="slash-command"
        activeItemId="skill:codex:browser"
        onHighlightedItemChange={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain('<span class="text-secondary-label">skill:</span>browser');
    expect(markup).toContain("Open and control the in-app browser");
    expect(markup).not.toContain("font-medium text-secondary-label");
    expect(markup).toContain("<svg");
  });
});
