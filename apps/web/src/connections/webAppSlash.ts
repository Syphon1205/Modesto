import { WEB_APPS, webAppMentionLabel, type WebApp } from "./webApps";

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

export type ParsedWebAppComposerCommand = {
  readonly app: WebApp;
  readonly task: string | null;
};

export function webAppSlashTokens(app: WebApp): readonly string[] {
  const tokens = new Set<string>();
  tokens.add(app.id);
  tokens.add(app.name);
  for (const alias of app.mentionAliases) tokens.add(alias);
  const lastIdPart = app.id.includes("-") ? app.id.slice(app.id.lastIndexOf("-") + 1) : null;
  if (lastIdPart && lastIdPart.length > 2) tokens.add(lastIdPart);
  return [...tokens];
}

/** Slash menu still names the `@` mention so apps stay in that category. */
export function webAppSlashLabel(app: WebApp): string {
  return webAppMentionLabel(app);
}

export function resolveWebAppSlashName(query: string): WebApp | undefined {
  const normalized = query.trim().replace(/^\/+/, "").toLowerCase();
  if (normalized.length === 0 || BUILTIN_SLASH.has(normalized)) return undefined;
  return WEB_APPS.find((app) =>
    webAppSlashTokens(app).some((token) => token.toLowerCase() === normalized),
  );
}

export function parseWebAppComposerCommand(text: string): ParsedWebAppComposerCommand | null {
  const match = /^\/([a-z0-9][\w-]*)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return null;
  const app = resolveWebAppSlashName(match[1] ?? "");
  if (!app) return null;
  const task = match[2]?.trim() ?? "";
  return { app, task: task.length > 0 ? task : null };
}

export function defaultWebAppTask(app: WebApp): string {
  if (app.category === "email") {
    return "Check the inbox for anything that needs a reply, draft follow-ups, and note reminders.";
  }
  if (app.id === "google-tasks") {
    return "Show open reminders and add anything the conversation implies is due.";
  }
  if (app.category === "chat") {
    return "Check recent messages and mentions, and help draft a reply if something is waiting.";
  }
  if (app.category === "calendar") {
    return "Check today's calendar and upcoming reminders.";
  }
  if (app.category === "crm") {
    return `Pull the latest ${app.name} records that match this request, and summarize what needs attention.`;
  }
  if (app.category === "storage") {
    return `Find the relevant files in ${app.name} and open them.`;
  }
  return `Help with ${app.name}: ${app.capabilityHint}.`;
}

export function resolveWebAppSendPrompt(app: WebApp, task: string | null): string {
  const mention = webAppMentionLabel(app);
  return `Work inside ${app.name} in the browser beside this thread (${mention}). You can ${app.capabilityHint}.

User request:
${task ?? defaultWebAppTask(app)}`;
}

export function isWebAppBuildPrompt(text: string): boolean {
  return text.includes("Work inside ") && text.includes(" in the browser beside this thread");
}
