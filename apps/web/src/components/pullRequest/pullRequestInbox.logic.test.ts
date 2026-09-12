import { EnvironmentId, ProjectId } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  filterInboxEntries,
  groupInboxByDate,
  inboxEntryHasViewerStake,
  inboxReasonFilters,
  inboxUnreadCount,
  involvementForInboxReason,
} from "./pullRequestInbox.logic";
import type { EnvironmentPullRequestEntry } from "./pullRequestList.logic";

function entry(input: {
  number: number;
  repository?: string;
  updatedAt: string;
}): EnvironmentPullRequestEntry {
  return {
    environmentId: EnvironmentId.make("env"),
    provider: "github",
    host: "github.com",
    projectId: ProjectId.make("proj"),
    projectTitle: "App",
    repository: input.repository ?? "acme/app",
    number: input.number,
    title: `PR ${input.number}`,
    url: `https://github.com/acme/app/pull/${input.number}`,
    author: { login: "octocat", name: null, avatarUrl: null },
    headBranch: "feat",
    baseBranch: "main",
    state: "open",
    isDraft: false,
    mergeability: "unknown",
    additions: 0,
    deletions: 0,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    viewerReviewRequested: false,
    labels: [],
  } as EnvironmentPullRequestEntry;
}

describe("pull request inbox", () => {
  it("maps notification reasons onto the host involvement the list already asks for", () => {
    expect(involvementForInboxReason("review-requested")).toBe("reviewing");
    expect(involvementForInboxReason("authored")).toBe("authored");
    expect(involvementForInboxReason("assigned")).toBe("all");
    expect(involvementForInboxReason(undefined)).toBe("all");
    expect(inboxReasonFilters("assigned")).toEqual({ assignee: "me" });
    expect(inboxReasonFilters("mentioned")).toEqual({ mentions: "me" });
    expect(inboxReasonFilters("participating")).toEqual({ involves: "me" });
    expect(inboxReasonFilters("review-requested")).toEqual({});
  });

  it("keeps unread inbox rows and hides ones marked done or read", () => {
    const open = entry({ number: 1, updatedAt: "2026-09-04T12:00:00.000Z" });
    const done = entry({ number: 2, updatedAt: "2026-09-04T11:00:00.000Z" });
    const read = entry({ number: 3, updatedAt: "2026-09-04T10:00:00.000Z" });
    const state = {
      "env:github.com:acme/app#2": { tray: "done" as const, readAt: "2026-09-04T12:00:00.000Z" },
      "env:github.com:acme/app#3": { tray: "inbox" as const, readAt: "2026-09-04T12:00:00.000Z" },
    };
    expect(
      filterInboxEntries([open, done, read], {
        state,
        tray: "inbox",
        unreadOnly: true,
        sort: "newest",
      }).map((row) => row.number),
    ).toEqual([1]);
    expect(inboxUnreadCount([open, done, read], state)).toBe(1);
  });

  it("groups threads by the day they last moved", () => {
    const now = Date.parse("2026-09-04T18:00:00.000Z");
    const groups = groupInboxByDate(
      [
        entry({ number: 1, updatedAt: "2026-09-04T12:00:00.000Z" }),
        entry({ number: 2, updatedAt: "2026-09-03T12:00:00.000Z" }),
        entry({ number: 3, updatedAt: "2026-08-20T12:00:00.000Z" }),
      ],
      now,
    );
    expect(groups.map((group) => group.label)).toEqual(["Today", "Yesterday", "Older"]);
  });

  it("does not treat a ghost author as the viewer", () => {
    const ghost = { ...entry({ number: 4, updatedAt: "2026-09-04T12:00:00.000Z" }), author: null };
    expect(inboxEntryHasViewerStake(ghost, "octocat")).toBe(false);
    expect(inboxEntryHasViewerStake({ ...ghost, viewerReviewRequested: true }, "octocat")).toBe(
      true,
    );
  });

  it("does not call methods on a null viewer", () => {
    const row = entry({ number: 5, updatedAt: "2026-09-04T12:00:00.000Z" });
    expect(inboxEntryHasViewerStake(row, null)).toBe(false);
    expect(inboxEntryHasViewerStake(row, undefined)).toBe(false);
    expect(inboxEntryHasViewerStake(null, "octocat")).toBe(false);
  });
});
