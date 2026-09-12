import type { VercelAuthSource, VercelDeployment, VercelProject } from "@modesto/contracts";

export const VERCEL_ACCESS_TOKEN_SECRET = "vercel.access-token";
export const VERCEL_API_BASE_URL = "https://api.vercel.com";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function preferVercelToken(candidates: {
  readonly token: string | null;
  readonly env: string | null;
  readonly cli: string | null;
}): { readonly token: string; readonly source: VercelAuthSource } | null {
  if (candidates.token) return { token: candidates.token, source: "token" };
  if (candidates.env) return { token: candidates.env, source: "env" };
  if (candidates.cli) return { token: candidates.cli, source: "cli" };
  return null;
}

export function parseVercelCliAuthToken(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? readTrimmedString(parsed.token) : null;
  } catch {
    return null;
  }
}

export function vercelCliAuthFileCandidates(
  homeDir: string,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): ReadonlyArray<string> {
  const paths: string[] = [];
  if (platform === "darwin") {
    paths.push(`${homeDir}/Library/Application Support/com.vercel.cli/auth.json`);
  }
  if (platform === "win32") {
    const appData = readTrimmedString(env.APPDATA);
    if (appData) paths.push(`${appData}/com.vercel.cli/auth.json`);
  }
  const xdg = readTrimmedString(env.XDG_CONFIG_HOME) ?? `${homeDir}/.config`;
  paths.push(`${xdg}/com.vercel.cli/auth.json`);
  return paths;
}

export function decodeVercelUser(payload: unknown): {
  readonly username: string | null;
  readonly email: string | null;
} {
  const root = isRecord(payload) ? payload : {};
  const user = isRecord(root.user) ? root.user : root;
  return {
    username: readTrimmedString(user.username) ?? readTrimmedString(user.name),
    email: readTrimmedString(user.email),
  };
}

function absoluteDeploymentUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function decodeDeployment(value: unknown): VercelDeployment | null {
  if (!isRecord(value)) return null;
  const id = readTrimmedString(value.id);
  if (!id) return null;
  return {
    id,
    url: absoluteDeploymentUrl(readTrimmedString(value.url)),
    state: readTrimmedString(value.readyState) ?? readTrimmedString(value.state) ?? "UNKNOWN",
    target: readTrimmedString(value.target),
    createdAt: typeof value.createdAt === "number" ? value.createdAt : null,
  };
}

function pickLatestDeployment(values: ReadonlyArray<unknown>): VercelDeployment | null {
  const deployments = values.flatMap((value) => {
    const decoded = decodeDeployment(value);
    return decoded ? [decoded] : [];
  });
  return (
    deployments.find(
      (deployment) => deployment.target === "production" && deployment.state === "READY",
    ) ??
    deployments.find((deployment) => deployment.state === "READY") ??
    deployments[0] ??
    null
  );
}

export function decodeVercelProject(value: unknown): VercelProject | null {
  if (!isRecord(value)) return null;
  const id = readTrimmedString(value.id);
  const name = readTrimmedString(value.name);
  if (!id || !name) return null;
  const link = isRecord(value.link) ? value.link : null;
  const github = link !== null && readTrimmedString(link.type)?.toLowerCase() === "github";
  const deployments = Array.isArray(value.latestDeployments) ? value.latestDeployments : [];
  return {
    id,
    name,
    framework: readTrimmedString(value.framework),
    githubOwner: github ? readTrimmedString(link.org) : null,
    githubRepo: github ? readTrimmedString(link.repo) : null,
    latestDeployment: pickLatestDeployment(deployments),
  };
}

export function decodeVercelProjects(payload: unknown): ReadonlyArray<VercelProject> {
  const root = isRecord(payload) ? payload : {};
  const list = Array.isArray(root.projects) ? root.projects : [];
  return list.flatMap((value) => {
    const project = decodeVercelProject(value);
    return project ? [project] : [];
  });
}

export function vercelApiFailureDetail(status: number): string {
  if (status === 401 || status === 403) {
    return "Vercel rejected this token. Create a new one at vercel.com/account/tokens.";
  }
  return `Vercel API request failed (${status}).`;
}
