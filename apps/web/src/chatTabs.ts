// FILE: chatTabs.ts
// Purpose: Pure model for the chat tab strip - which threads/drafts are open,
//          which is active, and what happens on open/close.
// Layer: Web state model (no React, no router, no storage - all injected)
//
// Modeled on OpenCode's `packages/app/src/context/tabs.tsx`, which is what
// "Tabs like OpenCode" means here: a strip of the sessions you have open,
// alongside unsent drafts, that you click between. Two tab kinds, same as
// theirs - a `thread` tab points at a real persisted thread, a `draft` tab at
// an unsent composer draft.
//
// Kept deliberately pure so the close/activate rules - the part that is easy
// to get subtly wrong - are unit-testable without mounting a router.

import { scopedThreadKey, scopeThreadRef } from "@modesto/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@modesto/contracts";

export interface ChatThreadTab {
  readonly type: "thread";
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}

export interface ChatDraftTab {
  readonly type: "draft";
  readonly draftId: string;
}

export type ChatTab = ChatThreadTab | ChatDraftTab;

/** Stable identity for a tab; also the persisted key and the React key. */
export function chatTabKey(tab: ChatTab): string {
  return tab.type === "draft"
    ? `draft:${tab.draftId}`
    : `thread:${scopedThreadKey(scopeThreadRef(tab.environmentId, tab.threadId))}`;
}

export function chatTabsEqual(left: ChatTab, right: ChatTab): boolean {
  return chatTabKey(left) === chatTabKey(right);
}

/**
 * Group colors, keyed by group (project) key.
 *
 * Kept as a sidecar map rather than derived, so a project keeps its colour as
 * its tabs open and close. Keyed by group rather than by tab because the
 * colour identifies the project - every thread in it shares one.
 */
export type ChatTabColors = Readonly<Record<string, string>>;

export interface ChatTabsState {
  readonly tabs: ReadonlyArray<ChatTab>;
  readonly colors: ChatTabColors;
  /** `null` when nothing is open, or when the active tab was just closed and
   *  there is nothing left to fall back to. */
  readonly activeKey: string | null;
}

/** A run of adjacent tabs belonging to one project. */
export interface ChatTabGroup {
  /** `null` for tabs whose project is not known yet (drafts, unloaded shells). */
  readonly key: string | null;
  readonly label: string | null;
  readonly color: string | null;
  readonly tabs: ReadonlyArray<ChatTab>;
}

export const EMPTY_CHAT_TABS: ChatTabsState = { tabs: [], colors: {}, activeKey: null };

/**
 * Opens `tab`, or focuses it when it is already open.
 *
 * Re-opening an existing tab must not duplicate it or move it: a tab strip
 * where clicking a thread you already had open reshuffles the strip is
 * disorienting. Position is only ever assigned once, on first open.
 */
export function openChatTab(state: ChatTabsState, tab: ChatTab): ChatTabsState {
  const key = chatTabKey(tab);
  const existing = state.tabs.find((candidate) => chatTabKey(candidate) === key);
  if (existing) {
    return state.activeKey === key ? state : { ...state, activeKey: key };
  }
  return { ...state, tabs: [...state.tabs, tab], activeKey: key };
}

/**
 * Chooses the colour a group starts with.
 *
 * "Random" in the sense that matters - the strip comes out varied without
 * anyone picking - but deliberately not `Math.random()`. The least-used swatch
 * among the groups on screen wins, so a short strip never shows two projects
 * the same colour by chance, and ties break on a hash of the group key so the
 * choice is deterministic and the model stays pure and testable.
 */
export function pickChatTabColor(
  colors: ChatTabColors,
  liveKeys: ReadonlySet<string>,
  key: string,
): string {
  const usage = new Map<string, number>(CHAT_TAB_SWATCHES.map((swatch) => [swatch, 0]));
  for (const [groupKey, color] of Object.entries(colors)) {
    if (!liveKeys.has(groupKey)) continue;
    const count = usage.get(color);
    if (count !== undefined) usage.set(color, count + 1);
  }

  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  const offset = Math.abs(hash) % CHAT_TAB_SWATCHES.length;

  let best = CHAT_TAB_SWATCHES[offset]!;
  let bestCount = usage.get(best) ?? 0;
  for (let step = 1; step < CHAT_TAB_SWATCHES.length; step += 1) {
    const swatch = CHAT_TAB_SWATCHES[(offset + step) % CHAT_TAB_SWATCHES.length]!;
    const count = usage.get(swatch) ?? 0;
    if (count < bestCount) {
      best = swatch;
      bestCount = count;
    }
  }
  return best;
}

/** Where a tab belongs: its project, resolved by the caller from live state. */
export interface ChatTabGroupRef {
  /** Stable identity for the group; also the colour key. */
  readonly key: string;
  /** Project name shown on the group. */
  readonly label: string;
}

/**
 * Clusters tabs by the project they belong to, the way OpenCode groups its
 * sessions by directory.
 *
 * Grouping is automatic and immediate: opening a thread puts it beside the
 * other threads in the same project with nothing to configure. That is the
 * whole point - an earlier cut made a colour the group and required colouring
 * tabs by hand before anything grouped, which is backwards.
 *
 * Computed at render time rather than by reordering `state.tabs`, so the
 * persisted open order is never rewritten behind the user's back. Group order
 * follows each project's first appearance in that order, which keeps the strip
 * stable: opening a second thread in an existing project pulls it back to its
 * group instead of shuffling everything.
 *
 * `resolveGroup` returns `null` for a tab whose project is not known yet - an
 * unsent draft, or a thread whose shell has not loaded - and those are held in
 * place as ungrouped singletons rather than swept into a bucket that would
 * reshuffle the moment the shell arrives.
 */
export function groupChatTabs(
  state: ChatTabsState,
  resolveGroup: (tab: ChatTab) => ChatTabGroupRef | null,
): ReadonlyArray<ChatTabGroup> {
  const groups: ChatTabGroup[] = [];
  const byKey = new Map<string, ChatTabGroup>();
  for (const tab of state.tabs) {
    const ref = resolveGroup(tab);
    if (ref === null) {
      groups.push({ key: null, label: null, color: null, tabs: [tab] });
      continue;
    }
    const existing = byKey.get(ref.key);
    if (existing) {
      (existing.tabs as ChatTab[]).push(tab);
      continue;
    }
    const group: ChatTabGroup = {
      key: ref.key,
      label: ref.label,
      color: state.colors[ref.key] ?? null,
      tabs: [tab],
    };
    byKey.set(ref.key, group);
    groups.push(group);
  }
  return groups;
}

/**
 * Gives every group on screen a colour, so grouping reads instantly.
 *
 * Colours are assigned to *groups*, not tabs: every thread in a project shares
 * its project's colour, which is what makes the grouping legible at a glance.
 * Existing colours are never reassigned, so a project keeps its colour as tabs
 * come and go.
 */
export function withAssignedGroupColors(
  colors: ChatTabColors,
  groupKeys: ReadonlyArray<string>,
): ChatTabColors {
  // One mutable map rather than respreading per group: each assignment has to
  // see the previous one, which is what keeps the colours distinct.
  const next: Record<string, string> = { ...colors };
  const live = new Set(groupKeys);
  let assigned = false;
  for (const key of groupKeys) {
    if (next[key]) continue;
    next[key] = pickChatTabColor(next, live, key);
    assigned = true;
  }
  return assigned ? next : colors;
}

/**
 * Closes the tab with `key`.
 *
 * Activation follows the rule every editor uses and OpenCode's
 * `nextTabAfterClose` implements: closing the *active* tab falls to its right
 * neighbour, or to its left when it was last. Closing any *other* tab leaves
 * the active tab alone - closing a background tab must never yank the user
 * out of what they are reading.
 */
export function closeChatTab(state: ChatTabsState, key: string): ChatTabsState {
  const index = state.tabs.findIndex((tab) => chatTabKey(tab) === key);
  if (index === -1) {
    return state;
  }
  const tabs = state.tabs.filter((_, position) => position !== index);
  if (state.activeKey !== key) {
    return { ...state, tabs, activeKey: state.activeKey };
  }
  const fallback = tabs[index] ?? tabs[index - 1];
  // Group colours are deliberately kept: closing the last tab of a project and
  // reopening it should bring the project's colour back, not reroll it.
  return { ...state, tabs, activeKey: fallback ? chatTabKey(fallback) : null };
}

/**
 * Sets or clears a *group's* colour. `null` clears, restoring the auto-assigned
 * one on the next render.
 *
 * `key` is a group key, not a tab key: colouring is per project, so recolouring
 * moves every tab in that project at once. Colours are validated by the caller
 * (`normalizeChatTabColor`); this only stores. Setting the colour a group
 * already has returns the same state so the store can skip a re-render and a
 * persist write.
 */
export function setChatTabGroupColor(
  state: ChatTabsState,
  key: string,
  color: string | null,
): ChatTabsState {
  const current = state.colors[key] ?? null;
  if (current === color) {
    return state;
  }
  const colors = { ...state.colors };
  if (color === null) {
    delete colors[key];
  } else {
    colors[key] = color;
  }
  return { ...state, colors };
}

/**
 * Closes every tab except `key`.
 *
 * The kept tab becomes active regardless of what was: "close others" is a
 * statement about which tab you want to be looking at.
 */
export function closeOtherChatTabs(state: ChatTabsState, key: string): ChatTabsState {
  const kept = state.tabs.filter((tab) => chatTabKey(tab) === key);
  if (kept.length === 0 || state.tabs.length === kept.length) {
    return state;
  }
  return { ...state, tabs: kept, activeKey: key };
}

/**
 * Closes every tab positioned after `key`.
 *
 * "After" means after in the *displayed* order, which is the grouped order, not
 * the raw open order - the user is pointing at what they can see. Callers pass
 * the displayed keys; without them this would close a surprising set whenever
 * grouping had moved something.
 */
export function closeChatTabsToTheRight(
  state: ChatTabsState,
  key: string,
  displayedKeys: ReadonlyArray<string>,
): ChatTabsState {
  const index = displayedKeys.indexOf(key);
  if (index === -1) {
    return state;
  }
  const doomed = new Set(displayedKeys.slice(index + 1));
  if (doomed.size === 0) {
    return state;
  }
  const tabs = state.tabs.filter((tab) => !doomed.has(chatTabKey(tab)));
  if (tabs.length === state.tabs.length) {
    return state;
  }
  const activeStillOpen =
    state.activeKey !== null && tabs.some((tab) => chatTabKey(tab) === state.activeKey);
  // Closing the tab you are on falls to the one you kept, as it does in Chrome.
  return { ...state, tabs, activeKey: activeStillOpen ? state.activeKey : key };
}

/**
 * Moves `key` to sit directly before `beforeKey`, or to the end when null.
 *
 * Operates on the open order, which is what gets persisted. Grouping still
 * clusters at render, so a tab dragged next to a sibling in its own project
 * lands where it was dropped, while one dragged across projects settles back
 * into its group - the same way a Chrome tab snaps back into its group.
 */
export function reorderChatTab(
  state: ChatTabsState,
  key: string,
  beforeKey: string | null,
): ChatTabsState {
  if (key === beforeKey) {
    return state;
  }
  const moving = state.tabs.find((tab) => chatTabKey(tab) === key);
  if (!moving) {
    return state;
  }
  const rest = state.tabs.filter((tab) => chatTabKey(tab) !== key);
  const at =
    beforeKey === null ? rest.length : rest.findIndex((tab) => chatTabKey(tab) === beforeKey);
  if (at === -1) {
    return state;
  }
  const tabs = [...rest.slice(0, at), moving, ...rest.slice(at)];
  // A no-op drag must not churn the store or trigger a persist write.
  if (tabs.every((tab, index) => tab === state.tabs[index])) {
    return state;
  }
  return { ...state, tabs };
}

/**
 * The tab a Chrome-style number shortcut selects.
 *
 * Chrome's rule exactly: 1-8 select that position, and 9 selects the *last*
 * tab rather than the ninth - which is the part people actually rely on.
 * Returns `null` when there is no such tab.
 */
export function chatTabForOrdinal(
  displayedKeys: ReadonlyArray<string>,
  ordinal: number,
): string | null {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 9) return null;
  if (displayedKeys.length === 0) return null;
  if (ordinal === 9) return displayedKeys.at(-1) ?? null;
  return displayedKeys[ordinal - 1] ?? null;
}

/** Activates an already-open tab; unknown keys are ignored. */
export function activateChatTab(state: ChatTabsState, key: string): ChatTabsState {
  if (state.activeKey === key || !state.tabs.some((tab) => chatTabKey(tab) === key)) {
    return state;
  }
  return { ...state, activeKey: key };
}

/**
 * Drops tabs whose underlying thread no longer exists.
 *
 * Threads get deleted, archived, or belong to an environment that has gone
 * away; a tab pointing at one is a dead link that would 404 on click. Draft
 * tabs are deliberately left alone - a draft is local and unsent, so it has no
 * server-side existence to check against.
 */
export function pruneChatTabs(
  state: ChatTabsState,
  isKnownThread: (tab: ChatThreadTab) => boolean,
): ChatTabsState {
  const tabs = state.tabs.filter((tab) => tab.type === "draft" || isKnownThread(tab));
  if (tabs.length === state.tabs.length) {
    return state;
  }
  const activeStillOpen =
    state.activeKey !== null && tabs.some((tab) => chatTabKey(tab) === state.activeKey);
  return {
    ...state,
    tabs,
    activeKey: activeStillOpen ? state.activeKey : tabs.at(-1) ? chatTabKey(tabs.at(-1)!) : null,
  };
}

const MAX_PERSISTED_TABS = 50;
/** Colours outlive their tabs, so the map needs its own bound. */
const MAX_PERSISTED_COLORS = 200;
const MAX_PERSISTED_COLOR_KEY_LENGTH = 512;

/**
 * Validates tabs read back from storage.
 *
 * Persisted state is attacker-adjacent only in the sense that it is *stale* -
 * written by an older build with a different shape - so anything that does not
 * match the current shape is dropped rather than trusted. Also caps the count
 * so a runaway writer cannot make the strip unbounded.
 */
export function sanitizeChatTabs(value: unknown): ChatTabsState {
  if (typeof value !== "object" || value === null) {
    return EMPTY_CHAT_TABS;
  }
  const record = value as { tabs?: unknown; activeKey?: unknown; colors?: unknown };
  if (!Array.isArray(record.tabs)) {
    return EMPTY_CHAT_TABS;
  }

  const seen = new Set<string>();
  const tabs: ChatTab[] = [];
  for (const entry of record.tabs) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    let tab: ChatTab | null = null;
    if (
      candidate["type"] === "draft" &&
      typeof candidate["draftId"] === "string" &&
      candidate["draftId"].length > 0
    ) {
      tab = { type: "draft", draftId: candidate["draftId"] };
    } else if (
      candidate["type"] === "thread" &&
      typeof candidate["environmentId"] === "string" &&
      candidate["environmentId"].length > 0 &&
      typeof candidate["threadId"] === "string" &&
      candidate["threadId"].length > 0
    ) {
      tab = {
        type: "thread",
        environmentId: candidate["environmentId"] as EnvironmentId,
        threadId: candidate["threadId"] as ThreadId,
      };
    }
    if (!tab) continue;
    const key = chatTabKey(tab);
    if (seen.has(key)) continue;
    seen.add(key);
    tabs.push(tab);
    if (tabs.length >= MAX_PERSISTED_TABS) break;
  }

  const activeKey =
    typeof record.activeKey === "string" && seen.has(record.activeKey) ? record.activeKey : null;

  // Colours are re-validated on the way in, not trusted: they are rendered via
  // an inline style. They are keyed by *group* (project), whose keys come from
  // live project state and so cannot be checked here - only the value shape,
  // the key shape, and the total count are enforced. Colours deliberately
  // outlive their tabs so a project keeps its colour across a close/reopen,
  // which is why the cap exists rather than pruning against open tabs.
  const colors: Record<string, string> = {};
  const rawColors = (value as { colors?: unknown }).colors;
  if (typeof rawColors === "object" && rawColors !== null && !Array.isArray(rawColors)) {
    for (const [key, candidate] of Object.entries(rawColors as Record<string, unknown>)) {
      if (Object.keys(colors).length >= MAX_PERSISTED_COLORS) break;
      if (key.length === 0 || key.length > MAX_PERSISTED_COLOR_KEY_LENGTH) continue;
      // An earlier build keyed colours by tab. Those keys can never match a
      // group again, so they would sit in storage forever, growing on every
      // tab opened. Dropping them is the migration.
      if (isLegacyPerTabColorKey(key)) continue;
      const color = normalizeChatTabColor(candidate);
      if (color) colors[key] = color;
    }
  }

  return { tabs, colors, activeKey };
}

/**
 * The palette offered in the tab colour menu. Same six swatches the provider
 * accent picker uses, so the app has one colour vocabulary rather than two.
 */
export const CHAT_TAB_SWATCHES = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
] as const;

/**
 * Accepts only a 6-digit hex colour, lowercased.
 *
 * The value ends up in an inline `style`, so anything unvalidated read back
 * from storage would be injected straight into the DOM - a restrictive
 * allowlist is the point, not a formality. Returns `null` for anything else.
 */
/** Colours from the superseded per-tab model; see `sanitizeChatTabs`. */
function isLegacyPerTabColorKey(key: string): boolean {
  return key.startsWith("thread:") || key.startsWith("draft:");
}

export function normalizeChatTabColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

/** Short label for a draft tab, matching the composer's own "New thread" copy. */
export const DRAFT_TAB_TITLE = "New thread";
