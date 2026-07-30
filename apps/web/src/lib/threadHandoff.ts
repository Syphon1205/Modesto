// FILE: threadHandoff.ts
// Purpose: Builds client-side handoff commands and imported transcript payloads.
// Layer: Web handoff utilities
// Exports: target-provider, title, transcript, and model-selection helpers.

import {
  EventId,
  MessageId,
  type GitStatusResult,
  type OrchestrationThreadActivity,
  PROVIDER_DISPLAY_NAMES,
  type ModelSelection,
  type ProviderKind,
  type ThreadHandoff,
  type ThreadHandoffImportedMessage,
  type ThreadHandoffRepoSnapshot,
  type ThreadHandoffStep,
} from "@modesto/contracts";
import { getDefaultModel } from "@modesto/shared/model";
import { type Thread } from "../types";
import { stripEmbeddedAssistantSelections } from "./assistantSelections";
import { randomUUID } from "./utils";

const HANDOFF_SUMMARY_MESSAGE_CHAR_LIMIT = 480;
const HANDOFF_OBJECTIVE_CHAR_LIMIT = 600;
const HANDOFF_PLAN_STEP_CHAR_LIMIT = 240;
const MARKDOWN_TASK_ITEM_PATTERN =
  /^(?<indent>\s*)(?:[-*+]|\d+[.)])\s+\[(?<marker>[ xX])\]\s+(?<text>.+)$/;

const HANDOFF_PROVIDER_ORDER: ReadonlyArray<ProviderKind> = [
  "codex",
  "claudeAgent",
  "cursor",
  "poolside",
  "gemini",
  "grok",
  "droid",
  "kilo",
  "opencode",
  "pi",
];
const IMPORTABLE_THREAD_ACTIVITY_KINDS = new Set([
  "account.rate-limits.updated",
  "account.rate-limited",
  "context-window.updated",
  "context-window.configured",
]);

function isImportableThreadMessage(
  message: Thread["messages"][number],
): message is Thread["messages"][number] & {
  role: "user" | "assistant";
} {
  return (message.role === "user" || message.role === "assistant") && message.streaming === false;
}

function isImportableThreadActivity(
  activity: Thread["activities"][number],
): activity is OrchestrationThreadActivity {
  return IMPORTABLE_THREAD_ACTIVITY_KINDS.has(activity.kind);
}

export function resolveAvailableHandoffTargetProviders(
  sourceProvider: ProviderKind,
): ReadonlyArray<ProviderKind> {
  return HANDOFF_PROVIDER_ORDER.filter((provider) => provider !== sourceProvider);
}

export function resolveThreadHandoffBadgeLabel(thread: Pick<Thread, "handoff">): string | null {
  if (!thread.handoff) {
    return null;
  }
  return `Handoff from ${PROVIDER_DISPLAY_NAMES[thread.handoff.sourceProvider]}`;
}

export type HandoffSeamPresentation = {
  readonly fromLabel: string;
  readonly toLabel: string | null;
  readonly doneLines: ReadonlyArray<string>;
  readonly incompleteLines: ReadonlyArray<string>;
  readonly nextLines: ReadonlyArray<string>;
  readonly repoLine: string | null;
  readonly checkpointLine: string | null;
  readonly canInspectCheckpoint: boolean;
  readonly canRollbackCheckpoint: boolean;
};

function splitHandoffNoteLines(value: string | null | undefined, limit = 3): string[] {
  if (!value) return [];
  const lines: string[] = [];
  for (const block of value.split(/\n+/)) {
    const normalized = truncateHandoffText(normalizeHandoffText(block), 180);
    if (normalized.length === 0) continue;
    // Skip the old auto-summary scaffolding so the seam card stays scannable.
    if (/^Thread:/i.test(normalized) || /^Recent conversation:/i.test(normalized)) {
      continue;
    }
    if (/^-\s+(User|Assistant):/i.test(normalized)) {
      continue;
    }
    lines.push(normalized);
    if (lines.length >= limit) break;
  }
  return lines;
}

/**
 * Turns a ThreadHandoff into the short Claude → Codex note card the destination UI shows.
 */
export function buildHandoffSeamPresentation(input: {
  readonly handoff: Pick<
    ThreadHandoff,
    | "sourceProvider"
    | "summary"
    | "objective"
    | "unfinishedSteps"
    | "repoSnapshot"
    | "checkpointStatus"
    | "checkpointRef"
  >;
  readonly targetProvider?: ProviderKind | null;
}): HandoffSeamPresentation {
  const unfinished = input.handoff.unfinishedSteps ?? [];
  const incompleteLines = unfinished
    .filter((step) => step.status === "todo" || step.status === "blocked")
    .map((step) => truncateHandoffText(normalizeHandoffText(step.text), 160))
    .filter((text) => text.length > 0)
    .slice(0, 4);
  const inProgressLines = unfinished
    .filter((step) => step.status === "doing")
    .map((step) => truncateHandoffText(normalizeHandoffText(step.text), 160))
    .filter((text) => text.length > 0)
    .slice(0, 2);

  const doneLines = splitHandoffNoteLines(input.handoff.summary);
  const nextFromObjective = splitHandoffNoteLines(input.handoff.objective, 2);
  const nextLines = [...inProgressLines, ...nextFromObjective].slice(0, 3);

  const snapshot = input.handoff.repoSnapshot;
  let repoLine: string | null = null;
  if (snapshot) {
    const branch = snapshot.branch?.trim() || "Detached";
    if (snapshot.hasWorkingTreeChanges) {
      const count = snapshot.changedFiles.length;
      repoLine =
        count > 0
          ? `${branch} · ${count} changed file${count === 1 ? "" : "s"}`
          : `${branch} · dirty working tree`;
    } else {
      repoLine = `${branch} · clean`;
    }
  }

  const checkpointStatus = input.handoff.checkpointStatus ?? "not_applicable";
  const hasCheckpointRef = Boolean(input.handoff.checkpointRef);
  let checkpointLine: string | null = null;
  if (checkpointStatus === "captured" && hasCheckpointRef) {
    checkpointLine = "Durable seam checkpoint captured";
  } else if (checkpointStatus === "rolled_back" && hasCheckpointRef) {
    checkpointLine = "Working tree rolled back to this seam";
  } else if (checkpointStatus === "missing") {
    checkpointLine = "Seam checkpoint unavailable";
  }

  return {
    fromLabel: PROVIDER_DISPLAY_NAMES[input.handoff.sourceProvider],
    toLabel: input.targetProvider ? PROVIDER_DISPLAY_NAMES[input.targetProvider] : null,
    doneLines,
    incompleteLines,
    nextLines,
    repoLine,
    checkpointLine,
    canInspectCheckpoint: hasCheckpointRef && checkpointStatus === "captured",
    canRollbackCheckpoint: hasCheckpointRef && checkpointStatus === "captured",
  };
}

// Preserve the visible source thread name when creating the destination thread.
export function resolveThreadHandoffTitle(thread: Pick<Thread, "title">): string {
  const title = thread.title.trim().replace(/\s+/g, " ");
  return title.length > 0 ? title : "Handoff";
}

export function buildThreadHandoffImportedMessages(
  thread: Pick<Thread, "messages">,
): ReadonlyArray<ThreadHandoffImportedMessage> {
  return thread.messages.filter(isImportableThreadMessage).map((message) => {
    const importedText =
      message.role === "user" ? stripEmbeddedAssistantSelections(message.text) : message.text;
    const importedMessage: ThreadHandoffImportedMessage = {
      messageId: MessageId.makeUnsafe(randomUUID()),
      role: message.role,
      text: importedText,
      createdAt: message.createdAt,
      updatedAt: message.completedAt ?? message.createdAt,
    };
    const attachments =
      message.attachments && message.attachments.length > 0
        ? message.attachments.map((attachment) =>
            attachment.type === "assistant-selection"
              ? {
                  type: attachment.type,
                  id: attachment.id,
                  assistantMessageId: attachment.assistantMessageId,
                  text: attachment.text,
                }
              : {
                  type: attachment.type,
                  id: attachment.id,
                  name: attachment.name,
                  mimeType: attachment.mimeType,
                  sizeBytes: attachment.sizeBytes,
                },
          )
        : null;
    return attachments ? Object.assign(importedMessage, { attachments }) : importedMessage;
  });
}

export function buildThreadHandoffImportedActivities(
  thread: Pick<Thread, "activities">,
): ReadonlyArray<OrchestrationThreadActivity> {
  return thread.activities.filter(isImportableThreadActivity).map((activity) => {
    const { sequence: _sequence, ...rest } = activity;
    return {
      ...rest,
      id: EventId.makeUnsafe(randomUUID()),
    };
  });
}

// Used by: ChatView fork command gating.
export function hasTransferableThreadMessages(thread: Pick<Thread, "messages">): boolean {
  return thread.messages.some(isImportableThreadMessage);
}

export function hasNativeThreadHandoffMessages(thread: Pick<Thread, "messages">): boolean {
  return thread.messages.some(
    (message) => isImportableThreadMessage(message) && message.source === "native",
  );
}

export function canCreateThreadHandoff(input: {
  readonly thread: Pick<Thread, "handoff" | "messages" | "session">;
  readonly isBusy?: boolean;
  readonly hasPendingApprovals?: boolean;
  readonly hasPendingUserInput?: boolean;
}): boolean {
  if (input.isBusy || input.hasPendingApprovals || input.hasPendingUserInput) {
    return false;
  }
  const sessionStatus = input.thread.session?.orchestrationStatus;
  if (sessionStatus === "starting" || sessionStatus === "running") {
    return false;
  }
  const importedMessages = buildThreadHandoffImportedMessages(input.thread);
  if (importedMessages.length === 0) {
    return false;
  }
  if (input.thread.handoff !== null) {
    return hasNativeThreadHandoffMessages(input.thread);
  }
  return true;
}

function normalizeHandoffText(value: string): string {
  return value
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateHandoffText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function listImportableHandoffContextMessages(
  thread: Pick<Thread, "messages">,
): ReadonlyArray<Thread["messages"][number] & { role: "user" | "assistant" }> {
  return thread.messages.filter(isImportableThreadMessage);
}

function parseMarkdownTaskItems(planMarkdown: string): ReadonlyArray<{
  readonly text: string;
  readonly status: ThreadHandoffStep["status"];
}> {
  const items: Array<{ text: string; status: ThreadHandoffStep["status"] }> = [];
  for (const line of planMarkdown.split("\n")) {
    const match = line.match(MARKDOWN_TASK_ITEM_PATTERN);
    if (!match?.groups?.text) {
      continue;
    }
    const text = truncateHandoffText(
      normalizeHandoffText(match.groups.text),
      HANDOFF_PLAN_STEP_CHAR_LIMIT,
    );
    if (text.length === 0) {
      continue;
    }
    const marker = match.groups.marker?.toLowerCase() ?? " ";
    items.push({
      text,
      status: marker === "x" ? "done" : "todo",
    });
  }
  return items;
}

export function buildDefaultHandoffSummary(thread: Pick<Thread, "title" | "messages">): string {
  const importableMessages = listImportableHandoffContextMessages(thread);
  for (let index = importableMessages.length - 1; index >= 0; index -= 1) {
    const message = importableMessages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const normalized = truncateHandoffText(
      normalizeHandoffText(message.text),
      HANDOFF_SUMMARY_MESSAGE_CHAR_LIMIT,
    );
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return resolveThreadHandoffTitle(thread);
}

export function buildContextAwareHandoffSummary(
  summary: string,
  contextNarrative: string | null | undefined,
): string {
  const normalizedSummary = summary.trim();
  if (!contextNarrative?.trim()) return normalizedSummary;
  if (normalizedSummary.length === 0) return contextNarrative.trim();
  if (/context attached/i.test(normalizedSummary)) return normalizedSummary;
  return `${normalizedSummary}\n\nContext attached from the shared workspace.`;
}

export function buildDefaultHandoffObjective(
  thread: Pick<Thread, "title" | "messages" | "notes">,
): string {
  const notes = thread.notes?.trim();
  if (notes && notes.length > 0) {
    return truncateHandoffText(notes, HANDOFF_OBJECTIVE_CHAR_LIMIT);
  }

  const importableMessages = listImportableHandoffContextMessages(thread);
  for (let index = importableMessages.length - 1; index >= 0; index -= 1) {
    const message = importableMessages[index];
    if (message?.role !== "user") {
      continue;
    }
    const normalized = truncateHandoffText(
      normalizeHandoffText(stripEmbeddedAssistantSelections(message.text)),
      HANDOFF_OBJECTIVE_CHAR_LIMIT,
    );
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return resolveThreadHandoffTitle(thread);
}

export function buildHandoffUnfinishedSteps(
  thread: Pick<Thread, "proposedPlans" | "pinnedMessages" | "messages">,
): ReadonlyArray<ThreadHandoffStep> {
  const steps: ThreadHandoffStep[] = [];
  const seen = new Set<string>();

  const latestOpenPlan = thread.proposedPlans
    .toReversed()
    .find((plan) => plan.implementedAt === null);
  if (latestOpenPlan) {
    for (const [index, item] of parseMarkdownTaskItems(latestOpenPlan.planMarkdown).entries()) {
      if (item.status === "done") {
        continue;
      }
      const id = `plan:${latestOpenPlan.id}:${index}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      steps.push({
        id,
        text: item.text,
        status: item.status,
      });
    }
  }

  const messageTextById = new Map(
    thread.messages.map((message) => [message.id, normalizeHandoffText(message.text)]),
  );
  for (const pin of thread.pinnedMessages ?? []) {
    if (pin.done) {
      continue;
    }
    const id = `pin:${pin.messageId}`;
    if (seen.has(id)) {
      continue;
    }
    const label = pin.label?.trim();
    const messageText = messageTextById.get(pin.messageId) ?? "";
    const text = truncateHandoffText(
      label && label.length > 0 ? label : messageText,
      HANDOFF_PLAN_STEP_CHAR_LIMIT,
    );
    if (text.length === 0) {
      continue;
    }
    seen.add(id);
    steps.push({
      id,
      text,
      status: "todo",
    });
  }

  return steps;
}

export function buildThreadHandoffRepoSnapshotFromGit(input: {
  readonly status: GitStatusResult;
  readonly diffSummaryMarkdown?: string | null;
  readonly worktreePath?: string | null;
  readonly capturedAt: string;
  readonly headSha?: string | null;
}): ThreadHandoffRepoSnapshot {
  const statusSummaryParts: string[] = [];
  if (input.status.branch) {
    statusSummaryParts.push(`Branch: ${input.status.branch}`);
  }
  if (input.status.hasUpstream && input.status.upstreamBranch) {
    statusSummaryParts.push(
      `Upstream: ${input.status.upstreamBranch} (+${input.status.aheadCount}/-${input.status.behindCount})`,
    );
  }
  if (input.status.pr) {
    statusSummaryParts.push(`PR #${input.status.pr.number}: ${input.status.pr.title}`);
  }
  statusSummaryParts.push(
    input.status.hasWorkingTreeChanges
      ? "Working tree has uncommitted changes"
      : "Working tree clean",
  );

  return {
    headSha: input.headSha ?? null,
    branch: input.status.branch,
    worktreePath: input.worktreePath ?? null,
    hasWorkingTreeChanges: input.status.hasWorkingTreeChanges,
    changedFiles: input.status.workingTree.files.map((file) => ({
      path: file.path,
      insertions: file.insertions,
      deletions: file.deletions,
    })),
    statusSummary: statusSummaryParts.join("\n"),
    diffSummaryMarkdown: input.diffSummaryMarkdown?.trim()
      ? input.diffSummaryMarkdown.trim()
      : null,
    capturedAt: input.capturedAt,
  };
}

export function resolveHandoffDiffAckStatus(input: {
  readonly explicit?: ThreadHandoff["diffAckStatus"] | null;
  readonly repoSnapshot?: ThreadHandoffRepoSnapshot | null;
}): NonNullable<ThreadHandoff["diffAckStatus"]> {
  if (input.explicit) {
    return input.explicit;
  }
  return input.repoSnapshot?.hasWorkingTreeChanges ? "pending" : "not_required";
}

export function resolveThreadHandoffModelSelection(input: {
  readonly sourceThread: Pick<Thread, "modelSelection">;
  readonly targetProvider: ProviderKind;
  readonly projectDefaultModelSelection: ModelSelection | null | undefined;
  readonly stickyModelSelectionByProvider: Partial<Record<ProviderKind, ModelSelection>>;
}): ModelSelection {
  const isCompatibleSelection = (
    selection: ModelSelection | null | undefined,
  ): selection is ModelSelection => {
    if (!selection || selection.provider !== input.targetProvider) {
      return false;
    }
    return input.targetProvider !== "kilo" || selection.model.startsWith("kilo/");
  };

  const stickySelection = input.stickyModelSelectionByProvider[input.targetProvider];
  if (isCompatibleSelection(stickySelection)) {
    return stickySelection;
  }
  if (isCompatibleSelection(input.projectDefaultModelSelection)) {
    return input.projectDefaultModelSelection;
  }
  const defaultModel = getDefaultModel(input.targetProvider);
  if (!defaultModel) {
    throw new Error("Select a Pi model before handing off to Pi.");
  }
  return {
    provider: input.targetProvider,
    model: defaultModel,
  };
}

export interface ThreadHandoffDraft {
  readonly sourceThread: Thread;
  readonly targetProvider: ProviderKind;
  readonly summary: string;
  readonly objective: string;
  readonly unfinishedSteps: ReadonlyArray<ThreadHandoffStep>;
  readonly repoSnapshot: ThreadHandoffRepoSnapshot | null;
  readonly diffAckStatus: NonNullable<ThreadHandoff["diffAckStatus"]>;
  readonly repoSnapshotLoading: boolean;
}

export interface ThreadHandoffReturnDraft {
  readonly fromThread: Thread;
  readonly sourceThreadId: Thread["id"];
  readonly summary: string;
  readonly repoSnapshot: ThreadHandoffRepoSnapshot | null;
  readonly completedStepIds: ReadonlyArray<string>;
  readonly repoSnapshotLoading: boolean;
}

export const HANDOFF_DIFF_ACK_PROMPT =
  "Please review the current working-tree diff and acknowledge what changed before continuing. List the files you inspected and what unfinished work remains.";
