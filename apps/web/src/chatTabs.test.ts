import type { EnvironmentId, ThreadId } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import {
  activateChatTab,
  CHAT_TAB_SWATCHES,
  type ChatTab,
  type ChatTabGroup,
  type ChatTabsState,
  chatTabForOrdinal,
  chatTabKey,
  closeChatTab,
  closeChatTabsToTheRight,
  closeOtherChatTabs,
  EMPTY_CHAT_TABS,
  groupChatTabs,
  normalizeChatTabColor,
  openChatTab,
  pruneChatTabs,
  reorderChatTab,
  sanitizeChatTabs,
  setChatTabGroupColor,
  withAssignedGroupColors,
} from "./chatTabs";

const env = "local" as EnvironmentId;
const thread = (threadId: string): ChatTab => ({
  type: "thread",
  environmentId: env,
  threadId: threadId as ThreadId,
});
const draft = (draftId: string): ChatTab => ({ type: "draft", draftId });

function openAll(...tabs: ChatTab[]): ChatTabsState {
  return tabs.reduce(openChatTab, EMPTY_CHAT_TABS);
}

describe("opening", () => {
  it("appends a new tab and makes it active", () => {
    const state = openAll(thread("a"), thread("b"));

    expect(state.tabs.map(chatTabKey)).toEqual([chatTabKey(thread("a")), chatTabKey(thread("b"))]);
    expect(state.activeKey).toBe(chatTabKey(thread("b")));
  });

  it("focuses an already-open tab instead of duplicating or reordering it", () => {
    // Clicking a thread you already have open must not reshuffle the strip.
    const state = openChatTab(openAll(thread("a"), thread("b")), thread("a"));

    expect(state.tabs.map(chatTabKey)).toEqual([chatTabKey(thread("a")), chatTabKey(thread("b"))]);
    expect(state.activeKey).toBe(chatTabKey(thread("a")));
  });

  it("keeps threads and drafts in the same strip", () => {
    const state = openAll(thread("a"), draft("d1"));

    expect(state.tabs).toHaveLength(2);
    expect(state.activeKey).toBe("draft:d1");
  });

  it("treats the same thread id on different environments as different tabs", () => {
    const other = "remote" as EnvironmentId;
    const state = openAll(thread("a"), {
      type: "thread",
      environmentId: other,
      threadId: "a" as ThreadId,
    });

    expect(state.tabs).toHaveLength(2);
  });
});

describe("closing", () => {
  it("falls to the right neighbour when the active tab closes", () => {
    const state = closeChatTab(
      activateChatTab(openAll(thread("a"), thread("b"), thread("c")), chatTabKey(thread("b"))),
      chatTabKey(thread("b")),
    );

    expect(state.tabs.map(chatTabKey)).toEqual([chatTabKey(thread("a")), chatTabKey(thread("c"))]);
    expect(state.activeKey).toBe(chatTabKey(thread("c")));
  });

  it("falls to the left neighbour when the last tab closes", () => {
    const state = closeChatTab(openAll(thread("a"), thread("b")), chatTabKey(thread("b")));

    expect(state.activeKey).toBe(chatTabKey(thread("a")));
  });

  it("leaves the active tab alone when a background tab closes", () => {
    // Closing a background tab must never yank the user out of what they read.
    const open = activateChatTab(
      openAll(thread("a"), thread("b"), thread("c")),
      chatTabKey(thread("c")),
    );
    const state = closeChatTab(open, chatTabKey(thread("a")));

    expect(state.activeKey).toBe(chatTabKey(thread("c")));
  });

  it("clears the active key when the last remaining tab closes", () => {
    const state = closeChatTab(openAll(thread("a")), chatTabKey(thread("a")));

    expect(state).toEqual({ tabs: [], colors: {}, activeKey: null });
  });

  it("ignores a close for a tab that is not open", () => {
    const open = openAll(thread("a"));
    expect(closeChatTab(open, chatTabKey(thread("zzz")))).toBe(open);
  });
});

const known = (tab: { readonly threadId: string }) => tab.threadId !== "gone";

describe("pruning threads that no longer exist", () => {
  it("drops tabs for deleted threads but keeps drafts", () => {
    const state = pruneChatTabs(openAll(thread("a"), thread("gone"), draft("d1")), known);

    expect(state.tabs.map(chatTabKey)).toEqual([chatTabKey(thread("a")), "draft:d1"]);
  });

  it("reassigns the active tab when the active one was pruned", () => {
    const state = pruneChatTabs(
      activateChatTab(openAll(thread("a"), thread("gone")), chatTabKey(thread("gone"))),
      known,
    );

    expect(state.activeKey).toBe(chatTabKey(thread("a")));
  });

  it("returns the same object when nothing was pruned", () => {
    const open = openAll(thread("a"), draft("d1"));
    expect(pruneChatTabs(open, known)).toBe(open);
  });
});

describe("reading persisted state", () => {
  it("round-trips a real state", () => {
    const open = openAll(thread("a"), draft("d1"));
    expect(sanitizeChatTabs(JSON.parse(JSON.stringify(open)))).toEqual(open);
  });

  it("drops malformed, duplicate, and unknown-shaped entries", () => {
    const state = sanitizeChatTabs({
      tabs: [
        { type: "thread", environmentId: "local", threadId: "a" },
        { type: "thread", environmentId: "local", threadId: "a" },
        { type: "thread", environmentId: "local" },
        { type: "draft" },
        { type: "mystery", threadId: "x" },
        null,
        "nope",
      ],
      activeKey: chatTabKey(thread("a")),
    });

    expect(state.tabs).toHaveLength(1);
    expect(state.activeKey).toBe(chatTabKey(thread("a")));
  });

  it("drops an active key that does not match any surviving tab", () => {
    const state = sanitizeChatTabs({
      tabs: [{ type: "thread", environmentId: "local", threadId: "a" }],
      activeKey: "thread:local\nnope",
    });

    expect(state.activeKey).toBeNull();
  });

  it("falls back to empty for anything that is not a tab state", () => {
    for (const value of [null, undefined, 42, "tabs", {}, { tabs: "no" }]) {
      expect(sanitizeChatTabs(value)).toEqual(EMPTY_CHAT_TABS);
    }
  });

  it("caps how many tabs it will restore", () => {
    const tabs = Array.from({ length: 80 }, (_, index) => ({
      type: "thread",
      environmentId: "local",
      threadId: `t${index}`,
    }));

    expect(sanitizeChatTabs({ tabs, activeKey: null }).tabs).toHaveLength(50);
  });
});

const projectOf = (map: Record<string, string>) => (tab: ChatTab) => {
  if (tab.type === "draft") return null;
  const key = map[tab.threadId];
  return key ? { key, label: key } : null;
};

describe("grouping by project", () => {
  const shape = (groups: ReadonlyArray<ChatTabGroup>) =>
    groups.map((group) => [group.key, group.tabs.map(chatTabKey)] as const);

  it("clusters threads from the same project without any configuration", () => {
    // The whole point: grouping is immediate, not something you set up.
    const state = openAll(thread("a"), thread("b"), thread("c"));
    const groups = groupChatTabs(state, projectOf({ a: "p1", b: "p2", c: "p1" }));

    expect(shape(groups)).toEqual([
      ["p1", [chatTabKey(thread("a")), chatTabKey(thread("c"))]],
      ["p2", [chatTabKey(thread("b"))]],
    ]);
  });

  it("orders groups by where each project first appears", () => {
    const state = openAll(thread("a"), thread("b"));
    expect(
      groupChatTabs(state, projectOf({ a: "zed", b: "alpha" })).map((group) => group.key),
    ).toEqual(["zed", "alpha"]);
  });

  it("keeps a tab with no known project as its own group", () => {
    // A draft, or a thread whose shell has not loaded. Bucketing all of them
    // together would make a tab jump the moment its project resolves.
    const state = openAll(thread("a"), draft("d1"), draft("d2"));
    const groups = groupChatTabs(state, projectOf({ a: "p1" }));

    expect(shape(groups)).toEqual([
      ["p1", [chatTabKey(thread("a"))]],
      [null, ["draft:d1"]],
      [null, ["draft:d2"]],
    ]);
  });

  it("pulls a later thread back to its project group", () => {
    // Grouping wins over open order, so a project stays one contiguous run.
    const state = openAll(thread("a"), draft("d1"), thread("b"));
    const groups = groupChatTabs(state, projectOf({ a: "p1", b: "p1" }));

    expect(shape(groups)).toEqual([
      ["p1", [chatTabKey(thread("a")), chatTabKey(thread("b"))]],
      [null, ["draft:d1"]],
    ]);
  });

  it("carries the project label and its stored colour onto the group", () => {
    const state = setChatTabGroupColor(openAll(thread("a")), "p1", "#2563eb");
    const [group] = groupChatTabs(state, projectOf({ a: "p1" }));

    expect(group?.label).toBe("p1");
    expect(group?.color).toBe("#2563eb");
  });

  it("returns every open tab exactly once", () => {
    const state = openAll(thread("a"), thread("b"), draft("d1"), thread("c"));
    const flattened = groupChatTabs(state, projectOf({ a: "p1", b: "p2", c: "p1" })).flatMap(
      (group) => group.tabs.map(chatTabKey),
    );

    expect(flattened.toSorted()).toEqual(state.tabs.map(chatTabKey).toSorted());
  });

  it("has nothing to group in an empty strip", () => {
    expect(groupChatTabs(EMPTY_CHAT_TABS, projectOf({}))).toEqual([]);
  });
});

describe("group colors", () => {
  it("gives every group a distinct color", () => {
    const colors = withAssignedGroupColors({}, ["p1", "p2", "p3"]);

    expect(Object.keys(colors)).toEqual(["p1", "p2", "p3"]);
    expect(new Set(Object.values(colors)).size).toBe(3);
    for (const color of Object.values(colors)) {
      expect(CHAT_TAB_SWATCHES).toContain(color);
    }
  });

  it("never reassigns a color a project already has", () => {
    // A project keeps its colour as its tabs open and close.
    const colors = withAssignedGroupColors({ p1: "#dc2626" }, ["p1", "p2"]);
    expect(colors["p1"]).toBe("#dc2626");
  });

  it("returns the same map when every group already has a color", () => {
    const colors = { p1: "#dc2626" };
    expect(withAssignedGroupColors(colors, ["p1"])).toBe(colors);
  });

  it("is deterministic for the same key and state", () => {
    expect(withAssignedGroupColors({}, ["p1"])["p1"]).toBe(
      withAssignedGroupColors({}, ["p1"])["p1"],
    );
  });

  it("ignores colors for projects that are no longer on screen", () => {
    // A stale colour must not make its swatch look taken forever.
    const stale = Object.fromEntries(CHAT_TAB_SWATCHES.map((c, i) => [`gone${i}`, c]));
    expect(CHAT_TAB_SWATCHES).toContain(withAssignedGroupColors(stale, ["p1"])["p1"]);
  });

  it("sets and clears a group color", () => {
    const set = setChatTabGroupColor(EMPTY_CHAT_TABS, "p1", "#16a34a");
    expect(set.colors["p1"]).toBe("#16a34a");
    expect(setChatTabGroupColor(set, "p1", null).colors["p1"]).toBeUndefined();
  });

  it("returns the same state when the color is unchanged", () => {
    const set = setChatTabGroupColor(EMPTY_CHAT_TABS, "p1", "#16a34a");
    expect(setChatTabGroupColor(set, "p1", "#16a34a")).toBe(set);
  });

  it("accepts only 6-digit hex, lowercased", () => {
    expect(normalizeChatTabColor("#2563EB")).toBe("#2563eb");
    for (const bad of ["red", "#fff", "#12345", "rgb(0,0,0)", 42, null, undefined]) {
      expect(normalizeChatTabColor(bad)).toBeNull();
    }
  });

  it("rejects values that would inject through the inline style", () => {
    for (const attack of [
      "#000; background: url(javascript:alert(1))",
      "red; position: fixed; inset: 0",
      "</style><script>alert(1)</script>",
    ]) {
      expect(normalizeChatTabColor(attack)).toBeNull();
    }
  });

  it("drops colors from the superseded per-tab model", () => {
    // Those keys can never match a group again, so they would sit in storage
    // forever, growing on every tab opened.
    const state = sanitizeChatTabs({
      tabs: [{ type: "thread", environmentId: "local", threadId: "a" }],
      colors: {
        "thread:local:a": "#2563eb",
        "draft:d1": "#16a34a",
        "local:p1": "#dc2626",
      },
      activeKey: null,
    });

    expect(state.colors).toEqual({ "local:p1": "#dc2626" });
  });

  it("restores persisted group colors that are not tied to any open tab", () => {
    // Colours are keyed by project, which outlives the tabs in the strip.
    const state = sanitizeChatTabs({
      tabs: [{ type: "thread", environmentId: "local", threadId: "a" }],
      colors: { "local:p1": "#2563EB", "local:p2": "not-a-color" },
      activeKey: null,
    });

    expect(state.colors).toEqual({ "local:p1": "#2563eb" });
  });
});

describe("Chrome-style tab actions", () => {
  const a = chatTabKey(thread("a"));
  const b = chatTabKey(thread("b"));
  const c = chatTabKey(thread("c"));
  const open3 = () => openAll(thread("a"), thread("b"), thread("c"));

  describe("close others", () => {
    it("keeps only the named tab and activates it", () => {
      const state = closeOtherChatTabs(activateChatTab(open3(), c), a);

      expect(state.tabs.map(chatTabKey)).toEqual([a]);
      expect(state.activeKey).toBe(a);
    });

    it("is a no-op when the tab is alone or unknown", () => {
      const one = openAll(thread("a"));
      expect(closeOtherChatTabs(one, a)).toBe(one);
      expect(closeOtherChatTabs(one, "nope")).toBe(one);
    });
  });

  describe("close to the right", () => {
    it("closes everything after the tab in displayed order", () => {
      const state = closeChatTabsToTheRight(open3(), a, [a, b, c]);

      expect(state.tabs.map(chatTabKey)).toEqual([a]);
    });

    it("uses displayed order, not open order", () => {
      // Grouping reorders what the user sees; "to the right" has to mean what
      // they are pointing at or it closes a surprising set.
      const state = closeChatTabsToTheRight(open3(), b, [c, b, a]);

      expect(state.tabs.map(chatTabKey)).toEqual([b, c]);
    });

    it("keeps the active tab when it survives", () => {
      const state = closeChatTabsToTheRight(activateChatTab(open3(), a), b, [a, b, c]);

      expect(state.activeKey).toBe(a);
    });

    it("falls to the kept tab when the active one is closed", () => {
      const state = closeChatTabsToTheRight(activateChatTab(open3(), c), a, [a, b, c]);

      expect(state.activeKey).toBe(a);
    });

    it("is a no-op for the last tab or an unknown key", () => {
      const state = open3();
      expect(closeChatTabsToTheRight(state, c, [a, b, c])).toBe(state);
      expect(closeChatTabsToTheRight(state, "nope", [a, b, c])).toBe(state);
    });
  });

  describe("reordering", () => {
    it("moves a tab before another", () => {
      expect(reorderChatTab(open3(), c, a).tabs.map(chatTabKey)).toEqual([c, a, b]);
    });

    it("moves a tab to the end when there is nothing to insert before", () => {
      expect(reorderChatTab(open3(), a, null).tabs.map(chatTabKey)).toEqual([b, c, a]);
    });

    it("returns the same state for a drop that changes nothing", () => {
      const state = open3();
      expect(reorderChatTab(state, a, b)).toBe(state);
      expect(reorderChatTab(state, c, null)).toBe(state);
      expect(reorderChatTab(state, a, a)).toBe(state);
    });

    it("ignores an unknown tab or target", () => {
      const state = open3();
      expect(reorderChatTab(state, "nope", a)).toBe(state);
      expect(reorderChatTab(state, a, "nope")).toBe(state);
    });

    it("keeps every tab exactly once", () => {
      const moved = reorderChatTab(open3(), c, b);
      expect(moved.tabs.map(chatTabKey).toSorted()).toEqual([a, b, c].toSorted());
    });
  });

  describe("number shortcuts", () => {
    it("selects the tab at that position", () => {
      expect(chatTabForOrdinal([a, b, c], 1)).toBe(a);
      expect(chatTabForOrdinal([a, b, c], 2)).toBe(b);
    });

    it("sends 9 to the last tab, as Chrome does", () => {
      // The part people actually rely on: 9 is "last", not "ninth".
      expect(chatTabForOrdinal([a, b, c], 9)).toBe(c);
      expect(chatTabForOrdinal([a], 9)).toBe(a);
    });

    it("returns null when there is no such tab", () => {
      expect(chatTabForOrdinal([a, b], 5)).toBeNull();
      expect(chatTabForOrdinal([], 1)).toBeNull();
      expect(chatTabForOrdinal([a], 0)).toBeNull();
      expect(chatTabForOrdinal([a], 10)).toBeNull();
      expect(chatTabForOrdinal([a], 1.5)).toBeNull();
    });
  });
});
