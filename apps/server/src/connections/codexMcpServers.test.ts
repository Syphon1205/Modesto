import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  installCodexMcpServer,
  listCodexMcpServers,
  removeCodexMcpServerFromConfig,
  setCodexMcpServerEnabledInConfig,
} from "./codexMcpServers.ts";

async function tempConfig(initial?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "modesto-mcp-test-"));
  const path = join(dir, "config.toml");
  if (initial !== undefined) await writeFile(path, initial, "utf8");
  return path;
}

const gmail = {
  name: "gmail",
  transport: "http" as const,
  url: "https://gmailmcp.googleapis.com/mcp/v1",
  oauth: true,
  enabled: true,
};

describe("installing a connection", () => {
  it("creates the config when Codex has not written one yet", async () => {
    // A missing config is an empty config - Codex writes it on first use, and
    // connecting before that must not fail.
    const path = await tempConfig();

    await installCodexMcpServer(path, gmail);

    const servers = await listCodexMcpServers(path);
    expect(servers.map((server) => server.name)).toEqual(["gmail"]);
    expect(servers[0]?.url).toBe(gmail.url);
    expect(servers[0]?.enabled).toBe(true);
  });

  it("preserves configuration it did not write", async () => {
    // Codex's config is not ours; losing a user's model or approval settings
    // to a connection install would be far worse than the install failing.
    const path = await tempConfig('model = "gpt-5"\napproval_policy = "never"\n');

    await installCodexMcpServer(path, gmail);

    const contents = await readFile(path, "utf8");
    expect(contents).toContain('model = "gpt-5"');
    expect(contents).toContain('approval_policy = "never"');
  });

  it("replaces a server already recorded under the same name", async () => {
    const path = await tempConfig();
    await installCodexMcpServer(path, gmail);
    await installCodexMcpServer(path, { ...gmail, url: "https://example.test/mcp" });

    const servers = await listCodexMcpServers(path);
    expect(servers).toHaveLength(1);
    expect(servers[0]?.url).toBe("https://example.test/mcp");
  });

  it("keeps other connections when one is added", async () => {
    const path = await tempConfig();
    await installCodexMcpServer(path, gmail);
    await installCodexMcpServer(path, {
      name: "playwright",
      command: "npx",
      args: ["-y", "@playwright/mcp"],
      enabled: true,
    });

    const servers = await listCodexMcpServers(path);
    expect(servers.map((server) => server.name).toSorted()).toEqual(["gmail", "playwright"]);
  });
});

describe("removing and disabling", () => {
  it("removes only the named connection", async () => {
    const path = await tempConfig();
    await installCodexMcpServer(path, gmail);
    await installCodexMcpServer(path, {
      name: "notion",
      command: "npx",
      args: ["notion"],
      enabled: true,
    });

    await removeCodexMcpServerFromConfig(path, "gmail");

    expect((await listCodexMcpServers(path)).map((s) => s.name)).toEqual(["notion"]);
  });

  it("disables without forgetting the connection", async () => {
    // Re-enabling should not mean reconnecting the service from scratch, so
    // the URL has to survive being turned off.
    const path = await tempConfig();
    await installCodexMcpServer(path, gmail);

    await setCodexMcpServerEnabledInConfig(path, "gmail", false);

    const [server] = await listCodexMcpServers(path);
    expect(server?.enabled).toBe(false);
    expect(server?.url).toBe(gmail.url);
  });

  it("leaves the file untouched when nothing changes", async () => {
    const path = await tempConfig();
    await installCodexMcpServer(path, gmail);
    const before = await readFile(path, "utf8");

    await removeCodexMcpServerFromConfig(path, "not-installed");

    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("reports no connections for a config that has none", async () => {
    expect(await listCodexMcpServers(await tempConfig('model = "gpt-5"\n'))).toEqual([]);
  });
});
