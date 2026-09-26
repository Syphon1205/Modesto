import type { ScopedProjectRef, ScopedThreadRef } from "@modesto/contracts";
import { FolderPlusIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { type ConversationMode, type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { useClientSettings } from "~/hooks/useSettings";
import {
  LANDING_GREETING_PROJECT_TOKEN,
  randomChatLandingGreeting,
  randomHomeLandingGreeting,
  randomProjectLandingGreeting,
} from "~/lib/greeting";
import { codexDraftHeadline, providerLayoutOf } from "~/providerLayouts";
import { useProjects } from "~/state/entities";
import { ChatLandingSuggestions } from "./ChatLandingSuggestions";
import {
  CHAT_LANDING_SUGGESTION_CATEGORIES,
  GITHUB_LANDING_SUGGESTION_CATEGORIES,
  LANDING_SUGGESTION_CATEGORIES,
} from "./ChatLandingSuggestions.logic";
import { ComposerConversationModeToggle } from "./ComposerConversationModeToggle";
import { ModestoLogo } from "../ModestoLogo";
import { ModestoWordmark } from "../ModestoWordmark";
import { DraftProjectMenu, useDraftProjectPicker } from "./DraftProjectPicker";

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
  const interfaceStyle = useClientSettings((settings) => settings.interfaceStyle);
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
  const providerLayout = providerLayoutOf(interfaceStyle);
  if (providerLayout !== null && providerLayout !== "codex") {
    return null;
  }
  if (!hasProjects && interfaceStyle !== "github") {
    return null;
  }
  return (
    <ChatLandingSuggestions
      prompt={composerPrompt}
      onSelect={applyLandingSuggestion}
      categories={
        interfaceStyle === "github"
          ? GITHUB_LANDING_SUGGESTION_CATEGORIES
          : conversationMode === "chat"
            ? CHAT_LANDING_SUGGESTION_CATEGORIES
            : LANDING_SUGGESTION_CATEGORIES
      }
      className={className}
      variant={providerLayout === "codex" ? "list" : "cards"}
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
  const interfaceStyle = useClientSettings((settings) => settings.interfaceStyle);
  const picker = useDraftProjectPicker(activeProjectRef, activeProjectTitle);
  const activeProjectDisplayName = picker.activeDisplayName;
  const hasResolvedProject = activeProjectTitle !== null;

  const projectSelector = picker.canChoose ? (
    <DraftProjectMenu
      picker={picker}
      tooltip={activeProjectDisplayName}
      trigger={
        <button
          type="button"
          aria-label={hasResolvedProject ? "Change project" : "Choose a project"}
          className="pointer-events-auto inline-block max-w-64 truncate border-foreground/60 border-b border-dotted align-baseline text-foreground transition-colors hover:border-foreground/80 focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
      }
    >
      {activeProjectDisplayName ?? "Choose a project"}
    </DraftProjectMenu>
  ) : (
    <button
      type="button"
      onClick={picker.openAddProject}
      className="pointer-events-auto inline cursor-pointer border-muted-foreground/35 border-b border-dotted text-muted-foreground/60 transition-colors hover:border-muted-foreground/60 hover:text-muted-foreground/80 focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {activeProjectTitle ?? "Add a project"}
    </button>
  );

  // A fresh, unscoped draft (the "New Chat" landing) shows the project picker
  // as its own visible row instead of only as dotted-underline text buried in
  // the greeting sentence, so switching/adding a project never leaves this
  // screen.
  const workInProjectRowClassName =
    "pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const workInProjectRow = !hasResolvedProject ? (
    picker.canChoose ? (
      <DraftProjectMenu
        picker={picker}
        trigger={<button type="button" className={workInProjectRowClassName} />}
      >
        <FolderPlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
        Work in a project
      </DraftProjectMenu>
    ) : (
      <button type="button" onClick={picker.openAddProject} className={workInProjectRowClassName}>
        <FolderPlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
        Add a project
      </button>
    )
  ) : null;

  const isChat = conversationMode === "chat";

  if (interfaceStyle === "opencode") {
    return <ModestoWordmark />;
  }

  if (interfaceStyle === "github") {
    return (
      <div
        data-github-draft-hero=""
        className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 text-center select-none"
      >
        <ModestoLogo aria-label="Modesto logo" className="size-14 text-muted-foreground/70" />
      </div>
    );
  }

  if (interfaceStyle === "codex") {
    // Codex names the project the task will run in; the picker itself lives
    // in the tray under the composer.
    return (
      <h1
        data-provider-draft-headline="codex"
        className="mx-auto w-full max-w-3xl text-center text-[28px] font-medium tracking-[-0.02em] text-foreground select-none"
      >
        {isChat ? "What can I help with?" : codexDraftHeadline(activeProjectDisplayName)}
      </h1>
    );
  }

  if (providerLayoutOf(interfaceStyle) !== null) {
    return null;
  }

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
