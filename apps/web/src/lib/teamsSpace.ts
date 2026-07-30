// FILE: teamsSpace.ts
// Purpose: Projects Modesto threads and orchestration events into the Teams workspace.
// Layer: Web presentation logic shared by the Teams route and focused tests.

import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ThreadHandoffStep,
  type ThreadId,
  type WorkspaceTimelineCategory,
  type WorkspaceTimelineItem,
} from "@modesto/contracts";
import {
  buildWorkspaceTimeline,
  categorizeWorkspaceActivity,
} from "@modesto/shared/workspaceTimeline";

import type { Thread } from "../types";

export const TEAMS_TIMELINE_FILTERS = [
  "all",
  "runs",
  "assignments",
  "reviews",
  "checkpoints",
  "handoffs",
  "edits",
  "diffs",
  "searches",
  "tests",
  "commits",
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

export type TeamsAssignmentKind = "handoff-step" | "plan" | "attention";
export type TeamsAssignmentStatus = ThreadHandoffStep["status"] | "ready" | "waiting" | "failed";

export interface TeamsAssignment {
  readonly id: string;
  readonly threadId: ThreadId;
  readonly title: string;
  readonly provider: ProviderKind;
  readonly kind: TeamsAssignmentKind;
  readonly label: string;
  readonly status: TeamsAssignmentStatus;
  readonly updatedAt: string;
}

export interface TeamsReview {
  readonly id: string;
  readonly threadId: ThreadId;
  readonly title: string;
  readonly provider: ProviderKind;
  readonly kind: "activity" | "handoff-return";
  readonly label: string;
  readonly status: "ready" | "completed" | "failed";
  readonly updatedAt: string;
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
    .toSorted((left, right) => timestampForThread(right).localeCompare(timestampForThread(left)))
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

function compactPlanLabel(planMarkdown: string): string {
  const firstContentLine = planMarkdown
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/, "")
        .trim(),
    )
    .find((line) => line.length > 0);
  return firstContentLine ?? "Review proposed plan";
}

export function buildTeamsAssignments(threads: readonly Thread[]): TeamsAssignment[] {
  const assignments = threads.flatMap((thread): TeamsAssignment[] => {
    if (thread.archivedAt != null) return [];
    const provider = thread.modelSelection.provider;
    const items: TeamsAssignment[] = [];

    for (const step of thread.handoff?.unfinishedSteps ?? []) {
      if (step.status === "done") continue;
      items.push({
        id: `${thread.id}:handoff-step:${step.id}`,
        threadId: thread.id,
        title: thread.title,
        provider,
        kind: "handoff-step",
        label: step.text,
        status: step.status,
        updatedAt: thread.handoff?.importedAt ?? timestampForThread(thread),
      });
    }

    for (const plan of thread.proposedPlans) {
      if (plan.implementedAt !== null) continue;
      items.push({
        id: `${thread.id}:plan:${plan.id}`,
        threadId: thread.id,
        title: thread.title,
        provider,
        kind: "plan",
        label: compactPlanLabel(plan.planMarkdown),
        status: "ready",
        updatedAt: plan.updatedAt,
      });
    }

    const runStatus = teamsRunStatus(thread);
    if (runStatus === "waiting" || runStatus === "failed") {
      items.push({
        id: `${thread.id}:attention:${runStatus}`,
        threadId: thread.id,
        title: thread.title,
        provider,
        kind: "attention",
        label:
          runStatus === "failed"
            ? thread.error?.trim() || "Run needs recovery"
            : thread.hasPendingApprovals
              ? "Approval needed"
              : thread.hasPendingUserInput
                ? "Input needed"
                : "Plan is ready for review",
        status: runStatus,
        updatedAt: timestampForThread(thread),
      });
    }
    return items;
  });

  return assignments.toSorted(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
  );
}

export function buildTeamsReviews(threads: readonly Thread[]): TeamsReview[] {
  return threads
    .flatMap((thread): TeamsReview[] => {
      if (thread.archivedAt != null) return [];
      const provider = thread.modelSelection.provider;
      const reviews = thread.activities.flatMap((activity): TeamsReview[] => {
        if (categorizeWorkspaceActivity(activity.kind, activity.summary) !== "review") return [];
        return [
          {
            id: `${thread.id}:review:${activity.id}`,
            threadId: thread.id,
            title: thread.title,
            provider,
            kind: "activity",
            label: activity.summary,
            status:
              activity.tone === "error"
                ? "failed"
                : /(?:complete|approved|resolved)/i.test(`${activity.kind} ${activity.summary}`)
                  ? "completed"
                  : "ready",
            updatedAt: activity.createdAt,
          },
        ];
      });
      if (thread.handoffReturn) {
        reviews.push({
          id: `${thread.id}:handoff-return:${thread.handoffReturn.fromThreadId}`,
          threadId: thread.id,
          title: thread.title,
          provider,
          kind: "handoff-return",
          label: `Returned work: ${thread.handoffReturn.summary}`,
          status: "ready",
          updatedAt: thread.handoffReturn.returnedAt,
        });
      }
      return reviews;
    })
    .toSorted(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
    );
}

function teamsFilterForWorkspaceCategory(
  category: WorkspaceTimelineCategory,
  kind: string,
): Exclude<TeamsTimelineFilter, "all"> | null {
  if (/\bdiff\b/i.test(kind)) return "diffs";
  switch (category) {
    case "agent-start":
    case "run":
    case "other":
      return "runs";
    case "task":
      return "assignments";
    case "review":
      return "reviews";
    case "checkpoint":
      return "checkpoints";
    case "handoff":
      return "handoffs";
    case "edit":
      return "edits";
    case "search":
      return "searches";
    case "test":
      return "tests";
    case "commit":
      return "commits";
  }
}

export function teamsTimelineCategory(
  kind: string,
  summary = "",
): Exclude<TeamsTimelineFilter, "all"> | null {
  return teamsFilterForWorkspaceCategory(categorizeWorkspaceActivity(kind, summary), kind);
}

export function buildTeamsTimelineFromWorkspace(
  workspaceItems: ReadonlyArray<WorkspaceTimelineItem>,
  filter: TeamsTimelineFilter,
  limit = 80,
): TeamsTimelineItem[] {
  return workspaceItems
    .map((item): TeamsTimelineItem => {
      const category = teamsFilterForWorkspaceCategory(item.category, item.kind) ?? "runs";
      return {
        id: item.id,
        threadId: item.threadId,
        threadTitle: item.threadTitle,
        provider: item.provider,
        label: item.label,
        kind: item.kind,
        category,
        createdAt: item.createdAt,
        tone: item.tone,
      };
    })
    .filter((item) => filter === "all" || item.category === filter)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export function buildTeamsTimeline(
  threads: readonly Thread[],
  filter: TeamsTimelineFilter,
  limit = 80,
): TeamsTimelineItem[] {
  const workspaceItems = buildWorkspaceTimeline(
    threads.map((thread) => ({
      id: thread.id,
      projectId: thread.projectId,
      title: thread.title,
      modelSelection: thread.modelSelection,
      createdAt: thread.createdAt,
      activities: thread.activities,
      checkpoints: [],
      proposedPlans: thread.proposedPlans,
      handoff: thread.handoff ?? null,
    })),
  ).map((item) =>
    item.kind === "thread.handoff.imported"
      ? Object.assign({}, item, {
          label: `Handed off from ${
            PROVIDER_DISPLAY_NAMES[
              threads.find((thread) => thread.id === item.threadId)?.handoff?.sourceProvider ??
                item.provider
            ]
          }`,
        })
      : item,
  );
  return buildTeamsTimelineFromWorkspace(workspaceItems, filter, limit);
}

export function buildTeamsParticipants(
  threads: readonly Thread[],
  runs: readonly TeamsRunSummary[],
): TeamsParticipant[] {
  const visibleThreads = threads.filter((thread) => thread.archivedAt == null);
  const providers = new Set(visibleThreads.map((thread) => thread.modelSelection.provider));
  const activeStatuses = new Set<TeamsRunStatus>(["running", "waiting"]);
  const subagents = new Map<
    string,
    {
      label: string;
      role: string | null;
      agentId: string | null;
      provider: ProviderKind;
      threadIds: ThreadId[];
    }
  >();
  for (const thread of visibleThreads) {
    if (
      !thread.parentThreadId &&
      !thread.subagentAgentId &&
      !thread.subagentNickname &&
      !thread.subagentRole
    ) {
      continue;
    }
    const key = thread.subagentAgentId
      ? `subagent:${thread.subagentAgentId}`
      : `subagent-thread:${thread.id}`;
    const existing = subagents.get(key);
    if (existing) {
      existing.threadIds.push(thread.id);
      continue;
    }
    subagents.set(key, {
      label:
        thread.subagentNickname?.trim() ||
        thread.subagentRole?.trim() ||
        thread.subagentAgentId?.trim() ||
        thread.title,
      role: thread.subagentRole?.trim() || null,
      agentId: thread.subagentAgentId?.trim() || null,
      provider: thread.modelSelection.provider,
      threadIds: [thread.id],
    });
  }

  return [
    {
      id: "human",
      label: "You",
      detail: "Human · can steer and review every run",
      runCount: visibleThreads.length,
      activeRunCount: runs.filter((run) => activeStatuses.has(run.status)).length,
    },
    ...[...providers]
      .toSorted((left, right) =>
        PROVIDER_DISPLAY_NAMES[left].localeCompare(PROVIDER_DISPLAY_NAMES[right]),
      )
      .map((provider) => {
        const providerRuns = runs.filter((run) => run.provider === provider);
        const activeRunCount = providerRuns.filter((run) => activeStatuses.has(run.status)).length;
        return {
          id: provider,
          label: PROVIDER_DISPLAY_NAMES[provider],
          detail: activeRunCount > 0 ? "Agent · active in this space" : "Agent · available",
          runCount: visibleThreads.filter((thread) => thread.modelSelection.provider === provider)
            .length,
          activeRunCount,
        };
      }),
    ...[...subagents.entries()]
      .toSorted(([, left], [, right]) => left.label.localeCompare(right.label))
      .map(([id, subagent]) => {
        const agentRuns = runs.filter((run) => subagent.threadIds.includes(run.threadId));
        return {
          id,
          label: subagent.label,
          detail: [
            subagent.role ? `Subagent · ${subagent.role}` : "Subagent",
            PROVIDER_DISPLAY_NAMES[subagent.provider],
            subagent.agentId,
          ]
            .filter(Boolean)
            .join(" · "),
          runCount: subagent.threadIds.length,
          activeRunCount: agentRuns.filter((run) => activeStatuses.has(run.status)).length,
        };
      }),
  ];
}
