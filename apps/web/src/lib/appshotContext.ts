import { type ThreadId } from "@modesto/contracts";

const APSHOT_ACCESSIBILITY_TEXT_LIMIT = 80_000;
const APSHOT_LABEL_MAX = 48;

const TRAILING_APPSHOT_CONTEXT_BLOCK_PATTERN =
  /\n*<appshot_context>\n([\s\S]*?)\n<\/appshot_context>\s*$/;

export interface AppshotContextSelection {
  appName: string;
  windowTitle: string;
  accessibilityText: string;
  capturedAt: string;
}

export interface AppshotContextDraft extends AppshotContextSelection {
  id: string;
  threadId: ThreadId;
}

export interface ParsedAppshotContextEntry {
  header: string;
  body: string;
}

function truncateString(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
}

export function normalizeAppshotContextSelection(
  raw: AppshotContextSelection,
): AppshotContextSelection | null {
  const appName = raw.appName.trim();
  if (appName.length === 0) return null;
  return {
    appName,
    windowTitle: raw.windowTitle.trim(),
    accessibilityText: truncateString(
      normalizeText(raw.accessibilityText).trim(),
      APSHOT_ACCESSIBILITY_TEXT_LIMIT,
    ),
    capturedAt: raw.capturedAt.trim() || new Date().toISOString(),
  };
}

const APSHOT_CONTEXT_ID_PREFIX = "appshot_";
let nextAppshotContextSequence = 0;

export function newAppshotContextId(): string {
  nextAppshotContextSequence += 1;
  return `${APSHOT_CONTEXT_ID_PREFIX}${nextAppshotContextSequence.toString(36)}`;
}

export function formatAppshotContextLabel(context: AppshotContextSelection): string {
  const title = context.windowTitle.trim();
  const base = title.length > 0 ? `${context.appName} — ${title}` : context.appName;
  if (base.length <= APSHOT_LABEL_MAX) return base;
  return `${base.slice(0, APSHOT_LABEL_MAX - 1)}…`;
}

function indentLines(text: string): string[] {
  return text.split("\n").map((line) => `    ${line}`);
}

function buildSingleAppshotLines(context: AppshotContextSelection): string[] {
  const lines: string[] = [
    `app: ${context.appName}`,
    `window: ${context.windowTitle || "(untitled)"}`,
    `captured_at: ${context.capturedAt}`,
  ];
  const accessibility = context.accessibilityText.trim();
  if (accessibility.length > 0) {
    lines.push("accessibility_text:");
    lines.push(...indentLines(accessibility));
  }
  return lines;
}

export function buildAppshotContextBlock(contexts: ReadonlyArray<AppshotContextSelection>): string {
  if (contexts.length === 0) return "";
  const lines: string[] = [];
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index]!;
    lines.push(...buildSingleAppshotLines(context));
    if (index < contexts.length - 1) lines.push("");
  }
  return ["<appshot_context>", ...lines, "</appshot_context>"].join("\n");
}

export function appendAppshotContextsToPrompt(
  prompt: string,
  contexts: ReadonlyArray<AppshotContextSelection>,
): string {
  const block = buildAppshotContextBlock(contexts);
  if (block.length === 0) return prompt;
  const trimmed = prompt.trim();
  return trimmed.length > 0 ? `${trimmed}\n\n${block}` : block;
}

export function extractTrailingAppshotContexts(prompt: string): {
  promptText: string;
  contexts: ParsedAppshotContextEntry[];
} {
  const match = prompt.match(TRAILING_APPSHOT_CONTEXT_BLOCK_PATTERN);
  if (!match) {
    return { promptText: prompt, contexts: [] };
  }
  const body = match[1] ?? "";
  const promptText = prompt.slice(0, match.index ?? prompt.length).replace(/\s+$/, "");
  const sections = body
    .split(/\n(?=app: )/g)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);
  const contexts: ParsedAppshotContextEntry[] = sections.map((section) => {
    const firstLine = section.split("\n")[0] ?? "Appshot";
    return { header: firstLine, body: section };
  });
  return { promptText, contexts };
}
