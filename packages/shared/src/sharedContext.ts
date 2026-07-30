// FILE: sharedContext.ts
// Purpose: Derive portable context bundles from existing thread projections.
// Layer: Shared pure domain utility
// Exports: buildSharedContextBundle and formatSharedContextNarrative.

import type {
  ContextArtifact,
  ContextArtifactKind,
  ContextFreshness,
  OrchestrationThread,
  SharedContextBundle,
} from "@modesto/contracts";

export type SharedContextThreadSnapshot = Pick<
  OrchestrationThread,
  | "id"
  | "projectId"
  | "title"
  | "modelSelection"
  | "createdAt"
  | "updatedAt"
  | "session"
  | "checkpoints"
  | "activities"
  | "messages"
  | "proposedPlans"
  | "handoff"
  | "pinnedMessages"
  | "threadMarkers"
  | "notes"
>;

export interface BuildSharedContextBundleInput {
  readonly thread: SharedContextThreadSnapshot;
  readonly generatedAt?: string;
  /** Restrict historical conversation artifacts to this completed checkpoint. */
  readonly checkpointTurnCount?: number;
}

const SUMMARY_LIMIT = 320;

function compactText(value: string, limit = SUMMARY_LIMIT): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= limit ? compact : `${compact.slice(0, Math.max(0, limit - 1))}…`;
}

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  return payload !== null && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return payloadRecord(value);
}

function readString(
  record: Record<string, unknown> | null,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function activitySearchText(activity: {
  readonly kind: string;
  readonly summary: string;
  readonly payload: unknown;
}): string {
  const payload = payloadRecord(activity.payload);
  const data = nestedRecord(payload?.data);
  const item = nestedRecord(data?.item);
  return [
    activity.kind,
    activity.summary,
    readString(payload, ["itemType", "toolName", "tool", "title", "detail"]),
    readString(data, ["toolName", "tool", "command", "query", "url"]),
    readString(item, ["toolName", "tool", "command", "query", "url"]),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

function activityCommand(activity: {
  readonly summary: string;
  readonly payload: unknown;
}): string {
  const payload = payloadRecord(activity.payload);
  const data = nestedRecord(payload?.data);
  const item = nestedRecord(data?.item);
  return (
    readString(item, ["command"]) ??
    readString(data, ["command"]) ??
    readString(payload, ["command", "detail"]) ??
    activity.summary
  );
}

function collectPaths(value: unknown, paths: Set<string>, depth = 0): void {
  if (depth > 4 || paths.size >= 40 || value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectPaths(entry, paths, depth + 1);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      key.toLowerCase() === "path" &&
      typeof entry === "string" &&
      entry.trim().length > 0 &&
      !entry.includes("://")
    ) {
      paths.add(entry.trim());
      continue;
    }
    collectPaths(entry, paths, depth + 1);
  }
}

function artifact(
  value: Omit<ContextArtifact, "summary"> & { readonly summary: string },
): ContextArtifact {
  return { ...value, summary: compactText(value.summary) };
}

function isWebSourceActivity(searchText: string): boolean {
  return /\b(web[_ -]?search|browser|url|http|fetch[_ -]?(?:page|url)|search[_ -]?web)\b/.test(
    searchText,
  );
}

function isTerminalActivity(searchText: string): boolean {
  return /\b(command[_ -]?execution|terminal|exec[_ -]?command|shell)\b/.test(searchText);
}

function sourceLabel(activity: { readonly summary: string; readonly payload: unknown }): string {
  const payload = payloadRecord(activity.payload);
  const data = nestedRecord(payload?.data);
  return (
    readString(payload, ["toolName", "tool", "title"]) ??
    readString(data, ["toolName", "tool", "url", "query"]) ??
    activity.summary
  );
}

function pushFileArtifact(
  files: Map<string, ContextArtifact>,
  input: {
    readonly path: string;
    readonly summary: string;
    readonly createdAt?: string;
    readonly turnId?: ContextArtifact["turnId"];
    readonly activityId?: ContextArtifact["activityId"];
    readonly freshness?: ContextFreshness;
  },
): void {
  const existing = files.get(input.path);
  if (existing && (existing.createdAt ?? "") > (input.createdAt ?? "")) {
    return;
  }
  files.set(
    input.path,
    artifact({
      id: `file:${input.path}`,
      kind: "file",
      label: input.path,
      summary: input.summary,
      freshness: input.freshness ?? "current",
      path: input.path,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      ...(input.turnId ? { turnId: input.turnId } : {}),
      ...(input.activityId ? { activityId: input.activityId } : {}),
    }),
  );
}

/**
 * Assembles a portable context view from projections that already exist. It
 * intentionally writes no new aggregate state.
 */
export function buildSharedContextBundle(
  input: BuildSharedContextBundleInput,
): SharedContextBundle {
  const { thread } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const checkpointTurnCount = input.checkpointTurnCount;
  const cutoffCheckpoint =
    checkpointTurnCount === undefined
      ? null
      : ([...thread.checkpoints]
          .filter((checkpoint) => checkpoint.checkpointTurnCount <= checkpointTurnCount)
          .toSorted((left, right) => right.checkpointTurnCount - left.checkpointTurnCount)[0] ??
        null);
  const cutoffAt =
    cutoffCheckpoint?.completedAt ?? (checkpointTurnCount === 0 ? thread.createdAt : null);
  const beforeCutoff = (createdAt: string) => cutoffAt === null || createdAt <= cutoffAt;
  const checkpoints = thread.checkpoints.filter(
    (checkpoint) =>
      checkpointTurnCount === undefined || checkpoint.checkpointTurnCount <= checkpointTurnCount,
  );
  const messages = thread.messages.filter((message) => beforeCutoff(message.createdAt));
  const activities = thread.activities.filter((activity) => beforeCutoff(activity.createdAt));
  const plans = thread.proposedPlans.filter((plan) => beforeCutoff(plan.createdAt));
  const artifacts: ContextArtifact[] = [];
  const files = new Map<string, ContextArtifact>();

  if (thread.session) {
    const isLive = ["idle", "starting", "running", "ready"].includes(thread.session.status);
    artifacts.push(
      artifact({
        id: `session:${thread.id}`,
        kind: "session",
        label: `${thread.session.providerName ?? thread.modelSelection.provider} session`,
        summary: `Session is ${thread.session.status}${
          thread.session.activeTurnId ? ` with active turn ${thread.session.activeTurnId}` : ""
        }.`,
        freshness: isLive ? "current" : "stale",
        ...(thread.session.activeTurnId ? { turnId: thread.session.activeTurnId } : {}),
        createdAt: thread.session.updatedAt,
      }),
    );
  }

  const newestCheckpointTurn = checkpoints.reduce(
    (latest, checkpoint) => Math.max(latest, checkpoint.checkpointTurnCount),
    0,
  );
  for (const checkpoint of checkpoints) {
    const fileSummary =
      checkpoint.files.length === 0
        ? "No changed files recorded."
        : `${checkpoint.files.length} changed file${checkpoint.files.length === 1 ? "" : "s"} (${checkpoint.files
            .slice(0, 4)
            .map((file) => file.path)
            .join(", ")}${checkpoint.files.length > 4 ? ", …" : ""}).`;
    artifacts.push(
      artifact({
        id: `checkpoint:${checkpoint.checkpointRef}`,
        kind: "checkpoint",
        label: `Checkpoint ${checkpoint.checkpointTurnCount}`,
        summary: `${checkpoint.status === "ready" ? "Captured" : checkpoint.status}. ${fileSummary}`,
        freshness:
          checkpoint.status !== "ready"
            ? "stale"
            : checkpoint.checkpointTurnCount === newestCheckpointTurn
              ? "current"
              : "superseded",
        checkpointRef: checkpoint.checkpointRef,
        turnId: checkpoint.turnId,
        ...(checkpoint.assistantMessageId ? { messageId: checkpoint.assistantMessageId } : {}),
        createdAt: checkpoint.completedAt,
      }),
    );
    for (const file of checkpoint.files) {
      pushFileArtifact(files, {
        path: file.path,
        summary: `Changed by checkpoint ${checkpoint.checkpointTurnCount}: +${file.additions} / -${file.deletions}.`,
        createdAt: checkpoint.completedAt,
        turnId: checkpoint.turnId,
        freshness:
          checkpoint.checkpointTurnCount === newestCheckpointTurn ? "current" : "superseded",
      });
    }
  }

  for (const activity of activities) {
    const searchText = activitySearchText(activity);
    const paths = new Set<string>();
    collectPaths(activity.payload, paths);
    if (/\b(file[_ -]?change|apply[_ -]?patch|write[_ -]?file|edit[_ -]?file)\b/.test(searchText)) {
      for (const path of paths) {
        pushFileArtifact(files, {
          path,
          summary: activity.summary,
          createdAt: activity.createdAt,
          ...(activity.turnId ? { turnId: activity.turnId } : {}),
          activityId: activity.id,
        });
      }
    }

    if (isWebSourceActivity(searchText)) {
      artifacts.push(
        artifact({
          id: `source:${activity.id}`,
          kind: "source",
          label: sourceLabel(activity),
          summary: activity.summary,
          freshness: "current",
          activityId: activity.id,
          ...(activity.turnId ? { turnId: activity.turnId } : {}),
          createdAt: activity.createdAt,
        }),
      );
    }

    if (isTerminalActivity(searchText)) {
      artifacts.push(
        artifact({
          id: `terminal:${activity.id}`,
          kind: "terminal",
          label: activity.summary,
          summary: activityCommand(activity),
          freshness: "current",
          activityId: activity.id,
          ...(activity.turnId ? { turnId: activity.turnId } : {}),
          createdAt: activity.createdAt,
        }),
      );
    }

    if (activity.kind.startsWith("review.") || /\bcode review\b/.test(searchText)) {
      artifacts.push(
        artifact({
          id: `review:${activity.id}`,
          kind: "review",
          label: activity.summary,
          summary: activity.summary,
          freshness: activity.tone === "error" ? "stale" : "current",
          activityId: activity.id,
          ...(activity.turnId ? { turnId: activity.turnId } : {}),
          createdAt: activity.createdAt,
        }),
      );
    }

    const activityPayload = payloadRecord(activity.payload);
    const checkpointRef = readString(activityPayload, ["checkpointRef"]);
    if (
      checkpointRef &&
      (activity.kind.includes("checkpoint") || activity.kind.includes("handoff"))
    ) {
      artifacts.push(
        artifact({
          id: `checkpoint-activity:${activity.id}`,
          kind: "checkpoint",
          label: activity.summary,
          summary: activity.summary,
          freshness: "current",
          checkpointRef: checkpointRef as ContextArtifact["checkpointRef"],
          activityId: activity.id,
          ...(activity.turnId ? { turnId: activity.turnId } : {}),
          createdAt: activity.createdAt,
        }),
      );
    }
  }

  for (const message of messages) {
    if (message.provenance) {
      artifacts.push(
        artifact({
          id: `provenance:${message.id}`,
          kind: message.provenance.sourceKind === "repository-file" ? "file" : "source",
          label:
            message.provenance.label ??
            message.provenance.path ??
            `Context from ${message.provenance.sourceKind}`,
          summary: `Context attached to a ${message.role} message from ${message.provenance.sourceKind}.`,
          freshness: message.provenance.freshness,
          ...(message.provenance.path ? { path: message.provenance.path } : {}),
          ...(message.turnId ? { turnId: message.turnId } : {}),
          messageId: message.id,
          createdAt: message.provenance.capturedAt ?? message.createdAt,
        }),
      );
    }
  }

  const latestUserMessage = [...messages]
    .toReversed()
    .find((message) => message.role === "user" && message.text.trim().length > 0);
  const latestAssistantMessage = [...messages]
    .toReversed()
    .find((message) => message.role === "assistant" && message.text.trim().length > 0);
  for (const [label, message] of [
    ["Latest request", latestUserMessage],
    ["Latest outcome", latestAssistantMessage],
  ] as const) {
    if (!message) continue;
    artifacts.push(
      artifact({
        id: `message:${message.id}`,
        kind: "note",
        label,
        summary: message.text,
        freshness: "current",
        ...(message.turnId ? { turnId: message.turnId } : {}),
        messageId: message.id,
        createdAt: message.createdAt,
      }),
    );
  }

  for (const plan of plans) {
    artifacts.push(
      artifact({
        id: `plan:${plan.id}`,
        kind: "plan",
        label: plan.implementedAt ? "Implemented plan" : "Actionable plan",
        summary: plan.planMarkdown,
        freshness: plan.implementedAt ? "superseded" : "current",
        ...(plan.turnId ? { turnId: plan.turnId } : {}),
        createdAt: plan.updatedAt,
      }),
    );
  }

  if (thread.handoff) {
    artifacts.push(
      artifact({
        id: `handoff:${thread.handoff.sourceThreadId}:${thread.handoff.importedAt}`,
        kind: "handoff",
        label: `Handoff from ${thread.handoff.sourceProvider}`,
        summary:
          thread.handoff.contextNarrative ??
          thread.handoff.summary ??
          thread.handoff.objective ??
          "Provider handoff context is attached.",
        freshness: thread.handoff.bootstrapStatus === "pending" ? "current" : "stale",
        ...(thread.handoff.checkpointRef ? { checkpointRef: thread.handoff.checkpointRef } : {}),
        createdAt: thread.handoff.importedAt,
      }),
    );
    for (const step of thread.handoff.unfinishedSteps ?? []) {
      if (step.status === "done") continue;
      artifacts.push(
        artifact({
          id: `task:${thread.handoff.sourceThreadId}:${step.id}`,
          kind: "unfinished-task",
          label: step.status === "blocked" ? "Blocked handoff step" : "Unfinished handoff step",
          summary: step.text,
          freshness: "current",
          createdAt: thread.handoff.importedAt,
        }),
      );
    }
    const repo = thread.handoff.repoSnapshot;
    if (repo) {
      artifacts.push(
        artifact({
          id: `git-change:${thread.id}:${repo.capturedAt}`,
          kind: "git-change",
          label: repo.branch ? `Git changes on ${repo.branch}` : "Git workspace changes",
          summary:
            repo.statusSummary ??
            `${repo.changedFiles.length} changed file${repo.changedFiles.length === 1 ? "" : "s"}${
              repo.headSha ? ` at ${repo.headSha.slice(0, 12)}` : ""
            }.`,
          freshness: repo.hasWorkingTreeChanges ? "current" : "stale",
          createdAt: repo.capturedAt,
        }),
      );
      for (const file of repo.changedFiles) {
        pushFileArtifact(files, {
          path: file.path,
          summary: `Handoff working tree change: +${file.insertions} / -${file.deletions}.`,
          createdAt: repo.capturedAt,
        });
      }
    }
  }

  const messagesById = new Map(messages.map((message) => [message.id, message]));
  for (const pin of thread.pinnedMessages ?? []) {
    const message = messagesById.get(pin.messageId);
    artifacts.push(
      artifact({
        id: `pin:${pin.messageId}`,
        kind: "pin",
        label: pin.label ?? "Pinned message",
        summary: message?.text ?? "Pinned thread message.",
        freshness: pin.done ? "superseded" : "current",
        messageId: pin.messageId,
        ...(message?.turnId ? { turnId: message.turnId } : {}),
        createdAt: pin.pinnedAt,
      }),
    );
  }
  for (const marker of thread.threadMarkers ?? []) {
    artifacts.push(
      artifact({
        id: `marker:${marker.id}`,
        kind: "pin",
        label: marker.label ?? "Marked context",
        summary: marker.selectedText,
        freshness: marker.done ? "superseded" : "current",
        messageId: marker.messageId,
        createdAt: marker.updatedAt,
      }),
    );
  }
  if (thread.notes?.trim()) {
    artifacts.push(
      artifact({
        id: `notes:${thread.id}`,
        kind: "note",
        label: "Thread notes",
        summary: thread.notes,
        freshness: "user-edited",
        createdAt: thread.updatedAt,
      }),
    );
  }

  artifacts.push(...files.values());
  const uniqueArtifacts = [
    ...new Map(artifacts.map((entry) => [entry.id, entry] as const)).values(),
  ].toSorted(
    (left, right) =>
      (right.createdAt ?? "").localeCompare(left.createdAt ?? "") ||
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id),
  );
  const bundleWithoutNarrative: SharedContextBundle = {
    threadId: thread.id,
    projectId: thread.projectId,
    generatedAt,
    title: thread.title,
    provider: thread.modelSelection.provider,
    narrative: "",
    artifacts: uniqueArtifacts,
  };
  return {
    ...bundleWithoutNarrative,
    narrative: formatSharedContextNarrative(bundleWithoutNarrative),
  };
}

const narrativeSectionByKind: Record<ContextArtifactKind, string> = {
  "unfinished-task": "Continue from here",
  plan: "Continue from here",
  pin: "Continue from here",
  note: "Recent thread context",
  handoff: "Recent thread context",
  session: "Workspace state",
  checkpoint: "Workspace state",
  "git-change": "Workspace state",
  file: "Workspace state",
  terminal: "Activity and sources",
  source: "Activity and sources",
  review: "Activity and sources",
};

/** Formats a compact provider-neutral handoff prompt from bundle artifacts. */
export function formatSharedContextNarrative(bundle: SharedContextBundle): string {
  const sections = new Map<string, ContextArtifact[]>();
  for (const entry of bundle.artifacts) {
    if (entry.freshness === "superseded") continue;
    const section = narrativeSectionByKind[entry.kind];
    const existing = sections.get(section);
    if (existing) existing.push(entry);
    else sections.set(section, [entry]);
  }

  const lines = [
    `# Shared context: ${bundle.title}`,
    `Provider: ${bundle.provider}. Generated: ${bundle.generatedAt}.`,
  ];
  for (const section of [
    "Continue from here",
    "Recent thread context",
    "Workspace state",
    "Activity and sources",
  ]) {
    const entries = sections.get(section)?.slice(0, section === "Workspace state" ? 12 : 8) ?? [];
    if (entries.length === 0) continue;
    lines.push("", `## ${section}`);
    for (const entry of entries) {
      lines.push(`- **${compactText(entry.label, 100)}** — ${compactText(entry.summary, 240)}`);
    }
  }
  if (bundle.artifacts.length === 0) {
    lines.push("", "No durable context artifacts were available.");
  }
  return lines.join("\n");
}
