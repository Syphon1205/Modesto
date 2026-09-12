import {
  resolveProviderSkillSourceKind,
  type ProviderSkillSourceKind,
} from "@modesto/client-runtime/providerSkills";
import {
  type ProjectEntry,
  type ProviderDriverKind,
  type ServerProviderSkill,
  type ServerProviderSlashCommand,
} from "@modesto/contracts";
import {
  BlocksIcon,
  FolderGit2Icon,
  FolderIcon,
  PackageIcon,
  SettingsIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { memo, useLayoutEffect, useRef } from "react";

import { type ComposerSlashCommand, type ComposerTriggerKind } from "../../composer-logic";
import { cn } from "~/lib/utils";
import { NativeAppMenuIcon } from "~/components/NativeAppIcons";
import { webAppIcon } from "~/components/WebAppIcons";
import type { NativeApp } from "@modesto/shared/nativeApps";
import type { WebApp } from "~/connections/webApps";
import { Command, CommandGroup, CommandItem, CommandList } from "../ui/command";
import { PierreEntryIcon } from "./PierreEntryIcon";
import { ComposerSlashCommandIcon } from "./slashCommandMenuIcon";

export type ComposerCommandItem =
  | {
      id: string;
      type: "path";
      path: string;
      pathKind: ProjectEntry["kind"];
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "slash-command";
      command: ComposerSlashCommand;
      label: string;
      description: string;
      aliases?: readonly string[];
      didYouMean?: boolean;
    }
  | {
      id: string;
      type: "provider-slash-command";
      provider: ProviderDriverKind;
      command: ServerProviderSlashCommand;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "skill";
      provider: ProviderDriverKind;
      skill: ServerProviderSkill;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "web-app";
      app: WebApp;
      label: string;
      description: string;
      didYouMean?: boolean;
    }
  | {
      id: string;
      type: "native-app";
      app: NativeApp;
      label: string;
      description: string;
      didYouMean?: boolean;
    };

export const ComposerCommandMenu = memo(function ComposerCommandMenu(props: {
  items: ComposerCommandItem[];
  resolvedTheme: "light" | "dark";
  isLoading: boolean;
  triggerKind: ComposerTriggerKind | null;
  emptyStateText?: string;
  activeItemId: string | null;
  onHighlightedItemChange: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!props.activeItemId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-composer-item-id="${CSS.escape(props.activeItemId)}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [props.activeItemId]);

  const emptyStateLabel = props.isLoading
    ? props.triggerKind === "skill"
      ? "Searching workspace skills..."
      : "Searching workspace files..."
    : (props.emptyStateText ??
      (props.triggerKind === "skill"
        ? "No skills found. Try / to browse provider commands."
        : props.triggerKind === "path"
          ? "No matching files, folders, or apps."
          : "No matching command."));

  return (
    <Command
      autoHighlight={false}
      mode="none"
      onItemHighlighted={(highlightedValue) => {
        props.onHighlightedItemChange(
          typeof highlightedValue === "string" ? highlightedValue : null,
        );
      }}
    >
      <div
        ref={listRef}
        className="chat-composer-drawer-surface chat-composer-drawer-attached relative w-full overflow-hidden **:data-[slot=scroll-area-scrollbar]:data-[orientation=vertical]:my-4"
        data-composer-command-drawer="true"
      >
        {props.items.length > 0 ? (
          <CommandList className="max-h-72 scroll-pb-6">
            <CommandGroup>
              {props.items.map((item) => (
                <ComposerCommandMenuItem
                  key={item.id}
                  item={item}
                  triggerKind={props.triggerKind}
                  resolvedTheme={props.resolvedTheme}
                  isActive={props.activeItemId === item.id}
                  onHighlight={props.onHighlightedItemChange}
                  onSelect={props.onSelect}
                />
              ))}
            </CommandGroup>
          </CommandList>
        ) : (
          <div className="px-5 pt-3.5 pb-7">
            <p className="text-secondary-label text-xs">{emptyStateLabel}</p>
          </div>
        )}
      </div>
    </Command>
  );
});

const ComposerCommandMenuItem = memo(function ComposerCommandMenuItem(props: {
  item: ComposerCommandItem;
  triggerKind: ComposerTriggerKind | null;
  resolvedTheme: "light" | "dark";
  isActive: boolean;
  onHighlight: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  const skillSourceKind =
    props.item.type === "skill" ? resolveProviderSkillSourceKind(props.item.skill) : null;
  const slashSkill =
    props.triggerKind === "slash-command" && props.item.type === "skill" ? props.item.skill : null;

  return (
    <CommandItem
      value={props.item.id}
      data-composer-item-id={props.item.id}
      className={cn(
        "cursor-pointer select-none gap-3 rounded-lg px-3 py-2! hover:bg-transparent hover:text-inherit data-highlighted:bg-transparent data-highlighted:text-inherit",
        props.isActive && "bg-accent! text-accent-foreground!",
      )}
      onMouseMove={() => {
        if (!props.isActive) props.onHighlight(props.item.id);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        props.onSelect(props.item);
      }}
    >
      {props.item.type === "path" ? (
        <PierreEntryIcon
          pathValue={props.item.path}
          kind={props.item.pathKind}
          theme={props.resolvedTheme}
        />
      ) : props.item.type === "web-app" ? (
        <WebAppMenuIcon id={props.item.app.id} />
      ) : props.item.type === "native-app" ? (
        <NativeAppMenuIcon id={props.item.app.id} />
      ) : props.item.type === "slash-command" ? (
        <ComposerSlashCommandIcon name={props.item.command} />
      ) : props.item.type === "provider-slash-command" ? (
        <ComposerSlashCommandIcon name={props.item.command.name} />
      ) : skillSourceKind ? (
        <SkillSourceIcon kind={skillSourceKind} />
      ) : null}
      <span className="flex min-w-0 flex-1 items-baseline gap-3">
        <span className="shrink-0 font-sans text-xs font-medium">
          {slashSkill ? (
            <>
              <span className="text-secondary-label">skill:</span>
              {slashSkill.name}
            </>
          ) : (
            props.item.label
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-secondary-label text-xs">
          {"didYouMean" in props.item && props.item.didYouMean
            ? `Did you mean ${
                props.item.type === "web-app" || props.item.type === "native-app"
                  ? props.item.app.name
                  : props.item.label
              }?`
            : props.item.description}
        </span>
      </span>
    </CommandItem>
  );
});

const SKILL_SOURCE_ICON_BY_KIND: Record<ProviderSkillSourceKind, LucideIcon> = {
  app: BlocksIcon,
  repo: FolderGit2Icon,
  project: FolderIcon,
  personal: UserRoundIcon,
  system: SettingsIcon,
  other: PackageIcon,
};

const SKILL_SOURCE_LABEL_BY_KIND: Record<ProviderSkillSourceKind, string> = {
  app: "App",
  repo: "Repo",
  project: "Project",
  personal: "Personal",
  system: "System",
  other: "Other",
};

function SkillSourceIcon(props: { kind: ProviderSkillSourceKind }) {
  const Icon = SKILL_SOURCE_ICON_BY_KIND[props.kind];
  return (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-icon-muted" />
      <span className="sr-only">{SKILL_SOURCE_LABEL_BY_KIND[props.kind]} skill</span>
    </>
  );
}

function WebAppMenuIcon(props: { id: string }) {
  const Icon = webAppIcon(props.id);
  return <Icon className="size-4 shrink-0" aria-hidden />;
}
