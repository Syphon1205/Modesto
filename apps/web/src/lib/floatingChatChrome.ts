import { useSearch } from "@tanstack/react-router";

import type { ThreadRouteTarget } from "../threadRoutes";

export const COMPACT_CHAT_CHROME = "compact";

export function isCompactChatChromeSearch(
  search: Record<string, unknown> | undefined,
): search is { chrome: "compact" } {
  return search?.chrome === COMPACT_CHAT_CHROME;
}

export function parseCompactChatSearch(search: Record<string, unknown>): {
  chrome?: "compact";
} & Record<string, unknown> {
  if (search.chrome === COMPACT_CHAT_CHROME) {
    return { ...search, chrome: COMPACT_CHAT_CHROME };
  }
  const { chrome: _chrome, ...rest } = search;
  return rest;
}

export function compactChatSearch(compact: boolean): { chrome?: "compact" } {
  return compact ? { chrome: COMPACT_CHAT_CHROME } : {};
}

export function useCompactChatChrome(): boolean {
  return useSearch({
    strict: false,
    select: (search) => isCompactChatChromeSearch(search),
  });
}

export function floatingChatRoutePath(target: ThreadRouteTarget): string {
  if (target.kind === "draft") {
    return `/draft/${target.draftId}?chrome=${COMPACT_CHAT_CHROME}`;
  }
  return `/${target.threadRef.environmentId}/${target.threadRef.threadId}?chrome=${COMPACT_CHAT_CHROME}`;
}

export async function openFloatingChat(target: ThreadRouteTarget): Promise<boolean> {
  const open = window.desktopBridge?.floatingChat?.open;
  if (typeof open !== "function") return false;
  await open(floatingChatRoutePath(target));
  return true;
}

export async function closeFloatingChat(): Promise<void> {
  const close = window.desktopBridge?.floatingChat?.close;
  if (typeof close !== "function") return;
  await close();
}
