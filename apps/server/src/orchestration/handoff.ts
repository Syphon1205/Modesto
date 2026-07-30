import {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_SEND_TURN_MAX_INPUT_CHARS,
  type OrchestrationMessage,
  type OrchestrationThread,
  type ThreadHandoff,
  type ThreadHandoffRepoSnapshot,
  type ThreadHandoffReturnPayload,
  type ThreadHandoffStep,
} from "@modesto/contracts";

const RECENT_MESSAGE_COUNT = 6;
const EARLIER_MESSAGE_CHAR_LIMIT = 320;
const RECENT_MESSAGE_CHAR_LIMIT = 2_400;
const HANDOFF_BOOTSTRAP_CHAR_BUDGET = Math.floor(PROVIDER_SEND_TURN_MAX_INPUT_CHARS * 0.75);

function normalizeMessageText(value: string): string {
  return value
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function roleLabel(message: Pick<OrchestrationMessage, "role">): "User" | "Assistant" {
  return message.role === "assistant" ? "Assistant" : "User";
}

export function listImportedHandoffMessages(
  thread: Pick<OrchestrationThread, "messages">,
): ReadonlyArray<OrchestrationMessage> {
  return thread.messages.filter(
    (message) =>
      message.source === "handoff-import" &&
      (message.role === "user" || message.role === "assistant") &&
      message.streaming === false,
  );
}

export function listImportedForkMessages(
  thread: Pick<OrchestrationThread, "messages">,
): ReadonlyArray<OrchestrationMessage> {
  return thread.messages.filter(
    (message) =>
      message.source === "fork-import" &&
      (message.role === "user" || message.role === "assistant") &&
      message.streaming === false,
  );
}

export function hasNativeHandoffMessages(thread: Pick<OrchestrationThread, "messages">): boolean {
  return thread.messages.some(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      message.source === "native" &&
      message.streaming === false,
  );
}

export function hasNativeAssistantMessagesBefore(
  thread: Pick<OrchestrationThread, "messages">,
  currentMessageId: string,
): boolean {
  const currentIndex = thread.messages.findIndex((message) => message.id === currentMessageId);
  if (currentIndex <= 0) {
    return false;
  }
  return thread.messages.slice(0, currentIndex).some((message) => {
    return (
      message.role === "assistant" && message.source === "native" && message.streaming === false
    );
  });
}

export function listPriorTranscriptMessages(
  thread: Pick<OrchestrationThread, "messages">,
  currentMessageId: string,
): ReadonlyArray<OrchestrationMessage> {
  const currentIndex = thread.messages.findIndex((message) => message.id === currentMessageId);
  if (currentIndex <= 0) {
    return [];
  }

  return thread.messages.slice(0, currentIndex).filter((message) => {
    return (
      (message.role === "user" || message.role === "assistant") &&
      message.streaming === false &&
      normalizeMessageText(message.text).length > 0
    );
  });
}

function formatUnfinishedSteps(steps: ReadonlyArray<ThreadHandoffStep>): string | null {
  if (steps.length === 0) {
    return null;
  }
  return (
    "Incomplete work (do not redo items already marked done):\n" +
    steps.map((step) => `- [${step.status}] ${step.text}`).join("\n")
  );
}

function formatRepoSnapshot(snapshot: ThreadHandoffRepoSnapshot): string {
  const lines: string[] = ["REPOSITORY STATE (authoritative over conversation memory):"];
  if (snapshot.branch) {
    lines.push(`Branch: ${snapshot.branch}`);
  }
  if (snapshot.worktreePath) {
    lines.push(`Worktree: ${snapshot.worktreePath}`);
  }
  if (snapshot.headSha) {
    lines.push(`HEAD: ${snapshot.headSha}`);
  }
  lines.push(
    snapshot.hasWorkingTreeChanges
      ? "Working tree: has uncommitted changes"
      : "Working tree: clean",
  );
  if (snapshot.changedFiles.length > 0) {
    lines.push(
      "Changed files:\n" +
        snapshot.changedFiles
          .map((file) => `- ${file.path} (+${file.insertions}/-${file.deletions})`)
          .join("\n"),
    );
  }
  if (snapshot.statusSummary?.trim()) {
    lines.push(`Status summary:\n${snapshot.statusSummary.trim()}`);
  }
  if (snapshot.diffSummaryMarkdown?.trim()) {
    lines.push(`Diff summary:\n${snapshot.diffSummaryMarkdown.trim()}`);
  }
  lines.push(`Captured at: ${snapshot.capturedAt}`);
  return lines.join("\n");
}

function formatDiffAckInstruction(handoff: ThreadHandoff): string | null {
  if (handoff.diffAckStatus !== "pending") {
    return null;
  }
  return [
    "DIFF REVIEW REQUIRED:",
    "Before continuing implementation, inspect the current working-tree diff and explicitly acknowledge what changed.",
    "State which files you reviewed and what unfinished work remains. Do not assume conversation history matches the repo.",
    "Do not repeat work that is already present in the diff or marked done in incomplete work.",
  ].join("\n");
}

function formatConversationSection(input: {
  importedMessages: ReadonlyArray<OrchestrationMessage>;
  title: string;
}): string {
  const earlierMessages = input.importedMessages.slice(0, -RECENT_MESSAGE_COUNT);
  const recentMessages = input.importedMessages.slice(-RECENT_MESSAGE_COUNT);
  const sections: string[] = [
    "CONVERSATION CONTEXT (inherited history — may be stale relative to the repo):",
    `Original conversation title: ${input.title}`,
  ];

  if (earlierMessages.length > 0) {
    sections.push(
      "Earlier conversation summary:\n" +
        earlierMessages
          .map((message) => {
            const normalized = truncateText(
              normalizeMessageText(message.text),
              EARLIER_MESSAGE_CHAR_LIMIT,
            );
            return `- ${roleLabel(message)}: ${normalized}`;
          })
          .join("\n"),
    );
  }

  if (recentMessages.length > 0) {
    sections.push(
      "Most recent imported messages:\n" +
        recentMessages
          .map((message) => {
            const normalized = truncateText(
              normalizeMessageText(message.text),
              RECENT_MESSAGE_CHAR_LIMIT,
            );
            return `${roleLabel(message)}:\n${normalized}`;
          })
          .join("\n\n"),
    );
  }

  return sections.join("\n\n");
}

function buildImportedMessagesBootstrapText(input: {
  thread: Pick<OrchestrationThread, "title" | "branch" | "worktreePath">;
  importedMessages: ReadonlyArray<OrchestrationMessage>;
  intro: string;
  maxChars: number;
}): string | null {
  if (input.importedMessages.length === 0) {
    return null;
  }

  const sections: string[] = [input.intro, `Original conversation title: ${input.thread.title}`];

  if (input.thread.branch) {
    sections.push(`Git branch: ${input.thread.branch}`);
  }
  if (input.thread.worktreePath) {
    sections.push(`Worktree path: ${input.thread.worktreePath}`);
  }

  sections.push(
    formatConversationSection({
      importedMessages: input.importedMessages,
      title: input.thread.title,
    }),
  );

  const joined = sections.join("\n\n").trim();
  return truncateText(joined, Math.max(0, input.maxChars));
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

export function buildHandoffBootstrapText(
  thread: Pick<OrchestrationThread, "title" | "branch" | "worktreePath" | "handoff" | "messages">,
  maxChars = HANDOFF_BOOTSTRAP_CHAR_BUDGET,
): string | null {
  const importedMessages = listImportedHandoffMessages(thread);
  if (thread.handoff === null) {
    return null;
  }
  if (
    importedMessages.length === 0 &&
    !thread.handoff.summary &&
    !thread.handoff.objective &&
    !thread.handoff.contextNarrative
  ) {
    return null;
  }

  const sourceLabel =
    PROVIDER_DISPLAY_NAMES[thread.handoff.sourceProvider] ?? thread.handoff.sourceProvider;
  const sections: string[] = [
    `HANDOFF SEAM from ${sourceLabel}.`,
    "Treat the note below and the live repository as authoritative. Imported conversation may be stale.",
  ];

  if (thread.handoff.summary?.trim()) {
    sections.push(`What landed:\n${thread.handoff.summary.trim()}`);
  }
  if (thread.handoff.objective?.trim()) {
    sections.push(`Next step:\n${thread.handoff.objective.trim()}`);
  }
  if (thread.handoff.contextNarrative?.trim()) {
    sections.push(`SHARED CONTEXT BUNDLE:\n${thread.handoff.contextNarrative.trim()}`);
  }

  const stepsSection = formatUnfinishedSteps(thread.handoff.unfinishedSteps ?? []);
  if (stepsSection) {
    sections.push(stepsSection);
  }

  if (thread.handoff.repoSnapshot) {
    sections.push(formatRepoSnapshot(thread.handoff.repoSnapshot));
  } else {
    const fallbackRepo: string[] = ["REPOSITORY STATE (authoritative over conversation memory):"];
    if (thread.branch) {
      fallbackRepo.push(`Branch: ${thread.branch}`);
    }
    if (thread.worktreePath) {
      fallbackRepo.push(`Worktree: ${thread.worktreePath}`);
    }
    if (fallbackRepo.length > 1) {
      sections.push(fallbackRepo.join("\n"));
    }
  }

  const ack = formatDiffAckInstruction(thread.handoff);
  if (ack) {
    sections.push(ack);
  }

  if (thread.handoff.checkpointStatus === "captured" && thread.handoff.checkpointRef) {
    sections.push(
      [
        "AGENT CHECKPOINT:",
        "A durable hidden checkpoint of the working tree was captured at this seam.",
        "Prefer that checkpoint when inspecting or rolling back handoff work; do not invent a different baseline.",
      ].join("\n"),
    );
  }

  if (importedMessages.length > 0) {
    sections.push(
      formatConversationSection({
        importedMessages,
        title: thread.title,
      }),
    );
  }

  return truncateText(sections.join("\n\n").trim(), Math.max(0, maxChars));
}

export function buildHandoffReturnBootstrapText(
  handoffReturn: ThreadHandoffReturnPayload,
  maxChars = HANDOFF_BOOTSTRAP_CHAR_BUDGET,
): string {
  const fromLabel =
    PROVIDER_DISPLAY_NAMES[handoffReturn.fromProvider] ?? handoffReturn.fromProvider;
  const completedStepIds = handoffReturn.completedStepIds ?? [];
  const sections: string[] = [
    `HANDOFF RETURN from ${fromLabel}.`,
    `Return summary:\n${handoffReturn.summary}`,
  ];
  if (completedStepIds.length > 0) {
    sections.push(`Completed step ids:\n${completedStepIds.map((id) => `- ${id}`).join("\n")}`);
  }
  if (handoffReturn.repoSnapshot) {
    sections.push(formatRepoSnapshot(handoffReturn.repoSnapshot));
  }
  sections.push(
    "Do not redo work described as completed in the return summary. Inspect the current diff before continuing.",
  );
  return truncateText(sections.join("\n\n").trim(), Math.max(0, maxChars));
}

export function buildPriorTranscriptBootstrapText(
  thread: Pick<OrchestrationThread, "title" | "branch" | "worktreePath" | "messages">,
  currentMessageId: string,
  maxChars = HANDOFF_BOOTSTRAP_CHAR_BUDGET,
): string | null {
  const priorMessages = listPriorTranscriptMessages(thread, currentMessageId);
  if (priorMessages.length === 0) {
    return null;
  }

  return buildImportedMessagesBootstrapText({
    thread,
    importedMessages: priorMessages,
    intro:
      "This provider session may have been restarted without native conversation state. Use this prior Modesto transcript as context for the latest user message.",
    maxChars,
  });
}

export function buildForkBootstrapText(
  thread: Pick<OrchestrationThread, "title" | "branch" | "worktreePath" | "messages">,
  maxChars = HANDOFF_BOOTSTRAP_CHAR_BUDGET,
): string | null {
  const importedMessages = listImportedForkMessages(thread);
  if (importedMessages.length === 0) {
    return null;
  }

  return buildImportedMessagesBootstrapText({
    thread,
    importedMessages,
    intro: "This sidechat was cloned from an earlier conversation.",
    maxChars,
  });
}
