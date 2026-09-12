import type { PullRequestInvolvement, PullRequestListFilters } from "@modesto/contracts";

import type { EnvironmentPullRequestEntry } from "./pullRequestList.logic";
import { pullRequestEntryKey } from "./pullRequestList.logic";

export type PullRequestInboxTray = "inbox" | "saved" | "done";
export type PullRequestInboxReason =
  | "assigned"
  | "participating"
  | "mentioned"
  | "review-requested"
  | "authored";
export type PullRequestInboxSort = "newest" | "oldest";
export type PullRequestInboxGroup = "date" | "none";

export type PullRequestInboxRecord = {
  readonly tray: PullRequestInboxTray;
  readonly readAt: string | null;
};

export type PullRequestInboxState = Record<string, PullRequestInboxRecord>;

const STORAGE_KEY = "t3.pullRequests.inbox";

export function inboxRecordKey(
  entry: Pick<EnvironmentPullRequestEntry, "environmentId" | "host" | "repository" | "number">,
): string {
  return `${entry.environmentId}:${entry.host}:${entry.repository}#${entry.number}`;
}

export function readPullRequestInbox(
  storage: Pick<Storage, "getItem"> | undefined,
): PullRequestInboxState {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PullRequestInboxState;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writePullRequestInbox(
  storage: Pick<Storage, "setItem"> | undefined,
  state: PullRequestInboxState,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode — the session still holds the in-memory store.
  }
}

export function inboxRecordFor(
  state: PullRequestInboxState | undefined,
  entry: EnvironmentPullRequestEntry | null | undefined,
): PullRequestInboxRecord {
  if (entry == null || state == null || typeof state !== "object") {
    return { tray: "inbox", readAt: null };
  }
  return state[inboxRecordKey(entry)] ?? { tray: "inbox", readAt: null };
}

export function isInboxUnread(
  state: PullRequestInboxState,
  entry: EnvironmentPullRequestEntry,
): boolean {
  return inboxRecordFor(state, entry).readAt === null;
}

export function filterInboxEntries(
  entries: ReadonlyArray<EnvironmentPullRequestEntry>,
  input: {
    readonly state: PullRequestInboxState;
    readonly tray: PullRequestInboxTray;
    readonly unreadOnly: boolean;
    readonly repository?: string;
    readonly sort: PullRequestInboxSort;
  },
): ReadonlyArray<EnvironmentPullRequestEntry> {
  if (!Array.isArray(entries)) return [];
  const repository = input.repository?.toLowerCase();
  const next = entries.filter((entry) => {
    if (entry == null) return false;
    const record = inboxRecordFor(input.state, entry);
    if (record.tray !== input.tray) return false;
    if (input.unreadOnly && record.readAt !== null) return false;
    if (repository && entry.repository?.toLowerCase() !== repository) return false;
    return true;
  });
  return [...next].sort((left, right) => {
    const delta = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    return input.sort === "oldest" ? -delta : delta;
  });
}

export function inboxUnreadCount(
  entries: ReadonlyArray<EnvironmentPullRequestEntry>,
  state: PullRequestInboxState,
  tray: PullRequestInboxTray = "inbox",
): number {
  if (!Array.isArray(entries)) return 0;
  return entries.filter((entry) => {
    if (entry == null) return false;
    const record = inboxRecordFor(state, entry);
    return record.tray === tray && record.readAt === null;
  }).length;
}

/** Review requested, or authored by the signed-in viewer. Ghost authors have no login. */
export function inboxEntryHasViewerStake(
  entry: EnvironmentPullRequestEntry | null | undefined,
  viewer: string | null | undefined,
): boolean {
  if (entry == null) return false;
  if (entry.viewerReviewRequested) return true;
  const login = entry.author?.login;
  return (
    typeof viewer === "string" &&
    typeof login === "string" &&
    login.toLowerCase() === viewer.toLowerCase()
  );
}

export function inboxRepositoryCounts(
  entries: ReadonlyArray<EnvironmentPullRequestEntry>,
  state: PullRequestInboxState,
): ReadonlyArray<{ readonly repository: string; readonly unread: number; readonly total: number }> {
  const byRepo = new Map<string, { unread: number; total: number }>();
  if (!Array.isArray(entries)) return [];
  for (const entry of entries) {
    if (entry == null) continue;
    if (inboxRecordFor(state, entry).tray !== "inbox") continue;
    const current = byRepo.get(entry.repository) ?? { unread: 0, total: 0 };
    current.total += 1;
    if (isInboxUnread(state, entry)) current.unread += 1;
    byRepo.set(entry.repository, current);
  }
  return [...byRepo]
    .map(([repository, counts]) => ({ repository, ...counts }))
    .toSorted(
      (left, right) =>
        right.unread - left.unread || left.repository.localeCompare(right.repository),
    );
}

export type InboxDateGroup = {
  readonly key: string;
  readonly label: string;
  readonly entries: ReadonlyArray<EnvironmentPullRequestEntry>;
};

export function groupInboxByDate(
  entries: ReadonlyArray<EnvironmentPullRequestEntry>,
  now = Date.now(),
): ReadonlyArray<InboxDateGroup> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const yesterday = today - 86_400_000;
  const week = today - 6 * 86_400_000;
  const buckets: Record<string, EnvironmentPullRequestEntry[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };
  for (const entry of entries) {
    const at = Date.parse(entry.updatedAt);
    if (Number.isNaN(at) || at >= today) buckets.today?.push(entry);
    else if (at >= yesterday) buckets.yesterday?.push(entry);
    else if (at >= week) buckets.week?.push(entry);
    else buckets.older?.push(entry);
  }
  return [
    { key: "today", label: "Today", entries: buckets.today ?? [] },
    { key: "yesterday", label: "Yesterday", entries: buckets.yesterday ?? [] },
    { key: "week", label: "This week", entries: buckets.week ?? [] },
    { key: "older", label: "Older", entries: buckets.older ?? [] },
  ].filter((group) => group.entries.length > 0);
}

export function involvementForInboxReason(
  reason: PullRequestInboxReason | undefined,
): PullRequestInvolvement {
  if (reason === "review-requested") return "reviewing";
  if (reason === "authored") return "authored";
  return "all";
}

/** Host search qualifiers that make Assigned / Mentioned / Participating mean those words. */
export function inboxReasonFilters(
  reason: PullRequestInboxReason | undefined,
): Pick<PullRequestListFilters, "assignee" | "mentions" | "involves"> {
  if (reason === "assigned") return { assignee: "me" };
  if (reason === "mentioned") return { mentions: "me" };
  if (reason === "participating") return { involves: "me" };
  return {};
}

export function parseInboxTray(raw: unknown): PullRequestInboxTray {
  return raw === "saved" || raw === "done" ? raw : "inbox";
}

export function parseInboxReason(raw: unknown): PullRequestInboxReason | undefined {
  return raw === "assigned" ||
    raw === "participating" ||
    raw === "mentioned" ||
    raw === "review-requested" ||
    raw === "authored"
    ? raw
    : undefined;
}

export function parseInboxSort(raw: unknown): PullRequestInboxSort {
  return raw === "oldest" ? "oldest" : "newest";
}

export function parseInboxGroup(raw: unknown): PullRequestInboxGroup {
  return raw === "none" ? "none" : "date";
}

export function parseInboxUnread(raw: unknown): boolean {
  return raw === true || raw === "1" || raw === "true";
}

export { pullRequestEntryKey };
