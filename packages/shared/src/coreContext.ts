export const THREAD_CORE_CONTEXT_ACTIVITY_KIND = "thread.core-context";
export const CORE_CONTEXT_DEFAULT_TITLE = "New thread";
export const HANDOFF_SEAM_TURN_PREFIX = "handoff:";
export const HANDOFF_SEAM_MODEL_SWITCH_PREFIX = "handoff:model-switch:";

export type CoreContextReason = "handoff" | "model-switch" | "turn" | "plan";

export type CoreContextFile = {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
};

export type CoreContext = {
  readonly objective: string | null;
  readonly decisions: ReadonlyArray<string>;
  readonly status: string | null;
  readonly changedFiles: ReadonlyArray<CoreContextFile>;
  readonly incomplete: string | null;
  readonly nextStep: string | null;
  readonly checks: string | null;
  readonly checkpointTurnCount: number | null;
  readonly checkpointRef: string | null;
  readonly reason: CoreContextReason;
};

export type CoreContextMessage = {
  readonly role: string;
  readonly text: string;
};

export type CoreContextProposedPlan = {
  readonly planMarkdown: string;
  readonly implementedAt: string | null;
};

export type CoreContextCheckpoint = {
  readonly checkpointTurnCount: number;
  readonly checkpointRef: string;
  readonly files: ReadonlyArray<CoreContextFile>;
};

const OBJECTIVE_MAX_CHARS = 240;
const STATUS_MAX_CHARS = 400;
const SECTION_MAX_CHARS = 280;
const MAX_DECISIONS = 6;
const MAX_FORMATTED_FILES = 20;

const DECISION_LINE =
  /^\s*(?:[-*]\s*)?(?:\*\*)?decisions?(?:\*\*)?:?\s*(?:\*\*)?\s*(.+?)\s*(?:\*\*)?\s*$/i;
const NEXT_LINE =
  /^\s*(?:[-*]\s*)?(?:\*\*)?next(?: step)?(?:\*\*)?:?\s*(?:\*\*)?\s*(.+?)\s*(?:\*\*)?\s*$/i;
const INCOMPLETE_LINE =
  /^\s*(?:[-*]\s*)?(?:\*\*)?(?:incomplete|todo|remaining|gap)(?:\*\*)?:?\s*(?:\*\*)?\s*(.+?)\s*(?:\*\*)?\s*$/i;

export function isHandoffSeamTurnId(turnId: string): boolean {
  return turnId.startsWith(HANDOFF_SEAM_TURN_PREFIX);
}

export function coreContextReasonFromHandoffTurnId(turnId: string): CoreContextReason {
  if (turnId.startsWith(HANDOFF_SEAM_MODEL_SWITCH_PREFIX)) {
    return "model-switch";
  }
  if (isHandoffSeamTurnId(turnId)) {
    return "handoff";
  }
  return "turn";
}

export function coreContextActivitySummary(reason: CoreContextReason): string {
  switch (reason) {
    case "handoff":
    case "model-switch":
      return "Handoff checkpoint ready";
    case "plan":
    case "turn":
      return "Core context updated";
  }
}

export function buildCoreContext(input: {
  readonly title?: string | null;
  readonly defaultTitle?: string | null;
  readonly messages: ReadonlyArray<CoreContextMessage>;
  readonly proposedPlans?: ReadonlyArray<CoreContextProposedPlan>;
  readonly latestCheckpoint?: CoreContextCheckpoint | null;
  readonly reason: CoreContextReason;
}): CoreContext {
  const defaultTitle = input.defaultTitle?.trim() || CORE_CONTEXT_DEFAULT_TITLE;
  const title = input.title?.trim() || "";
  const userMessages = input.messages.filter(
    (message) => message.role === "user" && message.text.trim().length > 0,
  );
  const assistantMessages = input.messages.filter(
    (message) => message.role === "assistant" && message.text.trim().length > 0,
  );
  const activePlan = selectActivePlan(input.proposedPlans ?? []);
  const planMarkdown = activePlan?.planMarkdown ?? "";
  const searchableTexts = [
    planMarkdown,
    ...assistantMessages.map((message) => message.text),
    ...userMessages.map((message) => message.text),
  ];

  const titledObjective =
    title.length > 0 && title !== defaultTitle ? clip(title, OBJECTIVE_MAX_CHARS) : null;
  const firstUser = userMessages[0]?.text ?? "";
  const lastAssistant = assistantMessages.at(-1)?.text ?? "";
  const lastUser = userMessages.at(-1)?.text ?? "";

  return {
    objective:
      titledObjective ??
      (firstUser.length > 0 ? firstParagraph(firstUser, OBJECTIVE_MAX_CHARS) : null),
    decisions: uniqueStrings(
      [
        ...extractPrefixedItems(planMarkdown, DECISION_LINE),
        ...assistantMessages.flatMap((message) =>
          extractPrefixedItems(message.text, DECISION_LINE),
        ),
      ],
      MAX_DECISIONS,
    ),
    status:
      lastAssistant.length > 0
        ? firstParagraph(lastAssistant, STATUS_MAX_CHARS)
        : fallbackStatus(input.reason),
    changedFiles: input.latestCheckpoint?.files ?? [],
    incomplete:
      extractPrefixedItems(planMarkdown, INCOMPLETE_LINE)[0] ??
      extractMarkdownSection(planMarkdown, ["incomplete", "todo", "remaining", "gaps"]) ??
      null,
    nextStep:
      extractPrefixedItems(planMarkdown, NEXT_LINE)[0] ??
      extractMarkdownSection(planMarkdown, ["next", "next step", "recommended next action"]) ??
      (lastUser.length > 0 && lastUser !== firstUser
        ? firstParagraph(lastUser, SECTION_MAX_CHARS)
        : null),
    checks: inferChecks(searchableTexts),
    checkpointTurnCount: input.latestCheckpoint?.checkpointTurnCount ?? null,
    checkpointRef: input.latestCheckpoint?.checkpointRef ?? null,
    reason: input.reason,
  };
}

export function formatCoreContextBlock(context: CoreContext): string {
  const lines: Array<string> = ["## Core context"];
  pushLabeled(lines, "Objective", context.objective);
  if (context.decisions.length > 0) {
    lines.push("Decisions:");
    for (const decision of context.decisions) {
      lines.push(`- ${decision}`);
    }
  }
  pushLabeled(lines, "Status", context.status);
  if (context.changedFiles.length > 0) {
    const files = context.changedFiles.slice(0, MAX_FORMATTED_FILES);
    lines.push(`Changed files: ${context.changedFiles.length}`);
    for (const file of files) {
      lines.push(`- ${file.path} (+${file.additions}/-${file.deletions})`);
    }
    if (context.changedFiles.length > files.length) {
      lines.push(`- …and ${context.changedFiles.length - files.length} more`);
    }
  }
  pushLabeled(lines, "Incomplete", context.incomplete);
  pushLabeled(lines, "Next", context.nextStep);
  pushLabeled(lines, "Checks", context.checks);
  if (context.checkpointTurnCount !== null) {
    const ref = context.checkpointRef ? ` (${context.checkpointRef})` : "";
    lines.push(`Checkpoint: #${context.checkpointTurnCount}${ref}`);
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

export function hasSubstantialCoreContext(context: CoreContext): boolean {
  return (
    context.decisions.length > 0 ||
    context.changedFiles.length > 0 ||
    context.incomplete !== null ||
    context.nextStep !== null ||
    context.checkpointTurnCount !== null
  );
}

export function hasActionableCoreContext(context: CoreContext): boolean {
  return (
    hasSubstantialCoreContext(context) || context.objective !== null || context.status !== null
  );
}

export function shouldCarryCoreContext(
  context: CoreContext,
  hasReplayableMessages: boolean,
): boolean {
  return hasReplayableMessages || hasSubstantialCoreContext(context);
}

export function hasReplayableCoreContextMessages(
  messages: ReadonlyArray<CoreContextMessage>,
  excludeTrailingText?: string,
): boolean {
  let relevant = messages.filter(
    (message) => (message.role === "user" || message.role === "assistant") && message.text.trim(),
  );
  const trailing = relevant.at(-1);
  if (
    trailing !== undefined &&
    excludeTrailingText !== undefined &&
    trailing.role === "user" &&
    trailing.text.trim() === excludeTrailingText.trim()
  ) {
    relevant = relevant.slice(0, -1);
  }
  return relevant.length > 0;
}

function selectActivePlan(
  plans: ReadonlyArray<CoreContextProposedPlan>,
): CoreContextProposedPlan | undefined {
  return plans.findLast((plan) => plan.implementedAt === null) ?? plans.at(-1);
}

function fallbackStatus(reason: CoreContextReason): string | null {
  switch (reason) {
    case "handoff":
      return "Handoff seam captured; continue from the latest checkpoint.";
    case "model-switch":
      return "Model switch seam captured; continue from the latest checkpoint.";
    case "plan":
      return "Plan updated; core context refreshed.";
    case "turn":
      return null;
  }
}

function inferChecks(texts: ReadonlyArray<string>): string {
  const blob = texts.join("\n").toLowerCase();
  if (/\b(all tests passed|tests? passed)\b/.test(blob)) {
    return "Passed";
  }
  if (/\b(tests? failed|failing tests?)\b/.test(blob)) {
    return "Failed";
  }
  return "Not run";
}

function extractPrefixedItems(text: string, pattern: RegExp): string[] {
  if (text.trim().length === 0) {
    return [];
  }
  const items: Array<string> = [];
  for (const rawLine of text.split("\n")) {
    const match = rawLine.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      items.push(collapseWhitespace(value));
    }
  }
  return items;
}

function extractMarkdownSection(markdown: string, names: ReadonlyArray<string>): string | null {
  if (markdown.trim().length === 0) {
    return null;
  }
  const heading = new RegExp(`^#{1,3}\\s+(?:${names.map(escapeRegExp).join("|")})\\s*$`, "i");
  const lines = markdown.split("\n");
  let collecting = false;
  const body: Array<string> = [];
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (collecting) {
        break;
      }
      collecting = heading.test(line);
      continue;
    }
    if (collecting) {
      body.push(line);
    }
  }
  const text = body.join("\n").trim();
  return text.length > 0 ? firstParagraph(text, SECTION_MAX_CHARS) : null;
}

function firstParagraph(text: string, maxChars: number): string {
  const paragraph = text.trim().split(/\n\s*\n/, 1)[0] ?? text.trim();
  return clip(collapseWhitespace(paragraph), maxChars);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function uniqueStrings(values: ReadonlyArray<string>, limit: number): string[] {
  const seen = new Set<string>();
  const unique: Array<string> = [];
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || seen.has(normalized.toLowerCase())) {
      continue;
    }
    seen.add(normalized.toLowerCase());
    unique.push(normalized);
    if (unique.length >= limit) {
      break;
    }
  }
  return unique;
}

function pushLabeled(lines: Array<string>, label: string, value: string | null): void {
  if (value) {
    lines.push(`${label}: ${value}`);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
