export type CodexMcpTransport = "stdio" | "http";

export interface CodexMcpServer {
  readonly name: string;
  readonly transport: CodexMcpTransport;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly url?: string;
  readonly oauth: boolean;
  readonly oauthClientId?: string;
  readonly enabled: boolean;
  readonly startupTimeoutSec?: number;
  readonly hasEnv: boolean;
}

export type CodexMcpServerInput =
  | {
      readonly name: string;
      readonly transport?: "stdio";
      readonly command: string;
      readonly args: readonly string[];
      readonly cwd?: string;
      readonly enabled: boolean;
    }
  | {
      readonly name: string;
      readonly transport: "http";
      readonly url: string;
      readonly oauth?: boolean;
      readonly oauthClientId?: string;
      readonly enabled: boolean;
    };

type Section = { name: string; kind: string; start: number; end: number };

function decodeTomlString(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return undefined;
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return undefined;
}

function encodeTomlString(value: string): string {
  return JSON.stringify(value);
}

function sectionHeader(line: string): { name: string; kind: string } | undefined {
  const match = line
    .trim()
    .match(
      /^\[\s*mcp_servers\.(?:"((?:\\.|[^"])*)"|'([^']*)'|([A-Za-z0-9_-]+))(?:\.([^\]]+))?\s*\]$/,
    );
  if (!match) return undefined;
  let name = match[1] ?? match[2] ?? match[3] ?? "";
  if (match[1] !== undefined) {
    try {
      name = JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return undefined;
    }
  }
  return {
    name,
    kind: match[4]?.trim() ?? "main",
  };
}

function sections(lines: readonly string[]): Section[] {
  const found: Section[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = sectionHeader(lines[index] ?? "");
    if (!header) continue;
    let end = index + 1;
    while (end < lines.length && !lines[end]?.trim().startsWith("[")) end += 1;
    found.push({ ...header, start: index, end });
  }
  return found;
}

function withoutTomlComment(value: string): string {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "#") {
      return value.slice(0, index).trim();
    }
  }
  return value.trim();
}

function assignment(lines: readonly string[], section: Section, key: string): string | undefined {
  for (let index = section.start + 1; index < section.end; index += 1) {
    const match = lines[index]?.trim().match(new RegExp(`^${key}\\s*=\\s*(.+)$`));
    if (match?.[1]) return withoutTomlComment(match[1]);
  }
  return undefined;
}

function parseStringArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export function parseCodexMcpServers(content: string): CodexMcpServer[] {
  const lines = content.split(/\r?\n/);
  const allSections = sections(lines);
  const envNames = new Set(
    allSections.filter((item) => item.kind === "env").map((item) => item.name),
  );
  const oauthSectionsByName = new Map(
    allSections.filter((item) => item.kind === "oauth").map((item) => [item.name, item]),
  );
  return allSections
    .filter((item) => item.kind === "main")
    .map((item) => {
      const command = decodeTomlString(assignment(lines, item, "command") ?? "") ?? "";
      const url = decodeTomlString(assignment(lines, item, "url") ?? "");
      const cwd = decodeTomlString(assignment(lines, item, "cwd") ?? "");
      const enabledValue = assignment(lines, item, "enabled");
      const authValue = decodeTomlString(assignment(lines, item, "auth") ?? "") ?? "";
      const oauthSection = oauthSectionsByName.get(item.name);
      const oauthClientId = oauthSection
        ? decodeTomlString(assignment(lines, oauthSection, "client_id") ?? "")
        : undefined;
      const timeout = Number(assignment(lines, item, "startup_timeout_sec"));
      const transport: CodexMcpTransport = url ? "http" : "stdio";
      const base = {
        name: item.name,
        transport,
        command,
        args: parseStringArray(assignment(lines, item, "args")),
        oauth: transport === "http" ? authValue !== "none" : false,
        enabled: enabledValue === undefined ? true : enabledValue.trim() !== "false",
        hasEnv: envNames.has(item.name),
      };
      const withOptionalConnection = Object.assign(base, cwd ? { cwd } : {}, url ? { url } : {});
      return Object.assign(
        withOptionalConnection,
        oauthClientId ? { oauthClientId } : {},
        Number.isFinite(timeout) && timeout >= 0 ? { startupTimeoutSec: timeout } : {},
      );
    });
}

export function setCodexMcpServerEnabled(content: string, name: string, enabled: boolean): string {
  const lines = content.split(/\r?\n/);
  const target = sections(lines).find((item) => item.kind === "main" && item.name === name);
  if (!target) throw new Error(`Unknown MCP server: ${name}`);
  for (let index = target.start + 1; index < target.end; index += 1) {
    if (/^\s*enabled\s*=/.test(lines[index] ?? "")) {
      lines[index] = `enabled = ${enabled}`;
      return lines.join("\n");
    }
  }
  let insertAt = target.end;
  while (insertAt > target.start + 1 && !(lines[insertAt - 1] ?? "").trim()) {
    insertAt -= 1;
  }
  lines.splice(insertAt, 0, `enabled = ${enabled}`);
  return lines.join("\n");
}

function updateSectionKeys(
  lines: string[],
  section: Section,
  values: Readonly<Record<string, string>>,
): void {
  const remaining = new Map(Object.entries(values));
  for (let index = section.start + 1; index < section.end; index += 1) {
    const key = lines[index]?.trim().match(/^([A-Za-z0-9_]+)\s*=/)?.[1];
    if (key && remaining.has(key)) {
      lines[index] = `${key} = ${remaining.get(key)}`;
      remaining.delete(key);
    }
  }
  lines.splice(section.end, 0, ...Array.from(remaining, ([key, value]) => `${key} = ${value}`));
}

export function upsertCodexMcpServer(content: string, input: CodexMcpServerInput): string {
  const lines = content.split(/\r?\n/);
  const existing = sections(lines).find((item) => item.name === input.name && item.kind === "main");
  const previousUrl = existing
    ? decodeTomlString(assignment(lines, existing, "url") ?? "")
    : undefined;
  if (input.transport === "http" && existing && previousUrl === input.url) {
    // Updating an existing connection must not erase its credentials, header
    // helpers, OAuth callback, scopes, or tool policy. These fields are owned
    // by Codex/the user, not by the connection editor.
    updateSectionKeys(lines, existing, {
      enabled: String(input.enabled),
      ...(input.oauth === false ? { auth: encodeTomlString("none") } : {}),
    });
    const oauth = sections(lines).find((item) => item.name === input.name && item.kind === "oauth");
    if (input.oauth === false && oauth) {
      lines.splice(oauth.start, oauth.end - oauth.start);
    } else if (input.oauthClientId !== undefined) {
      if (oauth)
        updateSectionKeys(lines, oauth, { client_id: encodeTomlString(input.oauthClientId) });
      else
        lines.push(
          "",
          `[mcp_servers.${encodeTomlString(input.name)}.oauth]`,
          `client_id = ${encodeTomlString(input.oauthClientId)}`,
        );
    }
    return lines.join("\n");
  }
  // A different HTTP endpoint is a different connection. Never carry its old
  // headers or OAuth configuration to the new destination.
  const targets = sections(lines).filter(
    (item) => item.name === input.name && (previousUrl !== undefined || item.kind !== "env"),
  );
  const block =
    input.transport === "http"
      ? [
          `[mcp_servers.${encodeTomlString(input.name)}]`,
          `url = ${encodeTomlString(input.url)}`,
          ...(input.oauth === false ? [`auth = ${encodeTomlString("none")}`] : []),
          `enabled = ${input.enabled}`,
          ...(input.oauth !== false && input.oauthClientId
            ? [
                "",
                `[mcp_servers.${encodeTomlString(input.name)}.oauth]`,
                `client_id = ${encodeTomlString(input.oauthClientId)}`,
              ]
            : []),
        ]
      : [
          `[mcp_servers.${encodeTomlString(input.name)}]`,
          `command = ${encodeTomlString(input.command)}`,
          `args = ${JSON.stringify([...input.args])}`,
          ...(input.cwd ? [`cwd = ${encodeTomlString(input.cwd)}`] : []),
          `enabled = ${input.enabled}`,
        ];
  if (targets.length > 0) {
    const insertAt = Math.min(...targets.map((target) => target.start));
    for (const target of targets.toSorted((left, right) => right.start - left.start)) {
      lines.splice(target.start, target.end - target.start);
    }
    lines.splice(insertAt, 0, ...block);
  } else {
    if (lines.some((line) => line.trim().length > 0) && lines.at(-1)?.trim()) lines.push("");
    lines.push(...block);
  }
  return lines.join("\n");
}

export function removeCodexMcpServer(content: string, name: string): string {
  const lines = content.split(/\r?\n/);
  const targets = sections(lines)
    .filter((item) => item.name === name)
    .toSorted((left, right) => right.start - left.start);
  for (const target of targets) lines.splice(target.start, target.end - target.start);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
