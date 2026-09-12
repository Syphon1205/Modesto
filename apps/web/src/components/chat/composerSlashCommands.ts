import type { ComposerSlashCommand } from "../../composer-logic";
import type { ComposerCommandItem } from "./ComposerCommandMenu";

export type BuiltInComposerSlashCommand = {
  readonly command: ComposerSlashCommand;
  readonly label: string;
  readonly description: string;
  readonly aliases?: readonly string[];
};

const ALWAYS_VISIBLE_SLASH_COMMANDS = [
  {
    command: "model",
    label: "/model",
    description: "Switch response model for this thread",
  },
  {
    command: "canvas",
    label: "/canvas",
    description: "Build dashboards, slides, docs, or spreadsheets",
  },
  {
    command: "slides",
    label: "/slides",
    description: "HTML/CSS slides in Canvas",
  },
  {
    command: "docs",
    label: "/docs",
    description: "HTML/CSS document in Canvas",
  },
  {
    command: "spreadsheets",
    label: "/spreadsheets",
    description: "Open Canvas on spreadsheets",
  },
  {
    command: "side",
    label: "/side",
    description: "Start a sidechat in this conversation",
  },
  {
    command: "multiagent",
    label: "/multiagent",
    description: "Spawn additional agents",
    aliases: ["spawn"],
  },
] as const satisfies ReadonlyArray<BuiltInComposerSlashCommand>;

const PLAN_MODE_SLASH_COMMANDS = [
  {
    command: "plan",
    label: "/plan",
    description: "Switch this thread into plan mode",
  },
  {
    command: "default",
    label: "/default",
    description: "Switch this thread back to normal build mode",
  },
] as const satisfies ReadonlyArray<BuiltInComposerSlashCommand>;

export function listBuiltInComposerSlashCommands(input: {
  readonly planModeEnabled: boolean;
}): ReadonlyArray<BuiltInComposerSlashCommand> {
  return input.planModeEnabled
    ? [...ALWAYS_VISIBLE_SLASH_COMMANDS, ...PLAN_MODE_SLASH_COMMANDS]
    : ALWAYS_VISIBLE_SLASH_COMMANDS;
}

export function builtInComposerSlashCommandItems(input: {
  readonly planModeEnabled: boolean;
}): ReadonlyArray<Extract<ComposerCommandItem, { type: "slash-command" }>> {
  return listBuiltInComposerSlashCommands(input).map((command) => ({
    id: `slash:${command.command}`,
    type: "slash-command",
    command: command.command,
    label: command.label,
    description: command.description,
    ...(command.aliases ? { aliases: command.aliases } : {}),
  }));
}
