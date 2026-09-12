import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClaudePluginBundleError,
  parseClaudePluginSource,
  resolveClaudePluginBundle,
} from "./claudePluginBundle.ts";

describe("parseClaudePluginSource", () => {
  it("parses a plain owner/repo shorthand", () => {
    const source = parseClaudePluginSource("owner/repo");
    expect(source).toEqual({
      owner: "owner",
      repo: "repo",
      ref: null,
      dir: null,
      treeSegments: null,
    });
  });

  it("parses a full https URL", () => {
    const source = parseClaudePluginSource("https://github.com/owner/repo");
    expect(source.owner).toBe("owner");
    expect(source.repo).toBe("repo");
    expect(source.ref).toBeNull();
  });

  it("parses a bare github.com URL without protocol", () => {
    const source = parseClaudePluginSource("github.com/owner/repo");
    expect(source).toEqual({
      owner: "owner",
      repo: "repo",
      ref: null,
      dir: null,
      treeSegments: null,
    });
  });

  it("strips a trailing .git suffix", () => {
    const source = parseClaudePluginSource("https://github.com/owner/repo.git");
    expect(source.repo).toBe("repo");
  });

  it("parses a /tree/<ref> URL with no subdirectory", () => {
    const source = parseClaudePluginSource("https://github.com/owner/repo/tree/main");
    expect(source.ref).toBe("main");
    expect(source.dir).toBeNull();
    expect(source.treeSegments).toEqual(["main"]);
  });

  it("parses a /tree/<ref>/<subdir> URL, deferring ref/dir ambiguity to treeSegments", () => {
    const source = parseClaudePluginSource("https://github.com/owner/repo/tree/main/plugins/foo");
    expect(source.ref).toBe("main");
    expect(source.dir).toBe("plugins/foo");
    expect(source.treeSegments).toEqual(["main", "plugins", "foo"]);
  });

  it("ignores query strings and fragments", () => {
    const source = parseClaudePluginSource("https://github.com/owner/repo?tab=readme#section");
    expect(source).toEqual({
      owner: "owner",
      repo: "repo",
      ref: null,
      dir: null,
      treeSegments: null,
    });
  });

  it("rejects an empty URL", () => {
    expect(() => parseClaudePluginSource("")).toThrow(ClaudePluginBundleError);
    expect(() => parseClaudePluginSource("   ")).toThrow(ClaudePluginBundleError);
  });

  it("rejects a non-GitHub host", () => {
    expect(() => parseClaudePluginSource("https://gitlab.com/owner/repo")).toThrow(
      ClaudePluginBundleError,
    );
  });

  it("rejects an owner or repo with invalid characters", () => {
    expect(() => parseClaudePluginSource("owner space/repo")).toThrow(ClaudePluginBundleError);
    expect(() => parseClaudePluginSource("owner/repo!bang")).toThrow(ClaudePluginBundleError);
  });

  it("carries the invalid_plugin_url code on parse failures", () => {
    expect.assertions(2);
    try {
      parseClaudePluginSource("not a url at all with spaces///");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaudePluginBundleError);
      expect((error as ClaudePluginBundleError).code).toBe("invalid_plugin_url");
    }
  });
});

// ---------------------------------------------------------------------------
// Resolution against a stubbed GitHub: marketplace repos, auth, and failures.
// ---------------------------------------------------------------------------

const REPO_URL = "https://github.com/acme/plugins";

type Blob = { readonly path: string; readonly sha: string; readonly type: "blob" };
const blob = (path: string): Blob => ({ path, sha: `sha-${path}`, type: "blob" });

const PLUGIN_MANIFEST = JSON.stringify({ name: "Widgets", description: "Adds widgets" });

/**
 * Serves a fake GitHub. Tree entries drive discovery; `files` answers raw reads.
 * `onRequest` lets a case assert on headers or return a failure.
 */
function stubGithub(input: {
  readonly tree: ReadonlyArray<Blob>;
  readonly files?: Record<string, string>;
  readonly onRequest?: (url: string, init: RequestInit | undefined) => Response | null;
}) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  vi.stubGlobal("fetch", (input_: string | URL | Request, init?: RequestInit) => {
    const url = String(input_);
    calls.push({ url, init });
    const override = input.onRequest?.(url, init);
    if (override) return Promise.resolve(override);
    if (url.includes("/git/trees/")) {
      return Promise.resolve(new Response(JSON.stringify({ tree: input.tree }), { status: 200 }));
    }
    if (/\/repos\/[^/]+\/[^/]+$/.test(url)) {
      return Promise.resolve(
        new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
      );
    }
    for (const [path, body] of Object.entries(input.files ?? {})) {
      if (url.endsWith(`/${path}`)) return Promise.resolve(new Response(body, { status: 200 }));
    }
    return Promise.resolve(new Response("not found", { status: 404 }));
  });
  return calls;
}

beforeEach(() => {
  delete process.env["GITHUB_TOKEN"];
  delete process.env["GH_TOKEN"];
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["GITHUB_TOKEN"];
  delete process.env["GH_TOKEN"];
});

const marketplace = (plugins: ReadonlyArray<{ name: string; source: string }>) =>
  JSON.stringify({ name: "Acme", plugins });

describe("marketplace repositories", () => {
  it("installs the single plugin a marketplace lists", async () => {
    // A marketplace repo is a valid thing to paste; it just holds its plugin
    // one level down. Previously this failed as "no plugin.json".
    stubGithub({
      tree: [
        blob(".claude-plugin/marketplace.json"),
        blob("widgets/.claude-plugin/plugin.json"),
        blob("widgets/skills/Make/SKILL.md"),
      ],
      files: {
        ".claude-plugin/marketplace.json": marketplace([{ name: "widgets", source: "./widgets" }]),
        "widgets/.claude-plugin/plugin.json": PLUGIN_MANIFEST,
        "widgets/skills/Make/SKILL.md": "---\nname: Make\n---\nGo.",
      },
    });

    const bundle = await resolveClaudePluginBundle({ url: REPO_URL });

    expect(bundle.preview.name).toBe("Widgets");
    expect(bundle.preview.source.dir).toBe("widgets");
  });

  it("names every plugin when a marketplace lists more than one", async () => {
    stubGithub({
      tree: [
        blob(".claude-plugin/marketplace.json"),
        blob("alpha/.claude-plugin/plugin.json"),
        blob("beta/.claude-plugin/plugin.json"),
      ],
      files: {
        ".claude-plugin/marketplace.json": marketplace([
          { name: "alpha", source: "./alpha" },
          { name: "beta", source: "./beta" },
        ]),
      },
    });

    await expect(resolveClaudePluginBundle({ url: REPO_URL })).rejects.toThrow(
      /marketplace with 2 plugins \(alpha, beta\)/,
    );
  });

  it("ignores listed plugins that are not actually in the repo", async () => {
    // Suggesting a directory that does not exist would fail on the next click.
    stubGithub({
      tree: [
        blob(".claude-plugin/marketplace.json"),
        blob("alpha/.claude-plugin/plugin.json"),
        blob("alpha/skills/S/SKILL.md"),
      ],
      files: {
        ".claude-plugin/marketplace.json": marketplace([
          { name: "alpha", source: "./alpha" },
          { name: "remote", source: "https://github.com/other/repo" },
          { name: "ghost", source: "./ghost" },
        ]),
        "alpha/.claude-plugin/plugin.json": PLUGIN_MANIFEST,
        "alpha/skills/S/SKILL.md": "---\nname: S\n---\nGo.",
      },
    });

    const bundle = await resolveClaudePluginBundle({ url: REPO_URL });
    expect(bundle.preview.source.dir).toBe("alpha");
  });

  it("says so when a marketplace stores none of its plugins", async () => {
    stubGithub({
      tree: [blob(".claude-plugin/marketplace.json")],
      files: {
        ".claude-plugin/marketplace.json": marketplace([
          { name: "remote", source: "https://github.com/other/repo" },
        ]),
      },
    });

    await expect(resolveClaudePluginBundle({ url: REPO_URL })).rejects.toThrow(
      /marketplace, but none of the plugins it lists are stored in it/,
    );
  });

  it("still reports a plain repo with no plugin as having none", async () => {
    stubGithub({ tree: [blob("README.md")] });

    await expect(resolveClaudePluginBundle({ url: REPO_URL })).rejects.toThrow(
      /No \.claude-plugin\/plugin\.json found/,
    );
  });
});

describe("GitHub failures", () => {
  it("reports a rate limit as a rate limit, not a missing manifest", async () => {
    // The failure that sent people to check a URL that was fine.
    stubGithub({
      tree: [],
      onRequest: (url) =>
        url.includes("/git/trees/")
          ? new Response("rate limited", {
              status: 403,
              headers: { "x-ratelimit-remaining": "0" },
            })
          : null,
    });

    await expect(resolveClaudePluginBundle({ url: REPO_URL })).rejects.toThrow(
      /rate limit reached.*Set GITHUB_TOKEN/s,
    );
  });

  it("does not tell an authenticated user to set a token", async () => {
    process.env["GITHUB_TOKEN"] = "t";
    stubGithub({
      tree: [],
      onRequest: (url) =>
        url.includes("/git/trees/")
          ? new Response("rate limited", {
              status: 403,
              headers: { "x-ratelimit-remaining": "0" },
            })
          : null,
    });

    await expect(resolveClaudePluginBundle({ url: REPO_URL })).rejects.toThrow(
      /rate limit reached(?!.*Set GITHUB_TOKEN)/s,
    );
  });

  it("suggests a token when a repository looks missing", async () => {
    stubGithub({
      tree: [],
      onRequest: (url) =>
        url.includes("/git/trees/") ? new Response("nope", { status: 404 }) : null,
    });

    await expect(resolveClaudePluginBundle({ url: REPO_URL })).rejects.toThrow(
      /not found.*private.*GITHUB_TOKEN/s,
    );
  });
});

describe("authentication", () => {
  it("sends the token when one is configured", async () => {
    process.env["GH_TOKEN"] = "secret-token";
    const calls = stubGithub({
      tree: [blob(".claude-plugin/plugin.json"), blob("skills/S/SKILL.md")],
      files: {
        ".claude-plugin/plugin.json": PLUGIN_MANIFEST,
        "skills/S/SKILL.md": "---\nname: S\n---\nGo.",
      },
    });

    await resolveClaudePluginBundle({ url: REPO_URL });

    const authorized = calls.filter(
      (call) =>
        (call.init?.headers as Record<string, string> | undefined)?.["Authorization"] ===
        "Bearer secret-token",
    );
    expect(authorized.length).toBeGreaterThan(0);
  });

  it("sends no Authorization header when no token is set", async () => {
    const calls = stubGithub({
      tree: [blob(".claude-plugin/plugin.json"), blob("skills/S/SKILL.md")],
      files: {
        ".claude-plugin/plugin.json": PLUGIN_MANIFEST,
        "skills/S/SKILL.md": "---\nname: S\n---\nGo.",
      },
    });

    await resolveClaudePluginBundle({ url: REPO_URL });

    for (const call of calls) {
      expect(
        (call.init?.headers as Record<string, string> | undefined)?.["Authorization"],
      ).toBeUndefined();
    }
  });
});
