import { describe, expect, it } from "vitest";
import {
  parseCodexMcpServers,
  removeCodexMcpServer,
  setCodexMcpServerEnabled,
  upsertCodexMcpServer,
} from "./codexMcpConfig";

const fixture = `model = "gpt"

[mcp_servers.demo]
command = "node"
args = ["server.js", "--stdio"]
startup_timeout_sec = 12

[mcp_servers.demo.env]
TOKEN = "never-return-this"
`;

describe("Codex MCP config", () => {
  it("parses summaries without exposing env values", () => {
    expect(parseCodexMcpServers(fixture)).toEqual([
      {
        name: "demo",
        command: "node",
        args: ["server.js", "--stdio"],
        enabled: true,
        startupTimeoutSec: 12,
        hasEnv: true,
      },
    ]);
  });

  it("toggles without changing env blocks", () => {
    const next = setCodexMcpServerEnabled(fixture, "demo", false);
    expect(parseCodexMcpServers(next)[0]?.enabled).toBe(false);
    expect(next).toContain('TOKEN = "never-return-this"');
  });

  it("upserts main settings while preserving env and removes both blocks", () => {
    const next = upsertCodexMcpServer(fixture, {
      name: "demo",
      command: "bunx",
      args: ["pkg"],
      cwd: "/tmp/work",
      enabled: true,
    });
    expect(parseCodexMcpServers(next)[0]).toMatchObject({ command: "bunx", cwd: "/tmp/work" });
    expect(next).toContain("[mcp_servers.demo.env]");
    expect(removeCodexMcpServer(next, "demo")).not.toContain("mcp_servers.demo");
  });
});
