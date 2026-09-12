import type { ScopedProjectRef, ScopedThreadRef } from "@modesto/contracts";
import { scopedProjectKey, scopeProjectRef } from "@modesto/client-runtime/environment";
import { FolderPlusIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { openCommandPalette } from "~/commandPaletteBus";
import { type ConversationMode, type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useClientSettings } from "~/hooks/useSettings";
import {
  LANDING_GREETING_PROJECT_TOKEN,
  randomChatLandingGreeting,
  randomHomeLandingGreeting,
  randomProjectLandingGreeting,
} from "~/lib/greeting";
import { selectProjectGroupingSettings } from "~/logicalProject";
import {
  buildSidebarProjectPickerEntries,
  buildSidebarProjectSnapshots,
} from "~/sidebarProjectGrouping";
import { useProjects, useThreadShells } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { ChatLandingSuggestions } from "./ChatLandingSuggestions";
import {
  CHAT_LANDING_SUGGESTION_CATEGORIES,
  LANDING_SUGGESTION_CATEGORIES,
} from "./ChatLandingSuggestions.logic";
import { ComposerConversationModeToggle } from "./ComposerConversationModeToggle";
import { ModestoLogo } from "../ModestoLogo";
import { sortLogicalProjectsForSidebar } from "../Sidebar.logic";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface DraftHeroHeadlineProps {
  readonly activeProjectRef: ScopedProjectRef | null;
  readonly activeProjectTitle: string | null;
  readonly conversationMode: ConversationMode;
  readonly allowConversationModeChange?: boolean;
  readonly onConversationModeChange?: (mode: ConversationMode) => void;
}

/**
 * Starter cards, rendered separately from the headline so the caller can place
 * them below the composer (Kimi-style) instead of stacked above it.
 */
export function DraftComposerSuggestions({
  composerDraftTarget,
  conversationMode,
  className,
}: {
  composerDraftTarget: ScopedThreadRef | DraftId;
  conversationMode: ConversationMode;
  className?: string;
}) {
  const hasProjects = useProjects().length > 0;
  const setComposerDraftPrompt = useComposerDraftStore((store) => store.setPrompt);
  const composerPrompt = useComposerDraftStore(
    (store) => store.getComposerDraft(composerDraftTarget)?.prompt ?? "",
  );
  const applyLandingSuggestion = useCallback(
    (prompt: string) => {
      setComposerDraftPrompt(composerDraftTarget, prompt);
    },
    [composerDraftTarget, setComposerDraftPrompt],
  );
  if (!hasProjects) {
    return null;
  }
  return (
    <ChatLandingSuggestions
      prompt={composerPrompt}
      onSelect={applyLandingSuggestion}
      categories={
        conversationMode === "chat"
          ? CHAT_LANDING_SUGGESTION_CATEGORIES
          : LANDING_SUGGESTION_CATEGORIES
      }
      className={className}
    />
  );
}

export function DraftHeroHeadline({
  activeProjectRef,
  activeProjectTitle,
  conversationMode,
  allowConversationModeChange = false,
  onConversationModeChange,
}: DraftHeroHeadlineProps) {
  // Picked once per landing mount (not on every render) so the greeting stays
  // put while typing, but rolls a fresh time-aware variant each time a new
  // empty draft is opened.
  const [homeLandingGreeting] = useState(randomHomeLandingGreeting);
  const [chatLandingGreeting] = useState(randomChatLandingGreeting);
  const [projectLandingGreetingTemplate] = useState(randomProjectLandingGreeting);
  const [projectLandingGreetingBefore, projectLandingGreetingAfter] = useMemo(
    () => projectLandingGreetingTemplate.split(LANDING_GREETING_PROJECT_TOKEN),
    [projectLandingGreetingTemplate],
  );
  const projects = useProjects();
  const threads = useThreadShells();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const projectSortOrder = useClientSettings((settings) => settings.sidebarProjectSortOrder);
  const handleNewThread = useNewThreadHandler();
  const openAddProject = useCallback(() => openCommandPalette({ open: "add-project" }), []);

  const environmentLabelById = useMemo(
    () =>
      new Map(
        environments.map((environment) => [environment.environmentId, environment.label] as const),
      ),
    [environments],
  );
  const projectGroups = useMemo(
    () =>
      sortLogicalProjectsForSidebar(
        buildSidebarProjectSnapshots({
          projects,
          settings: projectGroupingSettings,
          primaryEnvironmentId,
          resolveEnvironmentLabel: (environmentId) =>
            environmentLabelById.get(environmentId) ?? null,
        }),
        threads,
        projectSortOrder,
      ),
    [
      environmentLabelById,
      primaryEnvironmentId,
      projectGroupingSettings,
      projectSortOrder,
      projects,
      threads,
    ],
  );
  const projectPickerEntries = useMemo(
    () =>
      buildSidebarProjectPickerEntries({
        groups: projectGroups,
        preferredProjectRef: activeProjectRef,
      }),
    [activeProjectRef, projectGroups],
  );
  const projectEntryByKey = useMemo(
    () => new Map(projectPickerEntries.map((entry) => [entry.group.projectKey, entry] as const)),
    [projectPickerEntries],
  );
  const activeProjectGroup =
    activeProjectRef === null
      ? null
      : (projectGroups.find((group) =>
          group.memberProjectRefs.some(
            (projectRef) => scopedProjectKey(projectRef) === scopedProjectKey(activeProjectRef),
          ),
        ) ?? null);
  const activeProjectKey = activeProjectGroup?.projectKey ?? "";
  const activeProjectDisplayName = activeProjectGroup?.displayName ?? activeProjectTitle;
  const hasResolvedProject = activeProjectTitle !== null;
  const canChooseProject = projectPickerEntries.length > 0;
  const shouldShowProjectMenu = canChooseProject;

  const projectSelector = shouldShowProjectMenu ? (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              aria-label={hasResolvedProject ? "Change project" : "Choose a project"}
              className="pointer-events-auto inline-block max-w-64 truncate border-foreground/60 border-b border-dotted align-baseline text-foreground transition-colors hover:border-foreground/80 focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          {activeProjectDisplayName ?? "Choose a project"}
        </TooltipTrigger>
        {activeProjectDisplayName ? (
          <TooltipPopup side="top" className="max-w-80">
            {activeProjectDisplayName}
          </TooltipPopup>
        ) : null}
      </Tooltip>
      <MenuPopup align="center" className="max-h-80 min-w-40! w-max max-w-64 overflow-y-auto">
        <MenuRadioGroup
          value={activeProjectKey}
          onValueChange={(value) => {
            const entry = projectEntryByKey.get(value as string);
            if (!entry || value === activeProjectKey) {
              return;
            }
            const project = entry.targetProject;
            // Changing the repo of a draft moves the typed content along:
            // the user started writing in the wrong project, not a new task.
            void handleNewThread(scopeProjectRef(project.environmentId, project.id), {
              replace: true,
              carryComposerContent: true,
            });
          }}
        >
          {projectPickerEntries.map(({ group }) => {
            return (
              <MenuRadioItem key={group.projectKey} value={group.projectKey} closeOnClick>
                <Tooltip>
                  <TooltipTrigger render={<span className="block min-w-0 truncate" />}>
                    {group.displayName}
                  </TooltipTrigger>
                  <TooltipPopup side="top" className="max-w-80">
                    {group.displayName}
                  </TooltipPopup>
                </Tooltip>
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onClick={openAddProject}>
          <FolderPlusIcon />
          New project
        </MenuItem>
      </MenuPopup>
    </Menu>
  ) : (
    <button
      type="button"
      onClick={openAddProject}
      className="pointer-events-auto inline cursor-pointer border-muted-foreground/35 border-b border-dotted text-muted-foreground/60 transition-colors hover:border-muted-foreground/60 hover:text-muted-foreground/80 focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {activeProjectTitle ?? "Add a project"}
    </button>
  );

  // A fresh, unscoped draft (the "New Chat" landing) shows the project picker
  // as its own visible row instead of only as dotted-underline text buried in
  // the greeting sentence - Codex keeps its folder picker in the same spot,
  // right above the composer, so switching/adding a project never leaves this
  // screen.
  const workInProjectRow = !hasResolvedProject ? (
    shouldShowProjectMenu ? (
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          }
        >
          <FolderPlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
          Work in a project
        </MenuTrigger>
        <MenuPopup align="center" className="max-h-80 min-w-40! w-max max-w-64 overflow-y-auto">
          <MenuRadioGroup
            value={activeProjectKey}
            onValueChange={(value) => {
              const entry = projectEntryByKey.get(value as string);
              if (!entry || value === activeProjectKey) return;
              const project = entry.targetProject;
              void handleNewThread(scopeProjectRef(project.environmentId, project.id), {
                replace: true,
                carryComposerContent: true,
              });
            }}
          >
            {projectPickerEntries.map(({ group }) => (
              <MenuRadioItem key={group.projectKey} value={group.projectKey} closeOnClick>
                {group.displayName}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem onClick={openAddProject}>
            <FolderPlusIcon />
            New project
          </MenuItem>
        </MenuPopup>
      </Menu>
    ) : (
      <button
        type="button"
        onClick={openAddProject}
        className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <FolderPlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
        Add a project
      </button>
    )
  ) : null;

  const isChat = conversationMode === "chat";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 text-center select-none">
      <ModestoLogo aria-label="Modesto logo" className="size-10" />
      <h1 className="font-normal text-2xl text-foreground tracking-tight sm:text-3xl">
        {isChat ? (
          chatLandingGreeting
        ) : hasResolvedProject ? (
          <>
            {projectLandingGreetingBefore}
            {projectSelector}
            {projectLandingGreetingAfter}
          </>
        ) : (
          homeLandingGreeting
        )}
      </h1>
      {allowConversationModeChange && onConversationModeChange ? (
        <ComposerConversationModeToggle
          value={conversationMode}
          onChange={onConversationModeChange}
        />
      ) : null}
      {isChat ? null : workInProjectRow}
    </div>
  );
}
