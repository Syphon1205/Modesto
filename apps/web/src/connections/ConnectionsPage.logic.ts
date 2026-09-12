// FILE: ConnectionsPage.logic.ts
// Purpose: What the Connections page shows - which apps survive the current
//          filter, how they group, and the counts the header reports.
// Layer: Connections UI (pure)
//
// Search deliberately reuses `matchWebAppMentions`, the same ranked, typo
// tolerant matcher the composer's `@` menu uses. Typing `slak` in the composer
// and typing `slak` here should find Slack the same way; a second hand-rolled
// `includes()` filter on this page would drift from that within a release.

import { NATIVE_APPS, searchNativeAppMentions, type NativeApp } from "@modesto/shared/nativeApps";

import {
  findMarketplaceItemById,
  findMarketplaceMcpItemByServerName,
  marketplaceInstallClipboardText,
  type MarketplaceItem,
} from "./connectionsCatalog";
import {
  matchWebAppMentions,
  type WebApp,
  type WebAppCategory,
  webAppMentionLabel,
} from "./webApps";
import { WEB_APPS } from "./webApps";
import type { WebAppConnectionStatuses } from "./useWebAppConnections";

export type ConnectionsCategoryFilter = WebAppCategory | "all" | "adobe";

export const CATEGORY_LABELS: Readonly<Record<WebAppCategory, string>> = {
  email: "Email",
  docs: "Docs",
  calendar: "Calendar",
  chat: "Chat",
  storage: "Files",
  dev: "Engineering",
  crm: "CRM",
  design: "Design",
  support: "Support",
  commerce: "Commerce",
};

export const CATEGORY_ORDER: ReadonlyArray<WebAppCategory> = [
  "crm",
  "email",
  "chat",
  "storage",
  "docs",
  "calendar",
  "design",
  "support",
  "commerce",
  "dev",
];

export const ADOBE_CATEGORY_LABEL = "Adobe";

export const NATIVE_APP_CARD_DESCRIPTION: Readonly<Record<NativeApp["id"], string>> = {
  photoshop: "Edit photos, composites, and layered files.",
  "after-effects": "Motion graphics and visual effects on the timeline.",
  illustrator: "Draw vectors, logos, and illustration work.",
  "premiere-pro": "Edit video sequences and export cuts.",
  indesign: "Layout pages, decks, and print documents.",
  lightroom: "Culling, color, and photo library work.",
  acrobat: "Read, mark up, and export PDFs.",
  audition: "Edit audio, dialogue, and mix stems.",
  "media-encoder": "Queue and encode Adobe media exports.",
  bridge: "Browse and organize Creative Cloud files.",
  animate: "Timeline animation and interactive assets.",
  xd: "Prototype screens and interaction flows.",
};

export interface ConnectionsGroup {
  readonly id: WebAppCategory;
  readonly label: string;
  readonly apps: ReadonlyArray<WebApp>;
}

/**
 * Apps matching the current query and category.
 *
 * An empty query keeps catalog order, which is curated; a non-empty one keeps
 * match rank, so the best hit is first even after the category cut.
 */
export function filterConnectionApps(input: {
  readonly query: string;
  readonly category: ConnectionsCategoryFilter;
}): ReadonlyArray<WebApp> {
  const query = input.query.trim();
  const ranked = query.length === 0 ? WEB_APPS : matchWebAppMentions(query);
  return input.category === "all"
    ? ranked
    : ranked.filter((app) => app.category === input.category);
}

/** Matching apps bucketed by category, in `CATEGORY_ORDER`, empty groups dropped. */
export function groupConnectionApps(apps: ReadonlyArray<WebApp>): ReadonlyArray<ConnectionsGroup> {
  return CATEGORY_ORDER.flatMap((id) => {
    const inGroup = apps.filter((app) => app.category === id);
    return inGroup.length > 0 ? [{ id, label: CATEGORY_LABELS[id], apps: inGroup }] : [];
  });
}

/** Desktop Adobe apps matching the current query and category. */
export function filterConnectionNativeApps(input: {
  readonly query: string;
  readonly category: ConnectionsCategoryFilter;
}): ReadonlyArray<NativeApp> {
  if (input.category !== "all" && input.category !== "adobe") {
    return [];
  }
  const query = input.query.trim();
  const ranked =
    query.length === 0 ? NATIVE_APPS : searchNativeAppMentions(query).map((match) => match.app);
  return ranked;
}

/** How many apps each category filter would show for the current query. */
export function categoryMatchCounts(
  query: string,
): Readonly<Record<ConnectionsCategoryFilter, number>> {
  const matched = filterConnectionApps({ query, category: "all" });
  const nativeMatched = filterConnectionNativeApps({ query, category: "all" });
  const counts: Record<string, number> = { all: matched.length + nativeMatched.length };
  for (const id of CATEGORY_ORDER) {
    counts[id] = matched.filter((app) => app.category === id).length;
  }
  counts.adobe = nativeMatched.length;
  return counts as Readonly<Record<ConnectionsCategoryFilter, number>>;
}

/** Signed-in tally for the hero. `checking` is not counted - it is not yet an answer. */
export function countConnectedApps(statuses: WebAppConnectionStatuses): number {
  return WEB_APPS.filter((app) => statuses[app.id]?.kind === "connected").length;
}

/**
 * Whether this build can answer "signed in?" at all. On the web build every
 * probe reports `unavailable`, and a "0 signed in" headline would read as a
 * fact about the user's accounts rather than about the build.
 */
export function canReportSignIn(statuses: WebAppConnectionStatuses): boolean {
  return WEB_APPS.some((app) => statuses[app.id]?.kind !== "unavailable");
}

export type ConnectionCopyPayload = {
  readonly key: string;
  readonly text: string;
  readonly kind: "mcp" | "mention";
};

function marketplaceItemForWebApp(app: WebApp): MarketplaceItem | undefined {
  if (app.mcpServerName) {
    const byServer = findMarketplaceMcpItemByServerName(app.mcpServerName);
    if (byServer) return byServer;
  }
  return findMarketplaceItemById(app.id);
}

/** What a Connections card copies: an MCP install prompt when we have one. */
export function connectionCopyForWebApp(app: WebApp): ConnectionCopyPayload {
  const item = marketplaceItemForWebApp(app);
  const mcpText = item ? marketplaceInstallClipboardText(item) : null;
  if (mcpText) {
    return { key: `mcp:${app.id}`, text: mcpText, kind: "mcp" };
  }
  const mention = webAppMentionLabel(app);
  return { key: `mention:${app.id}`, text: mention, kind: "mention" };
}

export function connectionCopyForMarketplaceItem(
  item: MarketplaceItem,
): ConnectionCopyPayload | null {
  const text = marketplaceInstallClipboardText(item);
  if (!text) return null;
  return { key: `mcp:${item.id}`, text, kind: "mcp" };
}
