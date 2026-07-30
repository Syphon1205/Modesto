// FILE: workspaceTimeline.ts
// Purpose: Derive a project activity timeline from existing thread projections.
// Layer: Shared pure domain utility
// Exports: categorizeWorkspaceActivity and buildWorkspaceTimeline.

import type {
  OrchestrationThread,
  WorkspaceTimelineCategory,
  WorkspaceTimelineFilter,
  WorkspaceTimelineItem,
} from "@modesto/contracts";

export type WorkspaceTimelineThreadSnapshot = Pick<
  OrchestrationThread,
  | "id"
  | "projectId"
  | "title"
  | "modelSelection"
  | "createdAt"
  | "activities"
  | "checkpoints"
  | "proposedPlans"
  | "handoff"
>;

export interface BuildWorkspaceTimelineOptions {
  readonly projectId?: WorkspaceTimelineThreadSnapshot["projectId"];
  readonly limit?: number;
  readonly filter?: Partial<WorkspaceTimelineFilter>;
}

/**
 * Converts provider-specific activity/tool names into stable workspace
 * categories. Matching is deliberately text-based so new providers work
 * without a new persistence model.
 */
export function categorizeWorkspaceActivity(kind: string, summary = ""): WorkspaceTimelineCategory {
  const text = `${kind} ${summary}`.toLowerCase().replace(/[._/]+/g, " ");

  if (/\breview(?:\.|\s|-)|code review|pull request review/.test(text)) return "review";
  if (/\bcheckpoint(?:\.|\s|-)/.test(text)) return "checkpoint";
  if (/\bhandoff(?:\.|\s|-)/.test(text)) return "handoff";
  if (/\btask(?:\.|\s|-)|todo|unfinished step/.test(text)) return "task";
  if (
    /\b(session|turn)(?:\.|\s|-)*(start|started|starting|set|requested)\b/.test(text) ||
    /\bagent start/.test(text)
  ) {
    return "agent-start";
  }
  if (/\bgit\s+commit\b|\bcommit(?:\.|\s|-)*(created|completed|pushed)\b/.test(text)) {
    return "commit";
  }
  if (
    /\b(vitest|jest|pytest|bun test|npm test|pnpm test|yarn test|cargo test|go test|test suite|run tests?)\b/.test(
      text,
    )
  ) {
    return "test";
  }
  if (
    /\b(appl(?:y|ied) patch|applypatch|file change|write file|edit file|file edit|create file|delete file|edit|write)\b/.test(
      text,
    )
  ) {
    return "edit";
  }
  if (
    /\b(web search|search(?:ed|ing)?|grep|ripgrep|\brg\b|glob(?:bed|bing)?|find files?)\b/.test(
      text,
    )
  ) {
    return "search";
  }
  if (
    /\b(command execution|terminal|exec command|shell|tool (?:started|updated|completed)|run command|ran command)\b/.test(
      text,
    )
  ) {
    return "run";
  }
  return "other";
}

function payloadRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function collectPayloadSearchText(value: unknown, output: string[], depth = 0): void {
  if (depth > 3 || output.length >= 24 || value === null || value === undefined) return;
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectPayloadSearchText(entry, output, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      ["itemType", "toolName", "tool", "title", "detail", "command", "query", "status"].includes(
        key,
      )
    ) {
      collectPayloadSearchText(entry, output, depth + 1);
    } else if (key === "data" || key === "item") {
      collectPayloadSearchText(entry, output, depth + 1);
    }
  }
}

function checkpointRefFromPayload(
  payload: unknown,
): WorkspaceTimelineItem["relatedCheckpointRef"] | undefined {
  const record = payloadRecord(payload);
  const value = record?.checkpointRef;
  return typeof value === "string" && value.trim().length > 0
    ? (value as WorkspaceTimelineItem["relatedCheckpointRef"])
    : undefined;
}

/** Builds a newest-first timeline without creating timeline-specific state. */
export function buildWorkspaceTimeline(
  threads: ReadonlyArray<WorkspaceTimelineThreadSnapshot>,
  options: BuildWorkspaceTimelineOptions = {},
): WorkspaceTimelineItem[] {
  const items: WorkspaceTimelineItem[] = [];

  for (const thread of threads) {
    if (options.projectId !== undefined && thread.projectId !== options.projectId) continue;
    const common = {
      projectId: thread.projectId,
      threadId: thread.id,
      threadTitle: thread.title,
      provider: thread.modelSelection.provider,
    } as const;

    items.push({
      ...common,
      id: `thread-start:${thread.id}`,
      category: "agent-start",
      label: `${thread.modelSelection.provider} started ${thread.title}`,
      kind: "thread.created",
      createdAt: thread.createdAt,
      tone: "info",
    });

    for (const activity of thread.activities) {
      const payloadText: string[] = [];
      collectPayloadSearchText(activity.payload, payloadText);
      const relatedCheckpointRef = checkpointRefFromPayload(activity.payload);
      items.push({
        ...common,
        id: `activity:${activity.id}`,
        category: categorizeWorkspaceActivity(
          activity.kind,
          `${activity.summary} ${payloadText.join(" ")}`,
        ),
        label: activity.summary,
        kind: activity.kind,
        createdAt: activity.createdAt,
        tone: activity.tone,
        ...(relatedCheckpointRef ? { relatedCheckpointRef } : {}),
        ...(activity.turnId ? { relatedTurnId: activity.turnId } : {}),
      });
    }

    for (const checkpoint of thread.checkpoints) {
      items.push({
        ...common,
        id: `checkpoint:${thread.id}:${checkpoint.checkpointRef}`,
        category: "checkpoint",
        label: `Checkpoint ${checkpoint.checkpointTurnCount} ${checkpoint.status}`,
        kind: "checkpoint.summary",
        createdAt: checkpoint.completedAt,
        tone: checkpoint.status === "error" ? "error" : "info",
        relatedCheckpointRef: checkpoint.checkpointRef,
        relatedTurnId: checkpoint.turnId,
      });
    }

    for (const plan of thread.proposedPlans) {
      items.push({
        ...common,
        id: `plan:${thread.id}:${plan.id}`,
        category: "task",
        label: plan.implementedAt ? "Plan implemented" : "Plan proposed",
        kind: plan.implementedAt ? "plan.implemented" : "plan.proposed",
        createdAt: plan.implementedAt ?? plan.createdAt,
        tone: "info",
        ...(plan.turnId ? { relatedTurnId: plan.turnId } : {}),
      });
    }

    if (thread.handoff) {
      items.push({
        ...common,
        id: `handoff:${thread.id}:${thread.handoff.importedAt}`,
        category: "handoff",
        label: `Handoff from ${thread.handoff.sourceProvider}`,
        kind: "thread.handoff.imported",
        createdAt: thread.handoff.importedAt,
        tone: "info",
        ...(thread.handoff.checkpointRef
          ? { relatedCheckpointRef: thread.handoff.checkpointRef }
          : {}),
      });
    }
  }

  const categories = new Set(options.filter?.categories ?? []);
  const threadIds = new Set(options.filter?.threadIds ?? []);
  const filtered = items
    .filter((item) => categories.size === 0 || categories.has(item.category))
    .filter((item) => threadIds.size === 0 || threadIds.has(item.threadId))
    .toSorted(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
    );
  if (options.limit === undefined) return filtered;
  return filtered.slice(0, Math.max(0, Math.floor(options.limit)));
}
