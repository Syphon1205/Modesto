import { describe, expect, it } from "vite-plus/test";

import { buildThreadActionMenuItems, type ThreadActionMenuState } from "./threadActionMenu.logic";

const baseState: ThreadActionMenuState = {
  branch: null,
  isPinned: false,
  isSettled: false,
  isSnoozed: false,
  canSnoozeNow: true,
  isRegeneratingTitle: false,
  isRunning: false,
  supports: { settlement: true, snooze: true, pinning: true, titleRegeneration: true },
  snoozePresets: [
    { id: "hour", label: "In 1 hour", whenLabel: "3:00 PM", snoozedUntil: "2026-08-07T15:00:00Z" },
  ],
};

function ids(state: ThreadActionMenuState): string[] {
  return buildThreadActionMenuItems(state).map((item) => item.id);
}

function allIds(state: ThreadActionMenuState): string[] {
  const flatten = (items: ReturnType<typeof buildThreadActionMenuItems>): string[] =>
    items.flatMap((item) => [item.id, ...(item.children ? flatten(item.children) : [])]);
  return flatten(buildThreadActionMenuItems(state));
}

describe("buildThreadActionMenuItems", () => {
  it("hides lifecycle items when the environment lacks the capabilities", () => {
    expect(
      ids({
        ...baseState,
        supports: { settlement: false, snooze: false, pinning: false, titleRegeneration: false },
      }),
    ).toEqual(["rename", "mark-unread", "copy", "archive", "delete"]);
  });

  it("includes branch items only for threads with a branch", () => {
    const withBranch = allIds({ ...baseState, branch: "feat/menu" });
    expect(withBranch).toContain("new-thread-on-branch");
    expect(withBranch).toContain("copy-branch");
    expect(allIds(baseState)).not.toContain("new-thread-on-branch");
    expect(allIds(baseState)).not.toContain("copy-branch");
  });

  it("flips lifecycle labels with thread state", () => {
    expect(ids({ ...baseState, isPinned: true, isSettled: true, isSnoozed: true })).toEqual(
      expect.arrayContaining(["unpin", "unsettle", "unsnooze"]),
    );
    expect(ids(baseState)).toEqual(expect.arrayContaining(["pin", "settle", "snooze"]));
  });

  it("disables snooze when the thread cannot snooze, keeping presets visible", () => {
    const snooze = buildThreadActionMenuItems({ ...baseState, canSnoozeNow: false }).find(
      (item) => item.id === "snooze",
    );
    expect(snooze?.disabled).toBe(true);
    expect(snooze?.children?.map((child) => child.id)).toEqual(["snooze:hour"]);
  });

  it("disables title regeneration while one is in flight", () => {
    const item = buildThreadActionMenuItems({ ...baseState, isRegeneratingTitle: true }).find(
      (candidate) => candidate.id === "regenerate-title",
    );
    expect(item).toMatchObject({ label: "Regenerating…", disabled: true });
  });

  it("marks delete as destructive and keeps it last", () => {
    const items = buildThreadActionMenuItems({ ...baseState, branch: "main" });
    expect(items.at(-1)).toMatchObject({ id: "delete", destructive: true });
  });
  it("offers archive as a non-destructive action right before delete", () => {
    const items = buildThreadActionMenuItems(baseState);
    const archiveItem = items.at(-2);
    expect(archiveItem?.id).toBe("archive");
    expect(archiveItem?.icon).toBe("archive");
    expect(archiveItem?.separatorBefore).toBe(true);
    expect(archiveItem?.destructive).toBeFalsy();
    expect(items.at(-1)?.id).toBe("delete");
  });

  it("keeps archive available even when the environment lacks every other capability", () => {
    expect(
      ids({
        ...baseState,
        supports: { settlement: false, snooze: false, pinning: false, titleRegeneration: false },
      }),
    ).toContain("archive");
  });

  it("disables archive while the thread is running", () => {
    const archiveItem = buildThreadActionMenuItems({ ...baseState, isRunning: true }).find(
      (item) => item.id === "archive",
    );
    expect(archiveItem?.disabled).toBe(true);
  });

  it("uses chat wording throughout for a chat, never calling it a thread", () => {
    const items = buildThreadActionMenuItems({ ...baseState, conversationMode: "chat" });
    const labelOf = (id: string) => items.find((item) => item.id === id)?.label;
    expect(labelOf("rename")).toBe("Rename chat");
    expect(labelOf("archive")).toBe("Archive chat");
    expect(labelOf("pin")).toBe("Pin chat");
    expect(labelOf("settle")).toBe("Settle chat");
    expect(items.at(-1)).toMatchObject({ id: "delete", label: "Delete chat", destructive: true });
    for (const item of items) {
      expect(item.label).not.toContain("thread");
      expect(item.label).not.toContain("Thread");
    }
  });

  it("keeps thread wording for a code conversation", () => {
    const items = buildThreadActionMenuItems({ ...baseState, conversationMode: "code" });
    expect(items.find((item) => item.id === "rename")?.label).toBe("Rename thread");
    expect(items.find((item) => item.id === "pin")?.label).toBe("Pin thread");
  });
});

describe("repo scoping", () => {
  const chatOnBranch: ThreadActionMenuState = {
    ...baseState,
    conversationMode: "chat",
    branch: "t3-foundation-migration",
  };

  it("never offers branch actions on a chat, even when a branch is present", () => {
    // A chat is the default surface and does not live in a checkout, so a
    // branch on one is leftover context rather than something to act on.
    const items = ids(chatOnBranch);
    expect(items).not.toContain("new-thread-on-branch");
    expect(allIds(chatOnBranch)).not.toContain("copy-branch");
  });

  it("still offers branch actions on a code thread", () => {
    const codeOnBranch = { ...chatOnBranch, conversationMode: "code" as const };
    expect(ids(codeOnBranch)).toContain("new-thread-on-branch");
    expect(allIds(codeOnBranch)).toContain("copy-branch");
  });

  it("treats an unspecified mode as a thread, matching the previous default", () => {
    const legacy = { ...baseState, branch: "main" };
    expect(ids(legacy)).toContain("new-thread-on-branch");
    expect(allIds(legacy)).toContain("copy-branch");
  });

  it("labels the id copy action for what the conversation is", () => {
    const copyChildren = (state: ThreadActionMenuState) =>
      buildThreadActionMenuItems(state).find((item) => item.id === "copy")?.children ?? [];
    expect(copyChildren(chatOnBranch).find((c) => c.id === "copy-thread-id")?.label).toBe(
      "Chat ID",
    );
    expect(
      copyChildren({ ...baseState, conversationMode: "code" }).find(
        (c) => c.id === "copy-thread-id",
      )?.label,
    ).toBe("Thread ID");
  });
});
