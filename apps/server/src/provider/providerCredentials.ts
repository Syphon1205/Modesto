/**
 * providerCredentials - Shared metadata for in-app provider credential linking.
 *
 * Maps each provider to the env var its CLI reads for an API key (if any) and to
 * whether Modesto can trigger that provider's own CLI login flow. Actual secret
 * storage lives in ServerSecretStore; this module only owns the provider→mechanism
 * mapping consumed by ProviderHealth and the settings RPC handlers.
 *
 * @module providerCredentials
 */
import type { ProviderKind } from "@modesto/contracts";

// Verified against each CLI's own --help output (or, for codex/claudeAgent, this
// codebase's existing `<cli> auth status`/`login` usage) rather than assumed:
// cursor-agent documents `--api-key`/`CURSOR_API_KEY` directly; codex/claude/grok/
// droid/gemini all read a well-known provider SDK env var.
export const PROVIDER_API_KEY_ENV_VAR: Partial<Record<ProviderKind, string>> = {
  codex: "OPENAI_API_KEY",
  claudeAgent: "ANTHROPIC_API_KEY",
  cursor: "CURSOR_API_KEY",
  gemini: "GEMINI_API_KEY",
  grok: "XAI_API_KEY",
  droid: "FACTORY_API_KEY",
};

export const API_KEY_SUPPORTED_PROVIDERS = Object.keys(
  PROVIDER_API_KEY_ENV_VAR,
) as ReadonlyArray<ProviderKind>;

export function isApiKeySupportedProvider(provider: ProviderKind): boolean {
  return PROVIDER_API_KEY_ENV_VAR[provider] !== undefined;
}

export function providerApiKeyEnvVar(provider: ProviderKind): string | undefined {
  return PROVIDER_API_KEY_ENV_VAR[provider];
}

export function hasProviderApiKeyEnv(
  provider: ProviderKind,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const envVar = providerApiKeyEnvVar(provider);
  return Boolean(envVar && env[envVar]?.trim());
}

export interface ProviderSignInCommand {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

// Only providers with a confirmed non-interactive-friendly login command (verified
// via `<cli> auth login --help` / `<cli> login --help` against installed CLIs, or
// documented CLI behavior for codex) get a "Sign in" button. Gemini, Grok, and Droid
// don't have a confirmed headless login path from this environment, so they rely on
// the API key field above plus the existing "run the CLI locally" guidance.
export function resolveProviderSignInCommand(
  provider: ProviderKind,
  binaryPath: string | undefined,
): ProviderSignInCommand | null {
  const executable = binaryPath?.trim();
  switch (provider) {
    case "codex":
      return { command: executable || "codex", args: ["login"] };
    case "claudeAgent":
      return { command: executable || "claude", args: ["auth", "login"] };
    case "cursor":
      return { command: executable || "cursor-agent", args: ["login"] };
    case "poolside":
      // `pool setup` handles both first-run deployment selection and
      // authentication. Existing users can still re-authenticate with
      // `pool login` from their terminal without Modesto owning credentials.
      return { command: executable || "pool", args: ["setup"] };
    default:
      return null;
  }
}

export function isSignInSupportedProvider(provider: ProviderKind): boolean {
  return resolveProviderSignInCommand(provider, undefined) !== null;
}

export function providerApiKeySecretName(provider: ProviderKind): string {
  return `providerApiKey:${provider}`;
}

// Every provider check and every real session spawn in this codebase reads its
// credential env var from inherited `process.env` (see claudeProcessEnv.ts,
// codexProcessEnv.ts, GrokAcpSupport.ts, DroidAcpSupport.ts, geminiAcpProbe.ts).
// Mutating `process.env` here — instead of threading an override through each of
// those independently — is what makes a saved key take effect identically for
// both health checks and real sessions, with no per-adapter plumbing.
export function applyStoredApiKeyToProcessEnv(input: {
  readonly provider: ProviderKind;
  readonly apiKey: string | null;
  // At server boot, an env var the user set outside Modesto should win over a
  // previously-saved key. At runtime (the user just pasted a key in Settings),
  // the explicit action always applies immediately.
  readonly onlyIfUnset?: boolean;
}): void {
  const envVar = providerApiKeyEnvVar(input.provider);
  if (!envVar) {
    return;
  }
  if (input.apiKey === null) {
    delete process.env[envVar];
    return;
  }
  if (input.onlyIfUnset && process.env[envVar]?.trim()) {
    return;
  }
  process.env[envVar] = input.apiKey;
}
