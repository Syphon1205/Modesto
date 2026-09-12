// FILE: claudePluginBundle.ts
// Purpose: Resolves a GitHub repo containing a Claude Code plugin
//          (.claude-plugin/plugin.json + .mcp.json + skills/ + commands/ + agents/)
//          into a Modesto-native install plan. Ported from the primary
//          Modesto tree's claudePluginBundle.ts (itself ported from
//          OpenWork's claude-plugin-bundle.ts) - this file's parsing/
//          resolution logic is pure GitHub-API/plugin-manifest handling with
//          no dependency on Modesto's own architecture, so it carries over
//          unchanged; only parseSkillFrontmatter now comes from this tree's
//          own ClaudeSkills.ts (a real YAML parser) instead of a hand-rolled
//          line parser, since this tree already has a better one.
// Layer: Server provider helper
// Format reference: https://code.claude.com/docs/en/plugins-reference

import { parseSkillFrontmatter } from "./Drivers/ClaudeSkills.ts";

export class ClaudePluginBundleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ClaudePluginBundleError";
    this.code = code;
  }
}

export interface ClaudePluginSource {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string | null;
  readonly dir: string | null;
  // Raw path segments after `/tree/` when present. Branch names may contain
  // slashes (e.g. release/v1), so the ref/dir split is ambiguous from the URL
  // alone — resolution tries candidates against the trees API.
  readonly treeSegments: string[] | null;
}

export interface ClaudePluginComponent {
  readonly type: "mcp" | "skill" | "command" | "agent";
  readonly name: string;
  readonly description: string | null;
}

export interface ClaudePluginPreview {
  readonly pluginId: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: string | null;
  readonly source: {
    readonly owner: string;
    readonly repo: string;
    readonly ref: string;
    readonly dir: string | null;
  };
  readonly components: readonly ClaudePluginComponent[];
  readonly warnings: readonly string[];
}

export interface ClaudePluginFile {
  readonly type: "skill" | "command" | "agent";
  readonly path: string;
  readonly title: string;
  readonly description: string | null;
  readonly content: string;
}

export interface ClaudePluginBundle {
  readonly preview: ClaudePluginPreview;
  // Raw MCP server config objects exactly as declared upstream (stdio
  // command/args or url). Installed into Claude's user-scope `mcpServers` map
  // on install - see claudeMcpServers.ts. Servers referencing
  // ${CLAUDE_PLUGIN_ROOT} are dropped earlier with a warning, since this tree
  // has nowhere to resolve that path to.
  readonly mcpServers: Readonly<Record<string, unknown>>;
  readonly files: readonly ClaudePluginFile[];
}

function githubApiBase(): string {
  return (process.env.MODESTO_GITHUB_API_BASE?.trim() || "https://api.github.com").replace(
    /\/+$/,
    "",
  );
}

function githubRawBase(): string {
  return (
    process.env.MODESTO_GITHUB_RAW_BASE?.trim() || "https://raw.githubusercontent.com"
  ).replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// GitHub owners are alphanumeric + hyphen; repos additionally allow dots and underscores.
const GITHUB_OWNER_RE = /^[A-Za-z0-9-]+$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Accepts `https://github.com/owner/repo`, `github.com/owner/repo`,
 * `owner/repo`, with optional `.git` suffix and `/tree/<ref>(/<subdir>)`.
 */
export function parseClaudePluginSource(input: string): ClaudePluginSource {
  const trimmed = (input.split(/[?#]/)[0] ?? "").trim();
  if (!trimmed) throw new ClaudePluginBundleError("invalid_plugin_url", "GitHub URL is required");
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const hadHost = /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}\//.test(withoutProtocol);
  if (hadHost && !withoutProtocol.startsWith("github.com/")) {
    throw new ClaudePluginBundleError(
      "invalid_plugin_url",
      "Only github.com sources are supported",
    );
  }
  const path = hadHost ? withoutProtocol.slice(withoutProtocol.indexOf("/") + 1) : withoutProtocol;
  const parts = path.split("/").filter(Boolean);
  const owner = parts[0] ?? "";
  const repo = (parts[1] ?? "").replace(/\.git$/, "");
  if (!GITHUB_OWNER_RE.test(owner) || !GITHUB_REPO_RE.test(repo)) {
    throw new ClaudePluginBundleError(
      "invalid_plugin_url",
      "Expected a GitHub repo URL like https://github.com/owner/repo",
    );
  }
  let ref: string | null = null;
  let dir: string | null = null;
  let treeSegments: string[] | null = null;
  if (parts[2] === "tree" && parts[3]) {
    treeSegments = parts.slice(3);
    ref = parts[3] ?? null;
    const rest = parts.slice(4);
    if (rest.length > 0) dir = rest.join("/");
  }
  return { owner, repo, ref, dir, treeSegments };
}

/**
 * A GitHub token, when the environment offers one.
 *
 * Unauthenticated GitHub allows 60 API requests per hour *per IP*, and a single
 * preview spends several. Without this, previews start failing after a handful
 * of attempts - and the failure looked like "this repo has no plugin.json",
 * which sends people to check a URL that was fine. A token also makes private
 * repositories work at all.
 *
 * Read per call rather than cached so a token exported after startup is picked
 * up without a restart.
 */
function githubAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Turns a GitHub HTTP failure into something that names the actual problem. */
function describeGithubFailure(response: Response, body: string, url: string): string {
  const remaining = response.headers.get("x-ratelimit-remaining");
  if ((response.status === 403 || response.status === 429) && remaining === "0") {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const when = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null;
    return process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim()
      ? `GitHub API rate limit reached${when ? `; resets at ${when.toLocaleTimeString()}` : ""}.`
      : `GitHub API rate limit reached${when ? `; resets at ${when.toLocaleTimeString()}` : ""}. Set GITHUB_TOKEN to raise the limit.`;
  }
  if (response.status === 404) {
    return "Repository or branch not found. If it is private, set GITHUB_TOKEN so Modesto can read it.";
  }
  if (response.status === 401) {
    return "GitHub rejected the configured token. Check GITHUB_TOKEN.";
  }
  return `Failed to fetch plugin data (${response.status}): ${body || url}`;
}

async function fetchGithubJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "modesto-server",
      ...githubAuthHeaders(),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ClaudePluginBundleError(
      "plugin_fetch_failed",
      describeGithubFailure(response, text, url),
    );
  }
  return response.json();
}

export async function fetchGithubText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/plain", "User-Agent": "modesto-server", ...githubAuthHeaders() },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ClaudePluginBundleError(
      "plugin_fetch_failed",
      `Failed to fetch plugin file (${response.status}): ${text || url}`,
    );
  }
  return response.text();
}

export async function fetchGithubBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { "User-Agent": "modesto-server", ...githubAuthHeaders() },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ClaudePluginBundleError(
      "plugin_fetch_failed",
      `Failed to fetch repository file (${response.status}): ${text || url}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function resolveGithubCommitSha(
  source: ClaudePluginSource,
  ref: string,
): Promise<string> {
  const url = `${githubApiBase()}/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/commits/${encodeURIComponent(ref)}`;
  const value = await fetchGithubJson(url);
  if (isRecord(value) && typeof value.sha === "string" && value.sha.trim()) return value.sha.trim();
  throw new ClaudePluginBundleError("plugin_ref_not_found", "Could not pin the requested revision");
}

export interface TreeEntry {
  readonly path: string;
  readonly sha: string;
}

export async function fetchRepoTree(source: ClaudePluginSource, ref: string): Promise<TreeEntry[]> {
  const url = `${githubApiBase()}/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const tree = await fetchGithubJson(url);
  const entries = isRecord(tree) && Array.isArray(tree.tree) ? tree.tree : [];
  return entries.flatMap((entry) => {
    if (!isRecord(entry) || entry.type !== "blob") return [];
    if (typeof entry.path !== "string" || typeof entry.sha !== "string") return [];
    return [{ path: entry.path, sha: entry.sha }];
  });
}

export async function resolveDefaultBranch(source: ClaudePluginSource): Promise<string> {
  const url = `${githubApiBase()}/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`;
  try {
    const info = await fetchGithubJson(url);
    if (isRecord(info) && typeof info.default_branch === "string" && info.default_branch.trim()) {
      return info.default_branch.trim();
    }
  } catch {
    // Fall through to "main" below.
  }
  return "main";
}

export function rawFileUrl(source: ClaudePluginSource, ref: string, path: string): string {
  const segments = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const refSegments = ref
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${githubRawBase()}/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/${refSegments}/${segments}`;
}

// Branch names may contain slashes (release/v1), so a /tree/<...> URL is
// ambiguous between ref and subdirectory. Try progressively longer refs
// against the trees API and use the first that resolves.
export async function resolveRefAndTree(
  source: ClaudePluginSource,
  explicitRef: string | undefined,
): Promise<{ ref: string; dir: string | null; tree: TreeEntry[] }> {
  const candidates: Array<{ ref: string; dir: string | null }> = [];
  if (explicitRef) {
    let dir = source.dir;
    if (source.treeSegments) {
      const joined = source.treeSegments.join("/");
      dir =
        joined === explicitRef
          ? null
          : joined.startsWith(`${explicitRef}/`)
            ? joined.slice(explicitRef.length + 1)
            : source.dir;
    }
    candidates.push({ ref: explicitRef, dir });
  } else if (source.treeSegments && source.treeSegments.length > 0) {
    for (let index = 1; index <= source.treeSegments.length; index += 1) {
      candidates.push({
        ref: source.treeSegments.slice(0, index).join("/"),
        dir: index < source.treeSegments.length ? source.treeSegments.slice(index).join("/") : null,
      });
    }
  } else {
    candidates.push({ ref: await resolveDefaultBranch(source), dir: null });
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const tree = await fetchRepoTree(source, candidate.ref);
      return { ref: candidate.ref, dir: candidate.dir, tree };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new ClaudePluginBundleError(
    "plugin_ref_not_found",
    "Could not resolve the requested branch or tag",
  );
}

const MARKETPLACE_MANIFEST = ".claude-plugin/marketplace.json";

/**
 * Plugin directories a marketplace manifest advertises.
 *
 * A marketplace repository lists many plugins and usually has no plugin.json of
 * its own, so pasting one used to fail with "no .claude-plugin/plugin.json
 * found" - technically true, and useless: the repo is exactly what it should
 * be, it just holds more than one plugin. `anthropics/claude-plugins-official`
 * is this shape.
 *
 * Only the `source` of each entry matters here; a relative "./name" points at
 * the directory holding that plugin.
 */
function readMarketplacePluginDirs(manifest: unknown): ReadonlyArray<string> {
  if (!isRecord(manifest) || !Array.isArray(manifest.plugins)) return [];
  const dirs: string[] = [];
  for (const entry of manifest.plugins) {
    if (!isRecord(entry)) continue;
    const source = typeof entry.source === "string" ? entry.source : null;
    const name = typeof entry.name === "string" ? entry.name : null;
    const candidate = (source ?? name ?? "").trim();
    if (candidate.length === 0) continue;
    // Only in-repo directories are resolvable here; an entry pointing at
    // another repository has to be opened as that repository instead.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) continue;
    const normalized = candidate.replace(/^\.\//, "").replace(/\/+$/, "");
    if (normalized.length > 0 && !normalized.startsWith("..")) dirs.push(normalized);
  }
  return dirs;
}

// Find the plugin root: the given subdir, the repo root, or the shallowest
// directory containing `.claude-plugin/plugin.json`.
function locatePluginRoot(tree: TreeEntry[], dir: string | null): string {
  const manifestPaths = tree
    .map((entry) => entry.path)
    .filter(
      (path) =>
        path === ".claude-plugin/plugin.json" || path.endsWith("/.claude-plugin/plugin.json"),
    );
  if (dir) {
    const normalized = dir.replace(/\/+$/, "");
    const expected = `${normalized}/.claude-plugin/plugin.json`;
    if (!manifestPaths.includes(expected)) {
      throw new ClaudePluginBundleError(
        "plugin_manifest_not_found",
        `No .claude-plugin/plugin.json found under ${normalized}/`,
      );
    }
    return `${normalized}/`;
  }
  if (manifestPaths.length === 0) {
    throw new ClaudePluginBundleError(
      "plugin_manifest_not_found",
      "No .claude-plugin/plugin.json found in this repository",
    );
  }
  manifestPaths.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  const shallowest = manifestPaths[0]!;
  const root = shallowest.slice(0, shallowest.length - ".claude-plugin/plugin.json".length);
  const sameDepth = manifestPaths.filter(
    (path) => path.split("/").length === shallowest.split("/").length,
  );
  if (sameDepth.length > 1) {
    const candidates = sameDepth
      .map((path) => path.slice(0, path.length - "/.claude-plugin/plugin.json".length))
      .join(", ");
    throw new ClaudePluginBundleError(
      "plugin_ambiguous",
      `Multiple plugins found (${candidates}). Add the plugin directory to the URL, e.g. /tree/main/<dir>.`,
    );
  }
  return root;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPathList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value))
    return value.flatMap((entry) =>
      typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
    );
  return [];
}

function normalizeRelative(root: string, path: string): string {
  const cleaned = path.replace(/^\.\//, "").replace(/^\/+/, "");
  if (cleaned.split("/").some((part) => part === "..")) return "";
  return `${root}${cleaned}`;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }).map(async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

const CLAUDE_PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

function mcpConfigReferencesPluginRoot(config: unknown): boolean {
  if (typeof config === "string") return config.includes(CLAUDE_PLUGIN_ROOT_VAR);
  if (Array.isArray(config)) return config.some((entry) => mcpConfigReferencesPluginRoot(entry));
  if (isRecord(config))
    return Object.values(config).some((entry) => mcpConfigReferencesPluginRoot(entry));
  return false;
}

/**
 * Resolves the plugin root, consulting a marketplace manifest when the repo has
 * no plugin of its own.
 *
 * A marketplace repository is a valid thing to paste - it just holds many
 * plugins rather than one. When it lists exactly one, that is unambiguous and
 * gets installed directly. When it lists several, the error names them with the
 * URL to use, which is the difference between a dead end and one more click.
 */
async function locatePluginRootOrMarketplace(input: {
  readonly source: ClaudePluginSource;
  readonly ref: string;
  readonly tree: TreeEntry[];
  readonly dir: string | null;
}): Promise<string> {
  const { source, ref, tree, dir } = input;
  try {
    return locatePluginRoot(tree, dir);
  } catch (error) {
    // Both failures matter. A marketplace holding no plugin of its own raises
    // "not found"; one holding several raises "ambiguous" - and that second
    // case is the common one, since a marketplace is *for* holding several.
    const recoverable =
      error instanceof ClaudePluginBundleError &&
      (error.code === "plugin_manifest_not_found" || error.code === "plugin_ambiguous");
    const hasMarketplace = tree.some((entry) => entry.path === MARKETPLACE_MANIFEST);
    if (!recoverable || dir !== null || !hasMarketplace) {
      throw error;
    }

    let dirs: ReadonlyArray<string> = [];
    try {
      const text = await fetchGithubText(rawFileUrl(source, ref, MARKETPLACE_MANIFEST));
      dirs = readMarketplacePluginDirs(JSON.parse(text));
    } catch {
      // An unreadable marketplace manifest is not more informative than the
      // original "no plugin here" - report that rather than a parse error.
      throw error;
    }

    // Only offer entries that really carry a plugin, so a listed-but-missing
    // directory cannot be suggested and then fail on the next click.
    const installable = dirs.filter((candidate) =>
      tree.some((entry) => entry.path === `${candidate}/.claude-plugin/plugin.json`),
    );
    if (installable.length === 1) {
      return `${installable[0]!}/`;
    }
    if (installable.length > 1) {
      throw new ClaudePluginBundleError(
        "plugin_ambiguous",
        `This is a plugin marketplace with ${installable.length} plugins (${installable.join(", ")}). Add one to the URL, e.g. /tree/${ref}/${installable[0]!}`,
      );
    }
    throw new ClaudePluginBundleError(
      "plugin_manifest_not_found",
      "This repository is a plugin marketplace, but none of the plugins it lists are stored in it.",
    );
  }
}

export async function resolveClaudePluginBundle(input: {
  readonly url: string;
  readonly ref?: string | undefined;
}): Promise<ClaudePluginBundle> {
  const source = parseClaudePluginSource(input.url);
  const { ref, dir, tree } = await resolveRefAndTree(source, input.ref?.trim() || undefined);
  const root = await locatePluginRootOrMarketplace({ source, ref, tree, dir });
  const resolvedDir = root.length > 0 ? root.replace(/\/+$/, "") : null;
  const treeByPath = new Map(tree.map((entry) => [entry.path, entry]));
  const warnings: string[] = [];

  const manifestPath = `${root}.claude-plugin/plugin.json`;
  const manifestText = await fetchGithubText(rawFileUrl(source, ref, manifestPath));
  let manifest: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(manifestText);
    if (!isRecord(parsed)) throw new Error("not an object");
    manifest = parsed;
  } catch {
    throw new ClaudePluginBundleError(
      "invalid_plugin_manifest",
      `${manifestPath} is not valid JSON`,
    );
  }

  const pluginName = readString(manifest.displayName) ?? readString(manifest.name);
  if (!pluginName) {
    throw new ClaudePluginBundleError(
      "invalid_plugin_manifest",
      `${manifestPath} is missing a plugin name`,
    );
  }
  const description = readString(manifest.description);
  const version = readString(manifest.version);
  if (manifest.hooks !== undefined) {
    warnings.push(
      "This plugin declares hooks, which Modesto does not support yet. Hooks were skipped.",
    );
  }

  const inTree = (path: string) => treeByPath.has(path);

  const collectMarkdown = (declared: string[], defaultDir: string): string[] => {
    const roots =
      declared.length > 0
        ? declared.map((entry) => normalizeRelative(root, entry)).filter(Boolean)
        : [`${root}${defaultDir}`];
    const paths = new Set<string>();
    for (const entry of roots) {
      if (entry.endsWith(".md") && inTree(entry)) {
        paths.add(entry);
        continue;
      }
      const prefix = `${entry.replace(/\/+$/, "")}/`;
      for (const candidate of treeByPath.keys()) {
        if (candidate.startsWith(prefix) && candidate.endsWith(".md")) paths.add(candidate);
      }
    }
    return [...paths].toSorted();
  };

  const commandPaths = collectMarkdown(readPathList(manifest.commands), "commands");
  const agentPaths = collectMarkdown(readPathList(manifest.agents), "agents");

  const skillRoots = readPathList(manifest.skills)
    .map((entry) => normalizeRelative(root, entry))
    .filter(Boolean);
  const skillPrefixes =
    skillRoots.length > 0
      ? skillRoots.map((entry) => `${entry.replace(/\/+$/, "")}/`)
      : [`${root}skills/`];
  const skillEntrypoints = [...treeByPath.keys()]
    .filter(
      (path) =>
        skillPrefixes.some((prefix) => path.startsWith(prefix)) && path.endsWith("/SKILL.md"),
    )
    .toSorted();

  const mcpServers: Record<string, unknown> = {};
  const addMcpServers = (value: unknown) => {
    if (!isRecord(value)) return;
    const record = isRecord(value.mcpServers) ? value.mcpServers : value;
    for (const [name, config] of Object.entries(record)) {
      if (!isRecord(config)) continue;
      if (mcpConfigReferencesPluginRoot(config)) {
        warnings.push(
          `MCP server "${name}" uses \${CLAUDE_PLUGIN_ROOT} (a plugin-local command), which Modesto does not support yet. It was skipped.`,
        );
        continue;
      }
      mcpServers[name] = config;
    }
  };

  const declaredMcp = manifest.mcpServers;
  if (typeof declaredMcp === "string") {
    const mcpPath = normalizeRelative(root, declaredMcp);
    if (mcpPath && inTree(mcpPath)) {
      const text = await fetchGithubText(rawFileUrl(source, ref, mcpPath));
      try {
        addMcpServers(JSON.parse(text));
      } catch {
        warnings.push(`${mcpPath} is not valid JSON; its MCP servers were skipped.`);
      }
    }
  } else if (isRecord(declaredMcp)) {
    addMcpServers(declaredMcp);
  }
  const dotMcpPath = `${root}.mcp.json`;
  if (inTree(dotMcpPath)) {
    const text = await fetchGithubText(rawFileUrl(source, ref, dotMcpPath));
    try {
      addMcpServers(JSON.parse(text));
    } catch {
      warnings.push(`${dotMcpPath} is not valid JSON; its MCP servers were skipped.`);
    }
  }
  const componentInputs = [
    ...skillEntrypoints.map((path) => ({ type: "skill" as const, path })),
    ...commandPaths.map((path) => ({ type: "command" as const, path })),
    ...agentPaths.map((path) => ({ type: "agent" as const, path })),
  ];

  const files: ClaudePluginFile[] = await mapWithConcurrency(
    componentInputs,
    6,
    async (item): Promise<ClaudePluginFile> => {
      const content = await fetchGithubText(rawFileUrl(source, ref, item.path));
      const frontmatter = parseSkillFrontmatter(content);
      const fallbackTitle =
        item.type === "skill"
          ? (item.path.split("/").at(-2) ?? "skill")
          : (item.path.split("/").at(-1) ?? "").replace(/\.md$/, "");
      const frontmatterName = frontmatter.kind === "parsed" ? (frontmatter.name ?? null) : null;
      const frontmatterDescription =
        frontmatter.kind === "parsed" ? (frontmatter.description ?? null) : null;
      return {
        type: item.type,
        path: item.path,
        title: item.type === "skill" && frontmatterName ? frontmatterName : fallbackTitle,
        description: frontmatterDescription,
        content,
      };
    },
  );

  const dirSuffix = dir ? `#${dir}` : "";
  const pluginId = `github:${source.owner}/${source.repo}${dirSuffix}`;
  const components: ClaudePluginComponent[] = [
    ...Object.keys(mcpServers).map((name) => ({ type: "mcp" as const, name, description: null })),
    ...files.map((file) => ({ type: file.type, name: file.title, description: file.description })),
  ];

  if (components.length === 0) {
    throw new ClaudePluginBundleError(
      "plugin_empty",
      "This plugin has no MCP servers, skills, commands, or agents Modesto can install.",
    );
  }

  return {
    preview: {
      pluginId,
      name: pluginName,
      description,
      version,
      // The directory actually resolved, not whatever the URL named. A repo
      // holding its plugin one level down resolves to that level, and losing it
      // here means a reinstall cannot find the same plugin again.
      source: { owner: source.owner, repo: source.repo, ref, dir: resolvedDir },
      components,
      warnings,
    },
    mcpServers,
    files,
  };
}
