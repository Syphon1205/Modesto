import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const VERCEL_MCP_SERVER_NAME = "vercel";
export const VERCEL_MCP_URL = "https://mcp.vercel.com";

export const VercelAuthSource = Schema.Literals(["token", "env", "cli"]);
export type VercelAuthSource = typeof VercelAuthSource.Type;

export const VercelDeployment = Schema.Struct({
  id: Schema.String,
  url: Schema.NullOr(Schema.String),
  state: Schema.String,
  target: Schema.NullOr(Schema.String),
  createdAt: Schema.NullOr(Schema.Number),
});
export type VercelDeployment = typeof VercelDeployment.Type;

export const VercelProject = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  framework: Schema.NullOr(Schema.String),
  githubOwner: Schema.NullOr(Schema.String),
  githubRepo: Schema.NullOr(Schema.String),
  latestDeployment: Schema.NullOr(VercelDeployment),
});
export type VercelProject = typeof VercelProject.Type;

export const VercelAuthStatus = Schema.Struct({
  authenticated: Schema.Boolean,
  username: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  source: Schema.NullOr(VercelAuthSource),
  mcpInstalled: Schema.Boolean,
});
export type VercelAuthStatus = typeof VercelAuthStatus.Type;

export const VercelListProjectsResult = Schema.Struct({
  projects: Schema.Array(VercelProject),
});
export type VercelListProjectsResult = typeof VercelListProjectsResult.Type;

export const VercelSetTokenInput = Schema.Struct({
  token: TrimmedNonEmptyString,
});
export type VercelSetTokenInput = typeof VercelSetTokenInput.Type;

export const VercelClearTokenResult = Schema.Struct({
  cleared: Schema.Boolean,
});
export type VercelClearTokenResult = typeof VercelClearTokenResult.Type;

export const VercelInstallMcpResult = Schema.Struct({
  installed: Schema.Boolean,
  name: Schema.String,
});
export type VercelInstallMcpResult = typeof VercelInstallMcpResult.Type;

export class VercelRequestError extends Schema.TaggedErrorClass<VercelRequestError>()(
  "VercelRequestError",
  {
    operation: Schema.Literals([
      "authStatus",
      "listProjects",
      "setToken",
      "clearToken",
      "installMcp",
    ]),
    detail: Schema.String,
  },
) {
  override get message(): string {
    return `Vercel ${this.operation} failed: ${this.detail}`;
  }
}
