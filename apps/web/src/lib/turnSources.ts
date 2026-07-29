// FILE: turnSources.ts
// Purpose: Derive a deduplicated list of web sources for an assistant turn.
// Layer: Web utility
// Exports: extractTurnSources, TurnSource

import {
  describeLinkChip,
  normalizeComposerLinkUrl,
  trimTrailingLinkPunctuation,
} from "~/lib/linkChips";
import { extractWebFetchUrl } from "~/lib/toolCallLabel";

export type TurnSourceKind = "web_search" | "web_fetch" | "citation";

export interface TurnSource {
  readonly url: string;
  readonly title: string;
  readonly domain: string;
  readonly sourceKind: TurnSourceKind;
}

export interface TurnSourceWorkEntry {
  readonly itemType?: string | null | undefined;
  readonly toolName?: string | null | undefined;
  readonly detail?: string | null | undefined;
  readonly data?: Record<string, unknown> | null | undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function canonicalSourceKey(url: string): string | null {
  const normalized = normalizeComposerLinkUrl(trimTrailingLinkPunctuation(url));
  if (!normalized || !/^https?:\/\//i.test(normalized)) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    parsed.hash = "";
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${host}${pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function domainForUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return describeLinkChip(url).label;
  }
}

function titleForUrl(url: string, preferredTitle: string | null): string {
  const trimmed = preferredTitle?.trim();
  if (trimmed && trimmed.length > 0 && !/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return describeLinkChip(url).label;
}

function preferCanonicalUrl(url: string): string {
  const normalized = normalizeComposerLinkUrl(trimTrailingLinkPunctuation(url)) ?? url;
  try {
    const parsed = new URL(normalized);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.replace(/^www\./i, "");
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch {
    return normalized;
  }
}

function pushSource(
  byKey: Map<string, TurnSource>,
  input: {
    url: string;
    title?: string | null;
    sourceKind: TurnSourceKind;
  },
): void {
  const key = canonicalSourceKey(input.url);
  if (!key) return;
  const url = preferCanonicalUrl(input.url);
  const existing = byKey.get(key);
  if (existing) {
    if (
      input.title &&
      input.title.trim().length > 0 &&
      existing.title === describeLinkChip(existing.url).label
    ) {
      byKey.set(key, {
        ...existing,
        title: titleForUrl(existing.url, input.title),
      });
    }
    return;
  }
  byKey.set(key, {
    url,
    title: titleForUrl(url, input.title ?? null),
    domain: domainForUrl(url),
    sourceKind: input.sourceKind,
  });
}

function collectFromUnknownResult(byKey: Map<string, TurnSource>, value: unknown): void {
  if (typeof value === "string") {
    const urlMatch = /https?:\/\/[^\s"'<>)\]}]+/i.exec(value)?.[0];
    if (urlMatch) {
      pushSource(byKey, { url: urlMatch, sourceKind: "web_search" });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectFromUnknownResult(byKey, entry);
    }
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const url =
    asString(record.url) ??
    asString(record.link) ??
    asString(record.href) ??
    asString(record.uri);
  if (url) {
    pushSource(byKey, {
      url,
      title: asString(record.title) ?? asString(record.name),
      sourceKind: "web_search",
    });
  }
  for (const nestedKey of ["results", "items", "sources", "citations"] as const) {
    if (nestedKey in record) {
      collectFromUnknownResult(byKey, record[nestedKey]);
    }
  }
}

function collectFromWebSearchData(byKey: Map<string, TurnSource>, data: Record<string, unknown>) {
  const item = asRecord(data.item) ?? data;
  const action = asRecord(item.action);
  const actionUrl = asString(action?.url);
  if (actionUrl) {
    pushSource(byKey, {
      url: actionUrl,
      title: asString(item.title) ?? asString(action?.title),
      sourceKind: "web_search",
    });
  }
  collectFromUnknownResult(byKey, item.results ?? data.results);
}

function collectMarkdownCitations(byKey: Map<string, TurnSource>, text: string | null | undefined) {
  if (!text) return;
  const markdownLinkRegex = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const url = match[1];
    if (!url) continue;
    pushSource(byKey, { url, sourceKind: "citation" });
  }
  const bareUrlRegex = /(?<![\w(/])https?:\/\/[^\s"'<>)\]}]+/gi;
  while ((match = bareUrlRegex.exec(text)) !== null) {
    const url = match[0];
    if (!url) continue;
    pushSource(byKey, { url, sourceKind: "citation" });
  }
}

/** Collects and deduplicates HTTP(S) sources for one assistant turn. */
export function extractTurnSources(input: {
  readonly workEntries?: ReadonlyArray<TurnSourceWorkEntry> | null | undefined;
  readonly assistantText?: string | null | undefined;
}): ReadonlyArray<TurnSource> {
  const byKey = new Map<string, TurnSource>();

  for (const entry of input.workEntries ?? []) {
    if (entry.itemType === "web_search" && entry.data) {
      collectFromWebSearchData(byKey, entry.data);
    }

    const fetchUrl = extractWebFetchUrl({
      toolName: entry.toolName,
      detail: entry.detail,
    });
    if (fetchUrl) {
      pushSource(byKey, { url: fetchUrl, sourceKind: "web_fetch" });
    }

    if (entry.itemType === "web_search" && entry.detail) {
      const detailUrl = /https?:\/\/[^\s"'<>)\]}]+/i.exec(entry.detail)?.[0];
      if (detailUrl) {
        pushSource(byKey, { url: detailUrl, sourceKind: "web_search" });
      }
    }
  }

  collectMarkdownCitations(byKey, input.assistantText);
  return [...byKey.values()];
}
