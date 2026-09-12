// FILE: useDispatchAgentBot.ts
// Purpose: Hand a task to a bot — open a thread in its home project with its
//          persona and the task already in the composer.
// Layer: Agents UI (state)
//
// Dispatch deliberately stops at a *loaded composer* rather than sending. The
// persona is prepended text the user is entitled to see and edit before it
// reaches a provider, and "an agent silently started working in your
// codebase" is the wrong default for a one-click roster button.
//
// The bot stores its project and provider as plain strings, and this hook
// resolves them against the live entity lists rather than casting them back
// into branded ids. That is not ceremony: a bot can outlive the project it was
// pointed at or the provider it was configured with, and resolving is the only
// way to notice instead of dispatching into a project that no longer exists.

import type { AgentBot } from "@modesto/contracts";
import { useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@modesto/client-runtime/environment";
import { useCallback } from "react";

import { composeBotTaskPrompt } from "./agentRoster";
import { linkThreadToBot } from "./agentThreadLinks";
import { useComposerDraftStore } from "../composerDraftStore";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { deriveProviderInstanceEntries } from "~/providerInstances";
import { useProjects } from "~/state/entities";
import { primaryServerProvidersAtom } from "~/state/server";
import { toastManager } from "~/components/ui/toast";

/** `environmentId:projectId`, the shape stored on `bot.homeProjectKey`. */
export function formatProjectKey(environmentId: string, projectId: string): string {
  return `${environmentId}:${projectId}`;
}

export function useDispatchAgentBot(): (bot: AgentBot, task: string) => Promise<boolean> {
  const { handleNewThread, defaultProjectRef } = useHandleNewThread();
  const projects = useProjects();
  const providers = useAtomValue(primaryServerProvidersAtom);

  return useCallback(
    async (bot, task) => {
      const home = bot.homeProjectKey
        ? projects.find(
            (project) => formatProjectKey(project.environmentId, project.id) === bot.homeProjectKey,
          )
        : undefined;

      if (bot.homeProjectKey && !home) {
        toastManager.add({
          type: "error",
          title: `${bot.name}'s project is unavailable`,
          description: "Choose another project in the agent settings, then try again.",
        });
        return false;
      }

      const projectRef = home ? scopeProjectRef(home.environmentId, home.id) : defaultProjectRef;

      if (!projectRef) {
        toastManager.add({
          type: "error",
          title: `${bot.name} has nowhere to work`,
          description: "Give the agent a project in its settings, or open a project first.",
        });
        return false;
      }

      const instance = bot.model
        ? deriveProviderInstanceEntries(providers).find(
            (entry) => entry.instanceId === bot.model?.providerId,
          )
        : undefined;
      if (bot.model && !instance?.models.some((model) => model.slug === bot.model?.modelId)) {
        toastManager.add({
          type: "error",
          title: `${bot.name}'s model is unavailable`,
          description: "Choose an available model or Composer default in the agent settings.",
        });
        return false;
      }

      const opened = await handleNewThread(projectRef, { conversationMode: "code" });
      if (!opened) {
        toastManager.add({ type: "error", title: `Could not start a thread for ${bot.name}` });
        return false;
      }

      // Record the link before touching the composer: this is what makes the
      // roster able to say "Scout is working" rather than showing every bot
      // permanently idle.
      linkThreadToBot(projectRef.environmentId, opened.threadId, bot.id);

      const store = useComposerDraftStore.getState();
      store.setPrompt(opened.draftId, composeBotTaskPrompt(bot, task));

      if (instance && bot.model) {
        store.setModelSelection(
          opened.draftId,
          { instanceId: instance.instanceId, model: bot.model.modelId },
          { replaceOptions: true },
        );
      }
      return true;
    },
    [handleNewThread, defaultProjectRef, projects, providers],
  );
}
