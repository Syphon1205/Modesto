import type { UsageProviderKind } from "@modesto/contracts";

import {
  ACPRegistryIcon,
  ClaudeAI,
  CursorIcon,
  DevinIcon,
  DroidIcon,
  Gemini,
  GithubCopilotIcon,
  GrokIcon,
  type Icon,
  KiloIcon,
  KimiIcon,
  MetaIcon,
  OpenAI,
  OpenCodeIcon,
  PiAgentIcon,
  PoolsideIcon,
  QwenIcon,
} from "../Icons";

type UsageProviderPresentation = {
  readonly label: string;
  readonly color: string;
  readonly mark: Icon;
  /**
   * True for providers with no real usage scanner (see `UsageSourceStatus`
   * `"unsupported"` in the contract) — the UI shows them in the legend/table
   * with an explanatory note instead of pretending they have zero usage.
   */
  readonly unsupported: boolean;
};

/**
 * Exhaustive presentation for providers supported by the usage contract.
 * Declaration order is reused by every chart, table, legend, and skeleton, so
 * adding a provider only requires its contract support and one entry here.
 */
export const PROVIDER_PRESENTATION = {
  codex: {
    label: "Codex",
    color: "var(--contrast-foreground)",
    mark: OpenAI,
    unsupported: false,
  },
  claude: {
    label: "Claude Code",
    color: "#d97757",
    mark: ClaudeAI,
    unsupported: false,
  },
  opencode: {
    label: "OpenCode",
    color: "#2dd4bf",
    mark: OpenCodeIcon,
    unsupported: false,
  },
  kilo: {
    label: "Kilo",
    color: "#faf74f",
    mark: KiloIcon,
    unsupported: false,
  },
  gemini: {
    label: "Gemini",
    color: "#4285f4",
    mark: Gemini,
    unsupported: false,
  },
  pi: {
    label: "Pi",
    color: "#22c55e",
    mark: PiAgentIcon,
    unsupported: false,
  },
  githubCopilot: {
    label: "GitHub Copilot",
    color: "#24292f",
    mark: GithubCopilotIcon,
    unsupported: false,
  },
  poolside: {
    label: "Poolside",
    color: "#0ea5e9",
    mark: PoolsideIcon,
    unsupported: false,
  },
  cursor: {
    label: "Cursor",
    color: "#8b8b8b",
    mark: CursorIcon,
    unsupported: false,
  },
  qwen: {
    label: "Qwen",
    color: "#6366f1",
    mark: QwenIcon,
    unsupported: true,
  },
  kimi: {
    label: "Kimi",
    color: "#f472b6",
    mark: KimiIcon,
    unsupported: true,
  },
  grok: {
    label: "Grok",
    color: "#a78bfa",
    mark: GrokIcon,
    unsupported: true,
  },
  meta: {
    label: "Meta",
    color: "#0082FB",
    mark: MetaIcon,
    unsupported: true,
  },
  devin: {
    label: "Devin",
    color: "#14b8a6",
    mark: DevinIcon,
    unsupported: true,
  },
  droid: {
    label: "Factory Droid",
    color: "#f97316",
    mark: DroidIcon,
    unsupported: true,
  },
  customAcp: {
    label: "Custom ACP",
    color: "#94a3b8",
    mark: ACPRegistryIcon,
    unsupported: true,
  },
} satisfies Record<UsageProviderKind, UsageProviderPresentation>;

/** Every provider kind the usage contract knows about, declaration order. */
export const ALL_PROVIDER_KINDS = Object.keys(PROVIDER_PRESENTATION) as UsageProviderKind[];

/**
 * Stable provider reading order across charts, summaries, tables, and hover
 * rows. Excludes `unsupported` providers (see {@link UsageProviderPresentation}):
 * they have no real numbers to plot, so a $0.00/0-token row would misrepresent
 * "no local usage data" as "confirmed zero usage." `UsageCoverageNotice`
 * explains the gap in prose instead.
 */
export const PROVIDER_ORDER = ALL_PROVIDER_KINDS.filter(
  (provider) => PROVIDER_PRESENTATION[provider].unsupported !== true,
);
