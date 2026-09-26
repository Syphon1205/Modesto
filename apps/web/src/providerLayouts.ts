import type { InterfaceStyle } from "@modesto/contracts";

/**
 * Interface styles that reproduce another desktop agent app's shell: Claude
 * Code desktop, the Codex app, and the Cursor agents window. Every
 * provider-specific decision (sidebar shape, header, empty state, composer
 * arrangement, copy) keys off this one type so the three layouts cannot drift
 * into ad-hoc `interfaceStyle === "..."` checks scattered across components.
 */
export type ProviderLayout = "claude" | "codex" | "cursor";

const PROVIDER_LAYOUTS: ReadonlySet<string> = new Set<ProviderLayout>([
  "claude",
  "codex",
  "cursor",
]);

export function providerLayoutOf(style: InterfaceStyle): ProviderLayout | null {
  return PROVIDER_LAYOUTS.has(style) ? (style as ProviderLayout) : null;
}

export interface ProviderLayoutSpec {
  /** Default sidebar width in CSS pixels, measured from the reference apps. */
  readonly sidebarWidth: number;
  /** Prompt placeholder on a new, empty thread. */
  readonly draftPlaceholder: string;
  /** Prompt placeholder once a thread has messages. */
  readonly followUpPlaceholder: string;
  /** Primary sidebar action that starts a new thread. */
  readonly newThreadLabel: string;
}

export const PROVIDER_LAYOUT_SPECS: Readonly<Record<ProviderLayout, ProviderLayoutSpec>> = {
  claude: {
    sidebarWidth: 272,
    draftPlaceholder: "Describe a task or ask a question",
    followUpPlaceholder: "Type / for commands",
    newThreadLabel: "New",
  },
  codex: {
    sidebarWidth: 300,
    draftPlaceholder: "Ask Modesto anything. @ to use plugins or use files",
    followUpPlaceholder: "Ask for follow-up changes",
    newThreadLabel: "New chat",
  },
  cursor: {
    sidebarWidth: 256,
    draftPlaceholder: "Plan, Build, / for commands, @ for context",
    followUpPlaceholder: "Send follow-up",
    newThreadLabel: "New Agent",
  },
};

/** The Codex empty state names the project the next task will run in. */
export function codexDraftHeadline(projectTitle: string | null): string {
  return projectTitle ? `What should we build in ${projectTitle}?` : "What should we build?";
}

export type SidebarRecencyBucket = "Today" | "Yesterday" | "Older";

/** Claude Code desktop groups its session list by recency. */
export function sidebarRecencyBucket(
  isoDate: string,
  now: Date = new Date(),
): SidebarRecencyBucket {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Older";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();
  if (time >= startOfToday) return "Today";
  if (time >= startOfToday - 24 * 60 * 60 * 1000) return "Yesterday";
  return "Older";
}

/** Compact age label used by the Codex sidebar ("4m", "2h", "1w", "3mo"). */
export function compactAgeLabel(isoDate: string, now: Date = new Date()): string {
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.max(0, Math.floor((now.getTime() - time) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
