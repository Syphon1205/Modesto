import {
  collectNativeAppsFromPrompt,
  nativeAppMentionLabel,
  nativeAppTokens,
  normalizeNativeAppToken,
  resolveNativeAppMention,
  type NativeApp,
} from "./nativeApps.ts";

const BUILTIN_SLASH = new Set([
  "model",
  "plan",
  "default",
  "spawn",
  "side",
  "multiagent",
  "canvas",
  "slides",
  "docs",
  "spreadsheets",
  "sheets",
  "sheet",
  "doc",
]);

export type ParsedNativeAppComposerCommand = {
  readonly app: NativeApp;
  readonly task: string | null;
};

export function nativeAppSlashTokens(app: NativeApp): readonly string[] {
  return nativeAppTokens(app);
}

export function resolveNativeAppSlashName(query: string): NativeApp | undefined {
  const normalized = query.trim().replace(/^\/+/, "").toLowerCase();
  if (normalized.length === 0 || BUILTIN_SLASH.has(normalized)) return undefined;
  return resolveNativeAppMention(normalized);
}

export function parseNativeAppComposerCommand(text: string): ParsedNativeAppComposerCommand | null {
  const match = /^\/([a-z0-9][\w-]*)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return null;
  const app = resolveNativeAppSlashName(match[1] ?? "");
  if (!app) return null;
  const task = match[2]?.trim() ?? "";
  return { app, task: task.length > 0 ? task : null };
}

export function defaultNativeAppTask(app: NativeApp): string {
  return `Help with the open ${app.name} document.`;
}

export function resolveNativeAppSendPrompt(app: NativeApp, task: string | null): string {
  const mention = nativeAppMentionLabel(app);
  return `Work in ${app.name} on this Mac (${mention}). You can ${app.capabilityHint}.

User request:
${task ?? defaultNativeAppTask(app)}`;
}

const OPEN_PHRASE_PREFIX =
  /^(?:please\s+)?(?:can\s+you\s+)?(?:open|launch|start|switch\s+to|bring\s+up|go\s+to|pull\s+up)\s+/iu;

function longestMatchingApp(text: string): NativeApp | undefined {
  const normalized = normalizeNativeAppToken(text);
  if (normalized.length === 0) return undefined;

  let best: { app: NativeApp; length: number } | undefined;
  for (const app of [
    ...new Set(
      // Prefer longer names so "after effects" wins over a stray "ae" prefix.
      // Resolution is exact on the remaining text, not a prefix scan.
      [resolveNativeAppMention(text)].filter((value): value is NativeApp => value !== undefined),
    ),
  ]) {
    const length = normalizeNativeAppToken(app.name).length;
    if (!best || length > best.length) best = { app, length };
  }
  return best?.app ?? resolveNativeAppMention(text);
}

function appFromLeadingName(text: string): NativeApp | undefined {
  const trimmed = text
    .trim()
    .replace(/^[,\-:]+/u, "")
    .trim();
  if (trimmed.length === 0) return undefined;

  const withoutPlease = trimmed
    .replace(/\s+please[.!?]*$/iu, "")
    .replace(/[.!?]+$/u, "")
    .trim();
  const exact = longestMatchingApp(withoutPlease);
  if (exact) return exact;

  // "Open After Effects and move the hand" — take the longest token prefix
  // that resolves, so "After Effects and …" still finds After Effects.
  const words = withoutPlease.split(/\s+/u);
  for (let count = Math.min(words.length, 4); count >= 1; count -= 1) {
    const candidate = words.slice(0, count).join(" ");
    const app = resolveNativeAppMention(candidate);
    if (app) return app;
  }
  return undefined;
}

function standaloneAppName(text: string): NativeApp | undefined {
  const trimmed = text.trim();
  if (trimmed.includes("\n")) return undefined;
  if (/^(?:open|launch|start|switch\s+to|bring\s+up|go\s+to|pull\s+up)\b/iu.test(trimmed)) {
    return undefined;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("@")) return undefined;
  return appFromLeadingName(trimmed);
}

/**
 * Apps the user asked to open — not every time the name appears in prose.
 *
 * Opens on: an `@photoshop` chip, `/after-effects`, "Open Photoshop",
 * or a message that is just the app name. Does not open on "the after
 * effects of this change" or "like in Photoshop, use layers".
 */
export function detectNativeAppsToOpen(prompt: string): readonly NativeApp[] {
  const seen = new Set<string>();
  const apps: NativeApp[] = [];
  const add = (app: NativeApp | undefined) => {
    if (!app || seen.has(app.id)) return;
    seen.add(app.id);
    apps.push(app);
  };

  add(parseNativeAppComposerCommand(prompt)?.app);
  for (const app of collectNativeAppsFromPrompt(prompt)) add(app);

  const trimmed = prompt.trim();
  const openPrefix = OPEN_PHRASE_PREFIX.exec(trimmed);
  if (openPrefix) {
    add(appFromLeadingName(trimmed.slice(openPrefix[0].length)));
  } else {
    const standalone = standaloneAppName(trimmed);
    if (
      standalone &&
      normalizeNativeAppToken(trimmed.replace(/\s+please[.!?]*$/iu, "").replace(/[.!?]+$/u, "")) ===
        normalizeNativeAppToken(standalone.name)
    ) {
      add(standalone);
    } else if (
      standalone &&
      nativeAppTokens(standalone).some(
        (token) => normalizeNativeAppToken(token) === normalizeNativeAppToken(trimmed),
      )
    ) {
      add(standalone);
    }
  }

  return apps;
}

export type CodingTaskIntent = {
  readonly task: string;
};

const CODING_TASK_LEADING_NOISE =
  /^(?:(?:please|hey|hi|ok(?:ay)?|so)[,.]?\s+)*(?:(?:can|could|would|will)\s+you\s+)?(?:(?:i\s+(?:want|need)\s+(?:you\s+)?to\s+)|(?:let(?:u)?s|let's)\s+)?/iu;

const CODING_TASK_NEGATIVE =
  /\b(?:don'?t|do not|never|without)\s+(?:(?:please|even)\s+)?(?:start|create|make|kick\s+off|spin\s+up)\b/iu;

const CODING_TASK_QUESTION = /^(?:what|which|how|why|should(?:\s+i)?|do you think|would it)\b/iu;

const CODING_TASK_START_CONTAINER =
  /^(?:start|create|make|spin\s+up|kick\s+off|begin|open|launch)\s+(?:a\s+|an\s+|the\s+)?(?:new\s+)?(?:(code|coding|project|repo|repository|app)\s+)?(project|task|thread|repo|repository|app)\b/iu;

const CODING_TASK_START_WORKING =
  /^(?:start\s+working\s+on|work\s+on)\s+(?:a\s+|an\s+|the\s+)?(?:new\s+)?(?:code\s+|coding\s+)?(?:project|task|feature|app|thread)\b/iu;

const CODING_TASK_NOUNS = new Set(["project", "thread", "repo", "repository", "app"]);

const CODING_TASK_SIGNAL =
  /\b(?:code|coding|implement|refactor|repo|repository|typescript|javascript|python|golang|rust|bug|feature|component|endpoint|pull request|unit test|typeerror|git|commit|worktree|function|module|package|frontend|backend|auth|login|write (?:the )?code|fix the)\b/iu;

/**
 * True when the user is asking to start a project or coding task — not when
 * they mention a task/project in passing, ask a question about one, or want
 * an explanation.
 */
export function detectCodingTaskIntent(prompt: string): CodingTaskIntent | null {
  const task = prompt.replace(/\s+/g, " ").trim();
  if (task.length < 8) return null;
  if (task.startsWith("/")) return null;
  if (CODING_TASK_NEGATIVE.test(task)) return null;

  const stripped = task.replace(CODING_TASK_LEADING_NOISE, "").trim();
  if (stripped.length === 0) return null;
  if (CODING_TASK_QUESTION.test(stripped)) return null;

  if (CODING_TASK_START_WORKING.test(stripped)) {
    return { task };
  }

  const match = CODING_TASK_START_CONTAINER.exec(stripped);
  if (!match) return null;

  const qualifier = (match[1] ?? "").toLowerCase();
  const noun = (match[2] ?? "").toLowerCase();
  const codingQualified =
    qualifier === "code" ||
    qualifier === "coding" ||
    qualifier === "repo" ||
    qualifier === "repository";
  if (codingQualified || CODING_TASK_NOUNS.has(noun) || CODING_TASK_SIGNAL.test(stripped)) {
    return { task };
  }
  return null;
}
