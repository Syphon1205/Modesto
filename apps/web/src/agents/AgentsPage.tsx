// FILE: AgentsPage.tsx
// Purpose: The Agents tab — the roster of persistent teammates and what each
//          one is doing right now.
// Layer: Agents UI
//
// A roster of people, not a list of chats. Every row is an identity that
// outlives its threads, which is why it leads with a face and a job rather
// than with a last message, and why a row opens the *bot* rather than a
// conversation. Activity is one rolled-up line per bot: a teammate working on
// three things is still one teammate.
//
// Shaped after Rakazo <https://github.com/elie222/rakazo> (Apache-2.0): a bot
// is a durable identity with its own continuing work, not a prompt preset.
// See THIRD_PARTY_NOTICES.md.

import type { AgentBot, AgentBotActivity, AgentBotDraft } from "@modesto/contracts";
import { useNavigate } from "@tanstack/react-router";
import { projectThreadAwareness } from "@modesto/shared/agentAwareness";
import { BotIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { AgentBotDialog } from "./AgentBotDialog";
import { ACTIVITY_LABELS, AgentPresence } from "./AgentPresence";
import { useAgentBotStore, useAgentBots } from "./agentBotStore";
import { useAgentThreadLinks, threadLinkKey } from "./agentThreadLinks";
import {
  rollUpRosterActivity,
  searchBots,
  sortRoster,
  visibleBots,
  type AgentRosterThread,
} from "./agentRoster";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SidebarInset } from "~/components/ui/sidebar";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { useProjects, useThreadShells } from "~/state/entities";

/**
 * Threads a bot started, carrying the canonical awareness phase.
 *
 * Exported because the bot's own page needs exactly the same projection, and
 * two copies of "which threads belong to this bot and what are they doing"
 * would drift the moment either changed.
 */
export function useRosterThreads(): ReadonlyArray<AgentRosterThread> {
  const links = useAgentThreadLinks();
  const threadShells = useThreadShells();
  const projects = useProjects();

  return useMemo(() => {
    if (Object.keys(links).length === 0) return [];
    const projectByKey = new Map(
      projects.map((project) => [`${project.environmentId}:${project.id}`, project]),
    );
    const rows: Array<AgentRosterThread> = [];
    for (const thread of threadShells) {
      const botId = links[threadLinkKey(thread.environmentId, thread.id)];
      if (!botId) continue;
      const project = projectByKey.get(`${thread.environmentId}:${thread.projectId}`);
      if (!project) continue;
      const awareness = projectThreadAwareness({
        environmentId: thread.environmentId,
        project,
        thread,
      });
      rows.push({
        botId,
        phase: awareness?.phase ?? null,
        updatedAt: Date.parse(thread.updatedAt),
      });
    }
    return rows;
  }, [links, threadShells, projects]);
}

function AgentRow({
  bot,
  activity,
  threadCount,
  onOpen,
}: {
  readonly bot: AgentBot;
  readonly activity: AgentBotActivity;
  readonly threadCount: number;
  readonly onOpen: (bot: AgentBot) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(bot)}
      className="group flex w-full min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-card/60 focus-visible:border-border focus-visible:bg-card/60 focus-visible:outline-none"
    >
      <AgentPresence bot={bot} activity={activity} size={44} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{bot.name}</span>
        {/* Fixed-height sub-line: the tagline is optional, and letting rows
            change height when it is absent makes the list ragged. */}
        <span className="h-4 truncate text-xs text-muted-foreground/75">
          {bot.tagline || "No description"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={cn(
            "text-[11px]",
            activity === "waiting" ? "font-medium text-warning" : "text-muted-foreground/70",
          )}
        >
          {ACTIVITY_LABELS[activity]}
        </span>
        <span className="text-[11px] text-muted-foreground/45">
          {threadCount === 0
            ? "No work yet"
            : `${threadCount} ${threadCount === 1 ? "thread" : "threads"}`}
        </span>
      </span>
    </button>
  );
}

export function AgentsPage() {
  const bots = useAgentBots();
  const addBot = useAgentBotStore((state) => state.addBot);
  const rosterThreads = useRosterThreads();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const activeBots = useMemo(() => visibleBots(bots), [bots]);

  const roster = useMemo(() => {
    const activityByBot = rollUpRosterActivity(bots, rosterThreads);
    const threadCounts = new Map<string, number>();
    for (const thread of rosterThreads) {
      threadCounts.set(thread.botId, (threadCounts.get(thread.botId) ?? 0) + 1);
    }
    const shown = searchBots(activeBots, query);
    return {
      sorted: sortRoster(shown, (bot) => activityByBot.get(bot.id) ?? "idle"),
      activityByBot,
      threadCounts,
    };
  }, [bots, activeBots, rosterThreads, query]);

  const openBot = useCallback(
    (bot: AgentBot) => {
      void navigate({ to: "/agents/$agentId", params: { agentId: bot.id } });
    },
    [navigate],
  );

  const handleCreate = useCallback(
    (draft: AgentBotDraft) => {
      const created = addBot(draft);
      // Straight into the new teammate's page: the next thing anyone wants
      // after making a bot is to give it something to do.
      void navigate({ to: "/agents/$agentId", params: { agentId: created.id } });
    },
    [addBot, navigate],
  );

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <WorkspacePageHeader electron={isElectron} className="border-b border-border">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
              Agents
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setDialogOpen(true)}
              >
                <PlusIcon className="size-3.5" aria-hidden />
                New agent
              </Button>
            </div>
          </div>
        </WorkspacePageHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
            <div className="mb-8">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Your team
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Familiar faces. Focused work.
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Give your recurring work a character of its own. Each agent keeps its instructions
                and brings its tasks together in one place.
              </p>
            </div>
            {activeBots.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <span className="text-xs text-muted-foreground">
                  {activeBots.length} {activeBots.length === 1 ? "agent" : "agents"}
                </span>
                <div className="relative w-full sm:w-60">
                  <SearchIcon
                    className="pointer-events-none absolute start-2.5 top-2.5 z-10 size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={query}
                    placeholder="Find an agent…"
                    aria-label="Search agents"
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    className="w-full ps-8"
                  />
                </div>
              </div>
            ) : null}
            {roster.sorted.length === 0 ? (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
                <BotIcon className="size-7 text-muted-foreground/50" aria-hidden />
                <h2 className="text-lg font-medium text-foreground">
                  {activeBots.length === 0
                    ? "Make room for your first agent"
                    : "No agents match that search"}
                </h2>
                {activeBots.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground/80">
                      Start with a researcher, a debugging partner, or a character of your own.
                      Choose a role, shape its personality, and give it something to do.
                    </p>
                    <Button
                      type="button"
                      className="mt-1 gap-1.5"
                      onClick={() => setDialogOpen(true)}
                    >
                      <PlusIcon className="size-3.5" aria-hidden />
                      Create your first agent
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {roster.sorted.map((bot) => (
                  <AgentRow
                    key={bot.id}
                    bot={bot}
                    activity={roster.activityByBot.get(bot.id) ?? "idle"}
                    threadCount={roster.threadCounts.get(bot.id) ?? 0}
                    onOpen={openBot}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AgentBotDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreate} />
    </SidebarInset>
  );
}
