import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  parseCodexMcpServers,
  removeCodexMcpServer,
  setCodexMcpServerEnabled,
  upsertCodexMcpServer,
  type CodexMcpServerInput,
} from "@modesto/shared/codexMcpConfig";
import { resolveCodexHome } from "@modesto/shared/codexConfig";
import type { HookSetInput } from "@modesto/contracts";

async function readOptional(path: string): Promise<string> {
  try { return await readFile(path, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

export async function listMcpServers() {
  const configPath = join(resolveCodexHome(), "config.toml");
  return { configPath, servers: parseCodexMcpServers(await readOptional(configPath)) };
}

async function changeMcp(transform: (content: string) => string) {
  const configPath = join(resolveCodexHome(), "config.toml");
  await atomicWrite(configPath, transform(await readOptional(configPath)));
  return listMcpServers();
}

export const setMcpEnabled = (name: string, enabled: boolean) =>
  changeMcp((content) => setCodexMcpServerEnabled(content, name, enabled));
export const upsertMcp = (input: CodexMcpServerInput) =>
  changeMcp((content) => upsertCodexMcpServer(content, input));
export const removeMcp = (name: string) =>
  changeMcp((content) => removeCodexMcpServer(content, name));

type HookFile = { hooks?: Record<string, Array<{ hooks?: Array<{ type?: string; command?: string }> }>> };
const KNOWN_HOOKS = ["UserPromptSubmit", "Stop"] as const;

export async function listHooks() {
  const configPath = join(resolveCodexHome(), "hooks.json");
  const raw = await readOptional(configPath);
  let parsed: HookFile = {};
  if (raw) parsed = JSON.parse(raw) as HookFile;
  return {
    configPath,
    exists: raw.length > 0,
    events: KNOWN_HOOKS.map((eventName) => ({
      eventName,
      hooks: (parsed.hooks?.[eventName] ?? [])
        .flatMap((group) => group.hooks ?? [])
        .filter((hook): hook is { type: "command"; command: string } =>
          hook.type === "command" && typeof hook.command === "string" && hook.command.length > 0)
        .map((hook) => ({ type: "command" as const, command: hook.command })),
    })),
  };
}

export async function setHook(input: HookSetInput) {
  const configPath = join(resolveCodexHome(), "hooks.json");
  const raw = await readOptional(configPath);
  const parsed: HookFile = raw ? JSON.parse(raw) as HookFile : {};
  parsed.hooks ??= {};
  if (input.enabled && input.command) {
    parsed.hooks[input.eventName] = [{ hooks: [{ type: "command", command: input.command }] }];
  } else {
    delete parsed.hooks[input.eventName];
  }
  await atomicWrite(configPath, `${JSON.stringify(parsed, null, 2)}\n`);
  return listHooks();
}

export async function listAgentRules() {
  const rulesDir = join(resolveCodexHome(), "rules");
  let names: string[] = [];
  try { names = await readdir(rulesDir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const rules = await Promise.all(names.map(async (name) => {
    const path = join(rulesDir, name);
    const info = await stat(path);
    if (!info.isFile()) return null;
    const text = await readFile(path, "utf8");
    return { path, size: info.size, mtime: info.mtime.toISOString(), lineCount: text === "" ? 0 : text.split(/\r?\n/).length };
  }));
  return { rules: rules.filter((rule) => rule !== null) };
}
