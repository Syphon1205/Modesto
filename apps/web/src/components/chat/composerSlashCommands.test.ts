import { describe, expect, it } from "vite-plus/test";

import {
  builtInComposerSlashCommandItems,
  listBuiltInComposerSlashCommands,
} from "./composerSlashCommands";

describe("built-in composer slash commands", () => {
  it("lists /side and /multiagent, not /spawn", () => {
    const commands = listBuiltInComposerSlashCommands({ planModeEnabled: false }).map(
      (command) => command.command,
    );

    expect(commands).toContain("side");
    expect(commands).toContain("multiagent");
    expect(commands).not.toContain("spawn");
  });

  it("keeps /spawn as a silent alias of /multiagent", () => {
    const multiagent = listBuiltInComposerSlashCommands({ planModeEnabled: false }).find(
      (command) => command.command === "multiagent",
    );

    expect(multiagent?.aliases).toEqual(["spawn"]);
    expect(multiagent?.description).toBe("Spawn additional agents");
  });

  it("describes /side as a sidechat in this conversation", () => {
    const side = listBuiltInComposerSlashCommands({ planModeEnabled: false }).find(
      (command) => command.command === "side",
    );

    expect(side?.label).toBe("/side");
    expect(side?.description).toBe("Start a sidechat in this conversation");
  });

  it("builds menu items with slash ids and the spawn alias", () => {
    const items = builtInComposerSlashCommandItems({ planModeEnabled: true });

    expect(items.map((item) => item.id)).toEqual([
      "slash:model",
      "slash:canvas",
      "slash:slides",
      "slash:docs",
      "slash:spreadsheets",
      "slash:side",
      "slash:multiagent",
      "slash:plan",
      "slash:default",
    ]);
    expect(items.find((item) => item.command === "multiagent")?.aliases).toEqual(["spawn"]);
  });
});
