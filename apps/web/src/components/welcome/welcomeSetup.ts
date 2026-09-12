// FILE: welcomeSetup.ts
// Purpose: Pure logic behind the first-run setup tour — which revision the
//          tour is on, whether it is owed to this client, how its steps
//          advance, and how the agent roster reads as a single summary line.
//          Kept free of React so every decision here is directly testable.

import { isProviderAvailable, type ServerProvider } from "@modesto/contracts";

/**
 * Revision of the setup tour. Bump this when setup starts covering something
 * materially new (a step, a decision the user should revisit) and every client
 * that finished an older revision is offered the tour once more. Do not bump
 * it for copy tweaks — re-opening a dialog people already dismissed is a cost.
 */
export const WELCOME_SETUP_VERSION = "0.5.0";

export type WelcomeSetupStepId = "welcome" | "appearance" | "agents" | "avatar" | "ready";

export const WELCOME_SETUP_STEPS: ReadonlyArray<WelcomeSetupStepId> = [
  "welcome",
  "appearance",
  "agents",
  "avatar",
  "ready",
];

export const WELCOME_SETUP_STEP_LABELS: Record<WelcomeSetupStepId, string> = {
  welcome: "Welcome",
  appearance: "Appearance",
  agents: "Agents",
  avatar: "Your agent",
  ready: "Ready",
};

/**
 * Whether the tour is owed to this client.
 *
 * Gated on hydration: the pre-hydration snapshot is the schema defaults, where
 * `welcomeSetupCompletedVersion` is `""` — opening on that would flash the
 * tour at every returning user on every cold load.
 */
export function shouldOpenWelcomeSetup(input: {
  readonly hydrated: boolean;
  readonly completedVersion: string;
  readonly currentVersion?: string;
}): boolean {
  if (!input.hydrated) return false;
  const currentVersion = input.currentVersion ?? WELCOME_SETUP_VERSION;
  return input.completedVersion.trim() !== currentVersion;
}

export function welcomeSetupStepIndex(step: WelcomeSetupStepId): number {
  const index = WELCOME_SETUP_STEPS.indexOf(step);
  return index === -1 ? 0 : index;
}

/**
 * Step `delta` places away, clamped to the ends. Clamping rather than
 * wrapping: "Back" on the first step is a no-op, never a jump to the finish.
 */
export function advanceWelcomeSetupStep(
  step: WelcomeSetupStepId,
  delta: number,
): WelcomeSetupStepId {
  const target = welcomeSetupStepIndex(step) + delta;
  const clamped = Math.min(Math.max(target, 0), WELCOME_SETUP_STEPS.length - 1);
  return WELCOME_SETUP_STEPS[clamped] ?? step;
}

export function isFinalWelcomeSetupStep(step: WelcomeSetupStepId): boolean {
  return welcomeSetupStepIndex(step) === WELCOME_SETUP_STEPS.length - 1;
}

export type WelcomeAgentReadiness = "ready" | "attention" | "missing";

export interface WelcomeAgentSummary {
  readonly readiness: WelcomeAgentReadiness;
  readonly detail: string;
}

/**
 * One-line status for a provider instance, in the tour's own vocabulary
 * (installed / signed in / neither) rather than the settings page's fuller
 * status language. Drivers this build does not ship are excluded upstream by
 * `selectWelcomeAgentProviders`.
 */
export function summarizeWelcomeAgent(provider: ServerProvider): WelcomeAgentSummary {
  if (!provider.installed) {
    return { readiness: "missing", detail: "CLI not found on PATH" };
  }
  if (!provider.enabled) {
    return { readiness: "attention", detail: "Installed, turned off" };
  }
  if (provider.auth.status === "unauthenticated") {
    return { readiness: "attention", detail: "Installed, not signed in" };
  }
  if (provider.status === "error") {
    return { readiness: "attention", detail: "Startup checks failed" };
  }
  if (provider.status === "warning") {
    return { readiness: "attention", detail: "Needs attention" };
  }
  return { readiness: "ready", detail: "Ready to use" };
}

/**
 * Providers worth showing in the tour: available drivers only, ready ones
 * first so a new user sees what already works before what does not.
 */
export function selectWelcomeAgentProviders(
  providers: ReadonlyArray<ServerProvider>,
): ReadonlyArray<ServerProvider> {
  const rank: Record<WelcomeAgentReadiness, number> = { ready: 0, attention: 1, missing: 2 };
  return providers
    .filter(isProviderAvailable)
    .toSorted(
      (left, right) =>
        rank[summarizeWelcomeAgent(left).readiness] - rank[summarizeWelcomeAgent(right).readiness],
    );
}

/**
 * Driver kind → brand mark file under `/brand/marks`. Kept as an explicit map
 * rather than `${driver}.svg`: the slugs and the asset names genuinely differ
 * (`claudeAgent`/`claude`, `githubCopilot`/`copilot`, `customAcp`/`acp`), and a
 * driver with no mark should fall back rather than request a 404.
 */
const WELCOME_PROVIDER_MARKS: Readonly<Record<string, string>> = {
  codex: "codex",
  claudeAgent: "claude",
  cursor: "cursor",
  grok: "grok",
  gemini: "gemini",
  meta: "meta",
  opencode: "opencode",
  kilo: "kilo",
  kimi: "kimi",
  qwen: "qwen",
  poolside: "poolside",
  devin: "devin",
  githubCopilot: "copilot",
  droid: "droid",
  pi: "pi",
  customAcp: "acp",
};

export function welcomeProviderMarkUrl(driver: string): string | null {
  const mark = WELCOME_PROVIDER_MARKS[driver];
  return mark === undefined ? null : `/brand/marks/${mark}.svg`;
}

/**
 * Sentinel id for the palette Modesto wears with no theme installed. It is not
 * in `BUILT_IN_THEMES` — the app expresses "no theme" as a bare appearance
 * preference — so the picker carries it explicitly rather than silently
 * offering four themes and hiding the default the user is probably on.
 */
export const WELCOME_DEFAULT_THEME_ID = "default";

/**
 * The theme preference to persist for a picked tile. Choosing the default
 * clears the theme and leaves the appearance mode standing, which is how
 * Settings → Appearance expresses the same choice.
 */
export function resolveWelcomeThemeSelection(input: {
  readonly themeId: string;
  readonly appearanceMode: string;
}): string {
  if (input.themeId !== WELCOME_DEFAULT_THEME_ID) return input.themeId;
  return input.appearanceMode === "system" ? "system" : input.appearanceMode;
}

/**
 * Whether the default tile is the active one. A theme preference that names no
 * installed theme — `system`, `light`, `dark`, or anything unrecognised — is
 * the default palette.
 */
export function isWelcomeDefaultThemeActive(input: {
  readonly selectedId: string;
  readonly installedThemeIds: ReadonlyArray<string>;
}): boolean {
  return !input.installedThemeIds.includes(input.selectedId);
}

export interface WelcomeRingLayout {
  /** Edge length of each provider tile, in px. */
  readonly tilePx: number;
  /** Orbit radius as a CSS length, resolved against the ring container. */
  readonly radius: string;
  /** Angle of each tile, in degrees, first one at twelve o'clock. */
  readonly angles: ReadonlyArray<number>;
}

/**
 * Geometry for the agent-select ring.
 *
 * The radius is expressed in container units, never percentages: inside
 * `translate()` a percentage resolves against the *tile*, so a percentage
 * radius collapses every tile into a pile at the centre.
 */
export function welcomeRingLayout(count: number): WelcomeRingLayout {
  const tilePx = count > 10 ? 68 : count > 7 ? 76 : 88;
  const radius = count > 10 ? "min(41cqmin, 224px)" : "min(37cqmin, 208px)";
  const angles = Array.from({ length: Math.max(count, 0) }, (_, index) =>
    count === 0 ? 0 : (index / count) * 360 - 90,
  );
  return { tilePx, radius, angles };
}

export interface WelcomeAgentRosterSummary {
  readonly readyCount: number;
  readonly installedCount: number;
  readonly totalCount: number;
  readonly headline: string;
  readonly detectedLabel: string | null;
}

export function formatWelcomeDetectedLabel(installedCount: number): string | null {
  if (installedCount <= 0) return null;
  return installedCount === 1 ? "Detected 1 provider" : `Detected ${installedCount} providers`;
}

export function summarizeWelcomeAgentRoster(
  providers: ReadonlyArray<ServerProvider>,
): WelcomeAgentRosterSummary {
  const available = providers.filter(isProviderAvailable);
  const readyCount = available.filter(
    (provider) => summarizeWelcomeAgent(provider).readiness === "ready",
  ).length;
  const installedCount = available.filter((provider) => provider.installed).length;
  const totalCount = available.length;
  const detectedLabel = formatWelcomeDetectedLabel(installedCount);

  if (totalCount === 0) {
    return {
      readyCount,
      installedCount,
      totalCount,
      detectedLabel,
      headline: "Checking which agents are installed…",
    };
  }
  if (readyCount === 0) {
    return {
      readyCount,
      installedCount,
      totalCount,
      detectedLabel,
      headline: "No agents are ready yet — install or sign in to one to start a thread.",
    };
  }
  return {
    readyCount,
    installedCount,
    totalCount,
    detectedLabel,
    headline:
      readyCount === 1 ? "1 agent is ready to go." : `${readyCount} agents are ready to go.`,
  };
}
