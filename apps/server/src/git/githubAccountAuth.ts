/**
 * GitHubAccountAuth - the app's own "sign in with GitHub" identity flow via
 * the `gh` CLI, distinct from apps/server/src/sourceControl/GitHubCli.ts
 * (which drives PR/source-control operations once a repo is already set up).
 *
 * Ported from Modesto's original apps/server/src/wsRpc.ts device-code
 * sign-in implementation, adapted to this codebase's Effect-native RPC
 * handler shape. The device-code protocol here is deliberately unchanged
 * from the original, well-tested version: `gh auth login --web --clipboard`
 * is spawned detached, stdout/stderr are watched for the `XXXX-XXXX` device
 * code (and verification URL). The RPC resolves as soon as the code appears
 * (or after an 8s timeout) rather than waiting for browser-side OAuth.
 * Because this spawn is non-interactive, `gh` only *prints* the URL — the
 * client must open `verificationUri` itself, then poll `git.githubAuthStatus`
 * until authenticated.
 *
 * @module githubAccountAuth
 */
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";

import * as Effect from "effect/Effect";

import {
  GitHubAuthCliError,
  type GitHubAuthStatus,
  type GitHubSignInResult,
  type GitHubSignOutResult,
} from "@modesto/contracts";

import {
  buildGitHubDeviceAuthUrl,
  parseGitHubDeviceCode,
  parseGitHubVerificationUri,
} from "./githubDeviceCode.ts";

const EXEC_TIMEOUT_MS = 15_000;
const DEVICE_CODE_WAIT_MS = 8_000;

interface GitHubCliResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

function runGitHubCli(args: ReadonlyArray<string>): Promise<GitHubCliResult> {
  return new Promise((resolve) => {
    execFile(
      "gh",
      args,
      { timeout: EXEC_TIMEOUT_MS, env: process.env },
      (error, stdout, stderr) => {
        resolve({ ok: !error, stdout: stdout ?? "", stderr: stderr ?? "" });
      },
    );
  });
}

async function readAuthStatus(): Promise<GitHubAuthStatus> {
  const version = await runGitHubCli(["--version"]);
  if (!version.ok) {
    return { installed: false, authenticated: false, login: null, name: null, avatarUrl: null };
  }
  const user = await runGitHubCli(["api", "user", "--jq", "{login, name, avatarUrl: .avatar_url}"]);
  if (!user.ok) {
    return { installed: true, authenticated: false, login: null, name: null, avatarUrl: null };
  }
  let account: Record<string, unknown> = {};
  try {
    account = JSON.parse(user.stdout) as Record<string, unknown>;
  } catch {
    account = {};
  }
  const login = typeof account.login === "string" ? account.login.trim() : "";
  const name = typeof account.name === "string" ? account.name.trim() : "";
  const avatarUrl = typeof account.avatarUrl === "string" ? account.avatarUrl.trim() : "";
  return {
    installed: true,
    authenticated: login.length > 0,
    login: login || null,
    name: name || null,
    avatarUrl: avatarUrl || null,
  };
}

// `gh` prefers GH_TOKEN/GITHUB_TOKEN over any stored credential (documented
// in `gh help environment`), and `gh auth logout` can't unset an env var -
// so a session backed by one of these stays authenticated after "sign out"
// appears to succeed. Surfaced explicitly rather than silently reporting a
// false success.
function githubEnvTokenOverrideName(): string | null {
  if (process.env.GH_TOKEN?.trim()) return "GH_TOKEN";
  if (process.env.GITHUB_TOKEN?.trim()) return "GITHUB_TOKEN";
  return null;
}

async function performSignOut(): Promise<GitHubSignOutResult> {
  const status = await readAuthStatus();
  if (!status.authenticated || !status.login) {
    return { signedOut: true };
  }
  const result = await runGitHubCli([
    "auth",
    "logout",
    "--hostname",
    "github.com",
    "--user",
    status.login,
  ]);
  if (!result.ok) {
    throw new Error(result.stderr || "GitHub CLI sign-out failed.");
  }
  const afterStatus = await readAuthStatus();
  if (afterStatus.authenticated) {
    const envToken = githubEnvTokenOverrideName();
    throw new Error(
      envToken
        ? `Removed the stored GitHub credential, but this machine's ${envToken} environment variable still authenticates \`gh\`. Unset ${envToken} to fully sign out.`
        : `GitHub still shows as signed in after logout${afterStatus.login ? ` (as @${afterStatus.login})` : ""}. Another stored account may still be active - run \`gh auth logout\` again in a terminal to remove it.`,
    );
  }
  return { signedOut: true };
}

function performSignIn(): Promise<GitHubSignInResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "gh",
      [
        "auth",
        "login",
        "--hostname",
        "github.com",
        "--git-protocol",
        "https",
        "--web",
        "--clipboard",
      ],
      { detached: true, stdio: ["ignore", "pipe", "pipe"], env: process.env },
    );
    let output = "";
    let settled = false;
    const finish = (userCode: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(codeTimeout);
      child.unref();
      resolve({
        started: true,
        userCode,
        verificationUri: buildGitHubDeviceAuthUrl({
          userCode,
          verificationUri: parseGitHubVerificationUri(output),
        }),
      });
    };
    const capture = (chunk: Buffer | string) => {
      output = `${output}${chunk.toString()}`.slice(-16_384);
      const userCode = parseGitHubDeviceCode(output);
      if (userCode) finish(userCode);
    };
    const codeTimeout = setTimeout(() => finish(null), DEVICE_CODE_WAIT_MS);
    codeTimeout.unref();

    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(codeTimeout);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(codeTimeout);
      reject(
        new Error(
          output.trim() ||
            `GitHub CLI sign-in exited before producing a device code (code ${code ?? "unknown"}).`,
        ),
      );
    });
  });
}

function toAuthCliError(
  operation: "status" | "signIn" | "signOut",
  cause: unknown,
): GitHubAuthCliError {
  return new GitHubAuthCliError({
    operation,
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}

// Plain Effect constants, not a Context.Service - these have no real
// dependencies (they shell out directly), so wrapping them in a service tag
// would only add an ambient requirement every test harness in this package
// has to remember to provide, for no actual benefit.

export const status: Effect.Effect<GitHubAuthStatus, GitHubAuthCliError> = Effect.tryPromise({
  try: () => readAuthStatus(),
  catch: (cause) => toAuthCliError("status", cause),
});

export const signIn: Effect.Effect<GitHubSignInResult, GitHubAuthCliError> = Effect.tryPromise({
  try: () => performSignIn(),
  catch: (cause) => toAuthCliError("signIn", cause),
});

export const signOut: Effect.Effect<GitHubSignOutResult, GitHubAuthCliError> = Effect.tryPromise({
  try: () => performSignOut(),
  catch: (cause) => toAuthCliError("signOut", cause),
});
