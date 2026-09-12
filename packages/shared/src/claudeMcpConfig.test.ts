import { describe, expect, it } from "vite-plus/test";

import {
  hasClaudeMcpServer,
  listClaudeMcpServers,
  removeClaudeMcpServer,
  upsertClaudeMcpServer,
} from "./claudeMcpConfig.ts";

const httpServer = { type: "http", url: "https://mcp.example.com/mcp" } as const;

describe("listClaudeMcpServers", () => {
  it("reads user-scope servers in name order", () => {
    expect(
      listClaudeMcpServers({ mcpServers: { zulu: httpServer, alpha: httpServer } }).map(
        (entry) => entry.name,
      ),
    ).toEqual(["alpha", "zulu"]);
  });

  it("treats a missing or malformed map as empty rather than throwing", () => {
    expect(listClaudeMcpServers({})).toEqual([]);
    expect(listClaudeMcpServers({ mcpServers: "nonsense" })).toEqual([]);
    expect(listClaudeMcpServers(null)).toEqual([]);
    // A non-object entry is skipped, but its siblings still read.
    expect(
      listClaudeMcpServers({ mcpServers: { good: httpServer, bad: 42 } }).map((e) => e.name),
    ).toEqual(["good"]);
  });
});

describe("upsertClaudeMcpServer", () => {
  it("preserves every unrelated key in Claude's live config", () => {
    // This file holds project history, caches, and onboarding flags. Dropping
    // one would corrupt the user's CLI, not just their plugin.
    const document = {
      userID: "abc",
      projects: { "/tmp/x": { mcpServers: { local: httpServer } } },
      autoUpdates: true,
    };

    const next = upsertClaudeMcpServer(document, { name: "notion", config: httpServer });

    expect(next.userID).toBe("abc");
    expect(next.projects).toEqual(document.projects);
    expect(next.autoUpdates).toBe(true);
    expect(hasClaudeMcpServer(next, "notion")).toBe(true);
  });

  it("does not mutate the document it was given", () => {
    const document = { mcpServers: { existing: httpServer } };
    const next = upsertClaudeMcpServer(document, { name: "added", config: httpServer });

    expect(Object.keys(document.mcpServers)).toEqual(["existing"]);
    expect(Object.keys(next.mcpServers as object).toSorted()).toEqual(["added", "existing"]);
  });

  it("overwrites a name that already exists", () => {
    const document = { mcpServers: { notion: { type: "stdio", command: "old" } } };
    const next = upsertClaudeMcpServer(document, { name: "notion", config: httpServer });

    expect(listClaudeMcpServers(next)).toEqual([{ name: "notion", config: httpServer }]);
  });

  it("creates the map when the config has none", () => {
    expect(
      hasClaudeMcpServer(upsertClaudeMcpServer({}, { name: "a", config: httpServer }), "a"),
    ).toBe(true);
  });
});

describe("removeClaudeMcpServer", () => {
  it("removes only the named server", () => {
    const document = { userID: "abc", mcpServers: { a: httpServer, b: httpServer } };
    const next = removeClaudeMcpServer(document, "a");

    expect(listClaudeMcpServers(next).map((entry) => entry.name)).toEqual(["b"]);
    expect(next.userID).toBe("abc");
  });

  it("is a no-op for a server that is not there", () => {
    const document = { mcpServers: { a: httpServer } };
    expect(
      listClaudeMcpServers(removeClaudeMcpServer(document, "missing")).map((e) => e.name),
    ).toEqual(["a"]);
    expect(removeClaudeMcpServer({ userID: "abc" }, "missing")).toEqual({ userID: "abc" });
  });
});
