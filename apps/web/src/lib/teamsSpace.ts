// FILE: teamsSpace.ts
// Purpose: Projects Modesto threads and orchestration events into the Teams workspace.
// Layer: Web presentation logic shared by the Teams route and focused tests.

import { PROVIDER_DISPLAY_NAMES, type ProviderKind, type ThreadId } from "@modesto/contracts";

import type { Thread } from "../types";

export const TEAMS_TIMELINE_FILTERS = [
  "all",
  "runs",
  "checkpoints",
  "handoffs",
  "reviews",
  "diffs",
] as const;

export type TeamsTimelineFilter = (typeof TEAMS_TIMELINE_FILTERS)[number];
export type TeamsRunStatus = "running" | "waiting" | "failed" | "completed" | "ready";

export interface TeamsRunSummary {
  readonly threadId: ThreadId;
  readonly title: string;
  readonly provider: ProviderKind;
  readonly branch: string | null;
  readonly status: TeamsRunStatus;
  readonly statusLabel: string;
  readonly updatedAt: string;
  readonly lastActivity: string;
}

export interface TeamsTimelineItem {
  readonly id: string;
  readonly threadId: ThreadId;
  readonly threadTitle: string;
  readonly provider: ProviderKind;
  readonly label: string;
  readonly kind: string;
  readonly category: Exclude<TeamsTimelineFilter, "all">;
  readonly createdAt: string;
  readonly tone: "info" | "tool" | "approval" | "error";
}

export interface TeamsParticipant {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly runCount: number;
  readonly activeRunCount: number;
}

function timestampForThread(thread: Thread): string {
  return (
    thread.updatedAt ??
    thread.latestTurn?.completedAt ??
    thread.latestTurn?.requestedAt ??
    thread.createdAt
  );
}

export function teamsRunStatus(thread: Thread): TeamsRunStatus {
  if (thread.error || thread.latestTurn?.state === "error" || thread.session?.status === "error") {
    return "failed";
  }
  if (
    thread.hasPendingApprovals ||
    thread.hasPendingUserInput ||
    thread.hasActionableProposedPlan
  ) {
    return "waiting";
  }
  if (thread.latestTurn?.state === "running" || thread.session?.status === "running") {
    return "running";
  }
  if (thread.latestTurn?.state === "completed") {
    return "completed";
  }
  return "ready";
}

export function teamsRunStatusLabel(status: TeamsRunStatus): string {
  switch (status) {
    case "running":
      return "Working";
    case "waiting":
      return "Needs you";
    case "failed":
      return "Needs recovery";
    case "completed":
      return "Completed";
    case "ready":
      return "Ready";
  }
}

export function buildTeamsRuns(threads: readonly Thread[], limit = 8): TeamsRunSummary[] {
  return [...threads]
    .filter((thread) => thread.archivedAt == null)
    .sort((left, right) => timestampForThread(right).localeCompare(timestampForThread(left)))
    .slice(0, limit)
    .map((thread) => {
      const status = teamsRunStatus(thread);
      const lastActivity =
        thread.activities.at(-1)?.summary ??
        (thread.latestTurn?.state === "completed" ? "Run completed" : "Ready for the next step");
      return {
        threadId: thread.id,
        title: thread.title,
        provider: thread.modelSelection.provider,
        branch: thread.branch,
        status,
        statusLabel: teamsRunStatusLabel(status),
        updatedAt: timestampForThread(thread),
        lastActivity,
      };
    });
}

export function teamsTimelineCategory(
  kind: string,
): Exclude<TeamsTimelineFilter, "all"> | null {
  const normalized = kind.toLowerCase();
  if (normalized.includes("checkpoint")) return "checkpoints";
  if (normalized.includes("handoff")) return "handoffs";
  if (normalized.includes("review")) return "reviews";
  if (normalized.includes("diff") || normalized.includes("patch")) return "diffs";
  if (normalized.includes("turn") || normalized.includes("run") || normalized.includes("session")) {
    return "runs";
  }
  return null;
}

export function buildTeamsTimeline(
  threads: readonly Thread[],
  filter: TeamsTimelineFilter,
  limit = 80,
): TeamsTimelineItem[] {
  return threads
    .flatMap((thread) => {
      const activityItems = thread.activities.flatMap((activity): TeamsTimelineItem[] => {
        const category = teamsTimelineCategory(activity.kind);
        if (!category) return [];
        return [
          {
            id: `${thread.id}:${activity.id}`,
            threadId: thread.id,
            threadTitle: thread.title,
            provider: thread.modelSelection.provider,
            label: activity.summary,
            kind: activity.kind,
            category,
            createdAt: activity.createdAt,
            tone: activity.tone,
          },
        ];
      });
      const hasHandoffActivity = activityItems.some((item) => item.category === "handoffs");
      const handoffItem: TeamsTimelineItem[] =
        thread.handoff && !hasHandoffActivity
          ? [
              {
                id: `${thread.id}:handoff`,
                threadId: thread.id,
                threadTitle: thread.title,
                provider: thread.modelSelection.provider,
                label: `Handed off from ${PROVIDER_DISPLAY_NAMES[thread.handoff.sourceProvider]}`,
                kind: "handoff",
                category: "handoffs",
                createdAt: thread.handoff.importedAt,
                tone: "info",
              },
            ]
          : [];
      return [...activityItems, ...handoffItem];
    })
    .filter((item) => filter === "all" || item.category === filter)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export function buildTeamsParticipants(
  threads: readonly Thread[],
  runs: readonly TeamsRunSummary[],
): TeamsParticipant[] {
  const providers = new Set(threads.map((thread) => thread.modelSelection.provider));
  const activeStatuses = new Set<TeamsRunStatus>(["running", "waiting"]);
  return [
    {
      id: "human",
      label: "You",
      detail: "Human · can steer and review every run",
      runCount: threads.length,
      activeRunCount: runs.filter((run) => activeStatuses.has(run.status)).length,
    },
    ...[...providers]
      .sort((left, right) =>
        PROVIDER_DISPLAY_NAMES[left].localeCompare(PROVIDER_DISPLAY_NAMES[right]),
      )
      .map((provider) => {
        const providerRuns = runs.filter((run) => run.provider === provider);
        const activeRunCount = providerRuns.filter((run) => activeStatuses.has(run.status)).length;
        return {
          id: provider,
          label: PROVIDER_DISPLAY_NAMES[provider],
          detail: activeRunCount > 0 ? "Agent · active in this space" : "Agent · available",
          runCount: threads.filter((thread) => thread.modelSelection.provider === provider).length,
          activeRunCount,
        };
      }),
  ];
}
