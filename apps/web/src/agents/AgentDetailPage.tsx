// FILE: AgentDetailPage.tsx
// Purpose: One bot's home — who it is, what it has been doing, and the box
//          you hand it the next task in.
// Layer: Agents UI
//
// The bot's page, not a chat. Rakazo's rule is that a teammate's continuity is
// part of its identity, so everything it has worked on lives here under one
// name rather than scattering into the chat list where it becomes
// indistinguishable from everything else. Modesto keeps each task in its own
// thread (that is how work gets reviewed and reverted here) but gathers them
// under the bot that ran them.

import type { AgentBotDraft } from "@modesto/contracts";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, PencilIcon, SendIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";

import { AgentBotDialog } from "./AgentBotDialog";
import { ACTIVITY_LABELS, ACTIVITY_DOT_CLASS, AgentPresence } from "./AgentPresence";
import { useAgentBot, useAgentBotStore } from "./agentBotStore";
import { useAgentThreadLinkStore, useAgentThreadLinks, threadLinkKey } from "./agentThreadLinks";
import { rollUpBotActivity, threadsForBot } from "./agentRoster";
import { useRosterThreads } from "./AgentsPage";
import { useDispatchAgentBot } from "./useDispatchAgentBot";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { toastManager } from "~/components/ui/toast";
import { SidebarInset } from "~/components/ui/sidebar";
import { requestConfirmDialog } from "~/confirmDialog";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { useProjects, useThreadShells } from "~/state/entities";

export function AgentDetailPage({ agentId }: { readonly agentId: string }) {
  const bot = useAgentBot(agentId);
  const updateBot = useAgentBotStore((state) => state.updateBot);
  const removeBot = useAgentBotStore((state) => state.removeBot);
  const forgetBot = useAgentThreadLinkStore((state) => state.forgetBot);
  const links = useAgentThreadLinks();
  const threadShells = useThreadShells();
  const projects = useProjects();
  const rosterThreads = useRosterThreads();
  const dispatch = useDispatchAgentBot();
  const navigate = useNavigate();

  const [task, setTask] = useState("");
  const [editing, setEditing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);

  const activity = useMemo(
    () => (bot ? rollUpBotActivity(threadsForBot(rosterThreads, bot.id)) : "idle"),
    [rosterThreads, bot],
  );

  /** This bot's threads, newest first, with enough to render a row. */
  const work = useMemo(() => {
    if (!bot) return [];
    const projectByKey = new Map(
      projects.map((project) => [`${project.environmentId}:${project.id}`, project]),
    );
    return threadShells
      .filter((thread) => links[threadLinkKey(thread.environmentId, thread.id)] === bot.id)
      .map((thread) => ({
        environmentId: thread.environmentId,
        threadId: thread.id,
        title: thread.title,
        projectTitle:
          projectByKey.get(`${thread.environmentId}:${thread.projectId}`)?.title ?? "Project",
        updatedAt: Date.parse(thread.updatedAt),
      }))
      .toSorted((left, right) => right.updatedAt - left.updatedAt);
  }, [bot, threadShells, links, projects]);

  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const trimmed = task.trim();
      if (!bot || trimmed === "" || preparingRef.current) return;
      preparingRef.current = true;
      setPreparing(true);
      void dispatch(bot, trimmed)
        .then((opened) => {
          if (opened) setTask("");
        })
        .catch((error: unknown) => {
          toastManager.add({
            type: "error",
            title: `Could not prepare a task for ${bot.name}`,
            description: error instanceof Error ? error.message : "Please try again.",
          });
        })
        .finally(() => {
          preparingRef.current = false;
          setPreparing(false);
        });
    },
    [bot, task, dispatch],
  );

  const handleEdit = useCallback(
    (draft: AgentBotDraft) => {
      if (bot) updateBot(bot.id, draft);
    },
    [bot, updateBot],
  );

  const handleDelete = useCallback(async () => {
    if (!bot) return;
    // Deleting a teammate is not an undo-able click. Live test: an accidental
    // press on the roster destroyed a bot with no way back.
    const confirmation = requestConfirmDialog(
      `Delete ${bot.name}? Threads it started stay in your project, but stop being attributed to it.`,
      { variant: "destructive" },
    );
    // `undefined` means no dialog host is mounted. Deleting anyway would be
    // the silent destruction this guard exists to prevent.
    if (confirmation === undefined) return;
    if (!(await confirmation)) return;
    removeBot(bot.id);
    forgetBot(bot.id);
    void navigate({ to: "/agents" });
  }, [bot, removeBot, forgetBot, navigate]);

  if (!bot) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">That agent no longer exists.</p>
          <Link to="/agents" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to agents
          </Link>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <WorkspacePageHeader electron={isElectron} className="border-b border-border">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                size="icon-micro"
                variant="ghost"
                aria-label="Back to agents"
                onClick={() => void navigate({ to: "/agents" })}
              >
                <ArrowLeftIcon className="size-3.5" />
              </Button>
              <span className="truncate text-sm font-medium text-foreground">{bot.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="icon-micro"
                variant="ghost"
                aria-label={`Edit ${bot.name}`}
                onClick={() => setEditing(true)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-micro"
                variant="ghost"
                aria-label={`Delete ${bot.name}`}
                onClick={() => void handleDelete()}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>
        </WorkspacePageHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <div className="flex min-w-0 items-center gap-4">
              <AgentPresence bot={bot} activity={activity} size={72} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h1 className="truncate text-xl font-semibold text-foreground">{bot.name}</h1>
                {bot.tagline ? (
                  <p className="truncate text-sm text-muted-foreground/80">{bot.tagline}</p>
                ) : null}
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", ACTIVITY_DOT_CLASS[activity])}
                    aria-hidden
                  />
                  {ACTIVITY_LABELS[activity]}
                </span>
              </div>
            </div>

            <form
              className="space-y-3 rounded-xl border border-border bg-card/40 p-4"
              onSubmit={submit}
            >
              <label htmlFor="agent-task" className="text-sm font-medium">
                What are we working on?
              </label>
              <Textarea
                id="agent-task"
                value={task}
                disabled={preparing}
                rows={3}
                placeholder={`Give ${bot.name} a task…`}
                onChange={(event) => setTask(event.currentTarget.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Review the task in the composer before sending.
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={preparing || task.trim() === ""}
                  className="gap-2"
                >
                  <SendIcon className="size-3.5" aria-hidden />
                  {preparing ? "Preparing…" : "Prepare task"}
                </Button>
              </div>
            </form>

            {bot.persona ? (
              <section className="flex flex-col gap-1.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  Personality & instructions
                </h2>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/15 p-3 text-xs leading-relaxed text-muted-foreground">
                  {bot.persona}
                </p>
              </section>
            ) : null}

            <section className="flex flex-col gap-1.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Work
              </h2>
              {work.length === 0 ? (
                <p className="py-4 text-xs text-muted-foreground/60">
                  Your agent’s tasks will appear here. Prepare a task above to get started.
                </p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {work.map((thread) => (
                    <Link
                      key={`${thread.environmentId}:${thread.threadId}`}
                      to="/$environmentId/$threadId"
                      params={{
                        environmentId: thread.environmentId,
                        threadId: thread.threadId,
                      }}
                      className="flex min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-card/60"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {thread.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground/55">
                        {thread.projectTitle}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <AgentBotDialog open={editing} onOpenChange={setEditing} bot={bot} onSubmit={handleEdit} />
    </SidebarInset>
  );
}
