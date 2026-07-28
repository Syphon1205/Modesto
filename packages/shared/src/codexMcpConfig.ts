export interface CodexMcpServer {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly enabled: boolean;
  readonly startupTimeoutSec?: number;
  readonly hasEnv: boolean;
}

export interface CodexMcpServerInput {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly enabled: boolean;
}

type Section = { name: string; kind: "main" | "env"; start: number; end: number };

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

function sectionHeader(line: string): { name: string; kind: "main" | "env" } | undefined {
  const match = line.trim().match(
    /^\[\s*mcp_servers\.(?:"((?:\\.|[^"])*)"|'([^']*)'|([A-Za-z0-9_-]+))(\.env)?\s*\]$/,
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
  return { name, kind: match[4] ? "env" : "main" };
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

function assignment(lines: readonly string[], section: Section, key: string): string | undefined {
  for (let index = section.start + 1; index < section.end; index += 1) {
    const match = lines[index]?.trim().match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*(?:#.*)?$`));
    if (match) return match[1];
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
  const envNames = new Set(allSections.filter((item) => item.kind === "env").map((item) => item.name));
  return allSections
    .filter((item) => item.kind === "main")
    .map((item) => {
      const command = decodeTomlString(assignment(lines, item, "command") ?? "") ?? "";
      const cwd = decodeTomlString(assignment(lines, item, "cwd") ?? "");
      const enabledValue = assignment(lines, item, "enabled");
      const timeout = Number(assignment(lines, item, "startup_timeout_sec"));
      return {
        name: item.name,
        command,
        args: parseStringArray(assignment(lines, item, "args")),
        ...(cwd ? { cwd } : {}),
        enabled: enabledValue === undefined ? true : enabledValue.trim() !== "false",
        ...(Number.isFinite(timeout) && timeout >= 0 ? { startupTimeoutSec: timeout } : {}),
        hasEnv: envNames.has(item.name),
      };
    });
}

export function setCodexMcpServerEnabled(
  content: string,
  name: string,
  enabled: boolean,
): string {
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

export function upsertCodexMcpServer(content: string, input: CodexMcpServerInput): string {
  const lines = content.split(/\r?\n/);
  const target = sections(lines).find((item) => item.kind === "main" && item.name === input.name);
  const block = [
    `[mcp_servers.${encodeTomlString(input.name)}]`,
    `command = ${encodeTomlString(input.command)}`,
    `args = ${JSON.stringify([...input.args])}`,
    ...(input.cwd ? [`cwd = ${encodeTomlString(input.cwd)}`] : []),
    `enabled = ${input.enabled}`,
  ];
  if (target) {
    lines.splice(target.start, target.end - target.start, ...block);
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
    .sort((left, right) => right.start - left.start);
  for (const target of targets) lines.splice(target.start, target.end - target.start);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
