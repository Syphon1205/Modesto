import { create } from "zustand";

import type { EnvironmentPullRequestEntry } from "./pullRequestList.logic";
import {
  inboxRecordKey,
  readPullRequestInbox,
  writePullRequestInbox,
  type PullRequestInboxRecord,
  type PullRequestInboxState,
  type PullRequestInboxTray,
} from "./pullRequestInbox.logic";

interface PullRequestInboxStore {
  readonly records: PullRequestInboxState;
  readonly markRead: (entry: EnvironmentPullRequestEntry) => void;
  readonly markUnread: (entry: EnvironmentPullRequestEntry) => void;
  readonly setTray: (entry: EnvironmentPullRequestEntry, tray: PullRequestInboxTray) => void;
}

function persist(records: PullRequestInboxState): PullRequestInboxState {
  writePullRequestInbox(typeof window === "undefined" ? undefined : window.localStorage, records);
  return records;
}

function patch(
  state: PullRequestInboxState,
  entry: EnvironmentPullRequestEntry,
  next: Partial<PullRequestInboxRecord>,
): PullRequestInboxState {
  const key = inboxRecordKey(entry);
  const current = state[key] ?? { tray: "inbox" as const, readAt: null };
  return { ...state, [key]: { ...current, ...next } };
}

export const usePullRequestInboxStore = create<PullRequestInboxStore>((set) => ({
  records: readPullRequestInbox(typeof window === "undefined" ? undefined : window.localStorage),
  markRead: (entry) => {
    set((state) => ({
      records: persist(patch(state.records, entry, { readAt: new Date().toISOString() })),
    }));
  },
  markUnread: (entry) => {
    set((state) => ({ records: persist(patch(state.records, entry, { readAt: null })) }));
  },
  setTray: (entry, tray) => {
    set((state) => ({
      records: persist(
        patch(state.records, entry, {
          tray,
          readAt:
            tray === "inbox"
              ? (state.records[inboxRecordKey(entry)]?.readAt ?? null)
              : new Date().toISOString(),
        }),
      ),
    }));
  },
}));
