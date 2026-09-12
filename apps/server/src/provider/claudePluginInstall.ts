// FILE: claudePluginInstall.ts
// Purpose: Installs a resolved Claude plugin bundle (claudePluginBundle.ts)
//          onto disk (the real ~/.claude the Claude Agent SDK's "user"
//          setting source reads from - see Drivers/ClaudeHome.ts /
//          Drivers/ClaudeSkills.ts) and tracks installed plugins for
//          listing/uninstall. Rebuilt natively for this tree's Effect-TS
//          FileSystem/Path services rather than porting the primary tree's
//          raw node:fs/promises version - same install-path/namespacing
//          shape, same atomic-write-then-rename registry persistence this
//          tree already uses elsewhere (see ServerSecretStore.ts).
//
// v1 scope, deliberately: installs into the DEFAULT Claude instance's home
// (NodeOS.homedir()/.claude), not a caller-chosen instance's homePath
// override - supporting per-instance install targets is real added
// complexity this first version skips.
//
// MCP servers a plugin declares ARE installed now, into the user-scope
// `mcpServers` map in Claude's own `.claude.json` (see claudeMcpServers.ts).
// Their names are recorded on the installed-plugin record so uninstall can
// take them back out - a plugin that leaves servers behind after removal is
// worse than one that never installed them.
// Layer: Server provider helper

import * as NodeOS from "node:os";

import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import type { ClaudePluginBundle, ClaudePluginFile } from "./claudePluginBundle.ts";
import { installClaudeMcpServers, removeClaudeMcpServers } from "./claudeMcpServers.ts";

export class ClaudePluginInstallError extends Data.TaggedError("ClaudePluginInstallError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface InstalledClaudePluginFile {
  readonly type: "skill" | "command" | "agent";
  readonly path: string;
}

export interface InstalledClaudePlugin {
  readonly pluginId: string;
  readonly name: string;
  readonly description: string | null;
  readonly namespace: string;
  readonly source: {
    readonly owner: string;
    readonly repo: string;
    readonly ref: string;
    readonly dir: string | null;
  };
  readonly files: readonly InstalledClaudePluginFile[];
  /**
   * User-scope MCP server names this install added to Claude's config.
   * Recorded so uninstall removes exactly what was added and nothing else -
   * a name the user configured themselves must survive removing the plugin.
   */
  readonly mcpServers: readonly string[];
  readonly warnings: readonly string[];
  readonly installedAt: string;
}

interface ClaudePluginRegistry {
  plugins: Record<string, InstalledClaudePlugin>;
}

const SLUG_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function slugify(title: string, fallback = "plugin"): string {
  let base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) base = fallback;
  if (base.length > 64) base = base.slice(0, 64).replace(/-+$/g, "");
  if (!SLUG_NAME_RE.test(base)) base = fallback;
  return base;
}

function pluginNamespace(pluginName: string, pluginId: string): string {
  const base = slugify(pluginName, slugify(pluginId, "plugin"));
  return `${base.replace(/-plugin$/, "")}-plugin`;
}

const FILE_TYPE_DIR: Record<ClaudePluginFile["type"], string> = {
  skill: "skills",
  command: "commands",
  agent: "agents",
};

function installPathFor(
  path: Path.Path,
  claudeDir: string,
  namespace: string,
  file: ClaudePluginFile,
): string {
  const slug = `${namespace}-${slugify(file.title, "item")}`;
  if (file.type === "skill") {
    return path.join(claudeDir, "skills", slug, "SKILL.md");
  }
  return path.join(claudeDir, FILE_TYPE_DIR[file.type], `${slug}.md`);
}

/** The real ~/.claude directory - v1 always targets the default Claude instance's home, see the module header. */
function defaultClaudeDir(path: Path.Path): string {
  return path.join(NodeOS.homedir(), ".claude");
}

function registryPath(path: Path.Path, baseDir: string): string {
  return path.join(baseDir, "claude-plugins.json");
}

const readRegistry = Effect.fn("readClaudePluginRegistry")(function* (baseDir: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const raw = yield* fileSystem
    .readFileString(registryPath(path, baseDir))
    .pipe(Effect.orElseSucceed((): string | undefined => undefined));
  if (raw === undefined) {
    return { plugins: {} } as ClaudePluginRegistry;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "plugins" in parsed) {
      return parsed as ClaudePluginRegistry;
    }
  } catch {
    // Corrupt registry file - start fresh rather than blocking every future install/list.
  }
  return { plugins: {} };
});

const writeRegistry = Effect.fn("writeClaudePluginRegistry")(function* (
  baseDir: string,
  registry: ClaudePluginRegistry,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = registryPath(path, baseDir);
  yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
  const tempPath = `${target}.${process.pid}.${Date.now()}.tmp`;
  yield* fileSystem.writeFileString(tempPath, `${JSON.stringify(registry, null, 2)}\n`);
  yield* fileSystem.rename(tempPath, target);
});

const removeInstalledFiles = Effect.fn("removeInstalledClaudePluginFiles")(function* (
  plugin: InstalledClaudePlugin,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const file of plugin.files) {
    const target = file.type === "skill" ? path.dirname(file.path) : file.path;
    yield* fileSystem.remove(target, { recursive: true, force: true }).pipe(Effect.ignore);
  }
});

export interface InstallClaudePluginInput {
  readonly bundle: ClaudePluginBundle;
  readonly baseDir: string;
  /** Overrides the real ~/.claude target - tests only, never set by RPC call sites. */
  readonly claudeDirOverride?: string;
}

export const installClaudePlugin = Effect.fn("installClaudePlugin")(function* (
  input: InstallClaudePluginInput,
): Effect.fn.Return<
  InstalledClaudePlugin,
  ClaudePluginInstallError,
  FileSystem.FileSystem | Path.Path
> {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { bundle, baseDir } = input;
  const namespace = pluginNamespace(bundle.preview.name, bundle.preview.pluginId);
  const claudeDir = input.claudeDirOverride ?? defaultClaudeDir(path);

  const registry = yield* readRegistry(baseDir);
  const existing = registry.plugins[bundle.preview.pluginId];
  if (existing) {
    yield* removeInstalledFiles(existing);
    // Re-installing converges on what the plugin declares now: servers it
    // used to declare and no longer does would otherwise linger forever.
    yield* removeClaudeMcpServers({
      claudeDir,
      names: existing.mcpServers ?? [],
    }).pipe(Effect.ignore);
  }

  const files: InstalledClaudePluginFile[] = [];
  yield* Effect.gen(function* () {
    for (const file of bundle.files) {
      const targetPath = installPathFor(path, claudeDir, namespace, file);
      yield* fileSystem.makeDirectory(path.dirname(targetPath), { recursive: true });
      yield* fileSystem.writeFileString(targetPath, file.content);
      files.push({ type: file.type, path: targetPath });
    }
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ClaudePluginInstallError({
          message: `Failed to write plugin files for '${bundle.preview.name}'.`,
          cause,
        }),
    ),
  );

  const mcpServerNames = yield* installClaudeMcpServers({
    claudeDir,
    servers: Object.entries(bundle.mcpServers).map(([name, config]) => ({
      name,
      config: config as Readonly<Record<string, unknown>>,
    })),
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ClaudePluginInstallError({
          message: `Installed '${bundle.preview.name}' files but failed to register its MCP servers.`,
          cause,
        }),
    ),
  );

  const installed: InstalledClaudePlugin = {
    pluginId: bundle.preview.pluginId,
    name: bundle.preview.name,
    description: bundle.preview.description,
    namespace,
    source: bundle.preview.source,
    files,
    mcpServers: mcpServerNames,
    warnings: bundle.preview.warnings,
    installedAt: new Date().toISOString(),
  };

  registry.plugins[bundle.preview.pluginId] = installed;
  yield* writeRegistry(baseDir, registry).pipe(
    Effect.mapError(
      (cause) =>
        new ClaudePluginInstallError({
          message: `Installed '${bundle.preview.name}' but failed to update the plugin registry.`,
          cause,
        }),
    ),
  );
  return installed;
});

export const listInstalledClaudePlugins = Effect.fn("listInstalledClaudePlugins")(function* (
  baseDir: string,
): Effect.fn.Return<
  ReadonlyArray<InstalledClaudePlugin>,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const registry = yield* readRegistry(baseDir);
  return Object.values(registry.plugins).toSorted((a, b) => a.name.localeCompare(b.name));
});

export const uninstallClaudePlugin = Effect.fn("uninstallClaudePlugin")(function* (input: {
  readonly pluginId: string;
  readonly baseDir: string;
  /** Overrides the real ~/.claude target - tests only, never set by RPC call sites. */
  readonly claudeDirOverride?: string;
}): Effect.fn.Return<void, ClaudePluginInstallError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const registry = yield* readRegistry(input.baseDir);
  const existing = registry.plugins[input.pluginId];
  if (!existing) {
    return;
  }
  yield* removeInstalledFiles(existing);
  // Best effort: a config we cannot rewrite should not block removing the
  // plugin's files or its registry entry, which is the part the user asked
  // for. The leftover server stays visible in Claude's own config.
  yield* removeClaudeMcpServers({
    claudeDir: input.claudeDirOverride ?? defaultClaudeDir(path),
    names: existing.mcpServers ?? [],
  }).pipe(Effect.ignore);
  delete registry.plugins[input.pluginId];
  yield* writeRegistry(input.baseDir, registry).pipe(
    Effect.mapError(
      (cause) =>
        new ClaudePluginInstallError({
          message: `Removed '${existing.name}' but failed to update the plugin registry.`,
          cause,
        }),
    ),
  );
});
