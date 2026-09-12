import { describe, expect, it } from "vitest";
import {
  parseCodexMcpServers,
  removeCodexMcpServer,
  setCodexMcpServerEnabled,
  upsertCodexMcpServer,
} from "./codexMcpConfig.ts";

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
        transport: "stdio",
        command: "node",
        args: ["server.js", "--stdio"],
        oauth: false,
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
    expect(parseCodexMcpServers(next)[0]).toMatchObject({
      transport: "stdio",
      command: "bunx",
      cwd: "/tmp/work",
    });
    expect(next).toContain("[mcp_servers.demo.env]");
    expect(removeCodexMcpServer(next, "demo")).not.toContain("mcp_servers.demo");
  });

  it("parses and upserts remote URL MCP servers", () => {
    const next = upsertCodexMcpServer("", {
      name: "notion",
      transport: "http",
      url: "https://mcp.notion.com/mcp",
      oauth: true,
      enabled: true,
    });
    expect(parseCodexMcpServers(next)).toEqual([
      {
        name: "notion",
        transport: "http",
        command: "",
        args: [],
        url: "https://mcp.notion.com/mcp",
        oauth: true,
        enabled: true,
        hasEnv: false,
      },
    ]);
    expect(next).toContain('url = "https://mcp.notion.com/mcp"');
    expect(next).not.toContain("auth =");
  });

  it("writes auth = none when oauth is disabled for URL servers", () => {
    const next = upsertCodexMcpServer("", {
      name: "context7",
      transport: "http",
      url: "https://mcp.context7.com/mcp",
      oauth: false,
      enabled: true,
    });
    expect(parseCodexMcpServers(next)[0]).toMatchObject({ oauth: false, transport: "http" });
    expect(next).toContain('auth = "none"');
  });

  it("round-trips OAuth client IDs and removes the nested OAuth block", () => {
    const next = upsertCodexMcpServer("", {
      name: "gmail",
      transport: "http",
      url: "https://gmailmcp.googleapis.com/mcp/v1",
      oauth: true,
      oauthClientId: "desktop-client.apps.googleusercontent.com",
      enabled: true,
    });
    expect(parseCodexMcpServers(next)[0]).toMatchObject({
      name: "gmail",
      oauth: true,
      oauthClientId: "desktop-client.apps.googleusercontent.com",
    });
    expect(next).toContain('[mcp_servers."gmail".oauth]');
    expect(removeCodexMcpServer(next, "gmail")).not.toContain("mcp_servers");
  });
});

it("preserves existing HTTP credentials and OAuth registration when updating the same connection", () => {
  const original = `model = "gpt-5"
[mcp_servers.private]
url = "https://example.test/mcp#service"
enabled = true
bearer_token_env_var = "PRIVATE_MCP_TOKEN"
env_vars = ["PRIVATE_MCP_TOKEN"]
http_headers = { "X-Account" = "account#1" }
startup_timeout_sec = 45
[mcp_servers.private.oauth]
client_id = "registered-client"
callback_url = "http://127.0.0.1/callback/original"
scopes = ["read", "write"]
[mcp_servers.private.env_http_headers]
Authorization = "PRIVATE_MCP_AUTH"
[mcp_servers.other]
command = "node"
`;
  const next = upsertCodexMcpServer(original, {
    name: "private",
    transport: "http",
    url: "https://example.test/mcp#service",
    enabled: false,
    oauth: true,
  });
  expect(parseCodexMcpServers(next).find((server) => server.name === "private")).toMatchObject({
    enabled: false,
    url: "https://example.test/mcp#service",
    oauthClientId: "registered-client",
  });
  expect(next).toContain('bearer_token_env_var = "PRIVATE_MCP_TOKEN"');
  expect(next).toContain('http_headers = { "X-Account" = "account#1" }');
  expect(next).toContain('callback_url = "http://127.0.0.1/callback/original"');
  expect(next).toContain('scopes = ["read", "write"]');
  expect(next).toContain('Authorization = "PRIVATE_MCP_AUTH"');
  expect(next).toContain("startup_timeout_sec = 45");
});

it("does not forward credentials to a replacement HTTP endpoint", () => {
  const original = `[mcp_servers.private]
url = "https://old.example/mcp"
bearer_token_env_var = "OLD_TOKEN"
http_headers = { Authorization = "old-secret" }
[mcp_servers.private.oauth]
client_id = "old-client"
[mcp_servers.private.env_http_headers]
Authorization = "OLD_HEADER"
[mcp_servers.other]
url = "https://keep.example/mcp"
`;
  const next = upsertCodexMcpServer(original, {
    name: "private",
    transport: "http",
    url: "https://new.example/mcp",
    enabled: true,
  });
  expect(next).not.toMatch(/OLD_TOKEN|old-secret|old-client|OLD_HEADER/);
  expect(parseCodexMcpServers(next).map((server) => server.url)).toEqual([
    "https://new.example/mcp",
    "https://keep.example/mcp",
  ]);
});
