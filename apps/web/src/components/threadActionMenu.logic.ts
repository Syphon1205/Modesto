import type { ContextMenuItem, ConversationMode } from "@modesto/contracts";
import type { SnoozePreset } from "@modesto/client-runtime/state/thread-settled";

/**
 * Ids for the per-thread action menu. Snooze presets are dispatched as
 * `snooze:<presetId>` so the union stays closed while the preset list
 * remains data-driven.
 */
export type ThreadActionMenuId =
  | "new-thread-on-branch"
  | "pin"
  | "unpin"
  | "settle"
  | "unsettle"
  | "snooze"
  | `snooze:${string}`
  | "unsnooze"
  | "rename"
  | "regenerate-title"
  | "mark-unread"
  | "copy"
  | "copy-path"
  | "copy-branch"
  | "copy-thread-id"
  | "archive"
  | "delete";

export interface ThreadActionMenuState {
  readonly branch: string | null;
  readonly isPinned: boolean;
  readonly isSettled: boolean;
  readonly isSnoozed: boolean;
  readonly canSnoozeNow: boolean;
  readonly isRegeneratingTitle: boolean;
  /** Archive rejects a thread with an active turn, so disable it here rather than let the action fail. */
  readonly isRunning: boolean;
  /**
   * What this conversation is. Chats share this menu with code threads but are
   * a different thing: they are the default surface, they live in their own
   * managed folder rather than a checkout, and they are not attached to a repo.
   *
   * Passing the mode rather than a pre-computed noun keeps that judgement in
   * one place. Every call site used to re-derive `subjectNoun` itself, which is
   * how a chat ended up being offered "New thread on <branch>".
   */
  readonly conversationMode?: ConversationMode | undefined;
  readonly supports: {
    readonly settlement: boolean;
    readonly snooze: boolean;
    readonly pinning: boolean;
    readonly titleRegeneration: boolean;
  };
  readonly snoozePresets: ReadonlyArray<SnoozePreset>;
}

/**
 * Whether a conversation lives in a checkout, and so has a branch worth acting
 * on.
 *
 * Chats are the default surface and are not attached to a repo - they run in
 * their own managed folder. Any branch recorded on one is leftover context, so
 * offering "New thread on <branch>" or "Copy branch" there points at something
 * the chat is not in.
 */
export function isRepoScopedConversation(mode: ConversationMode | undefined): boolean {
  return mode !== "chat";
}

/**
 * Single source for the per-thread action menu: the sidebar row's right-click
 * menu and the chat header menu both render exactly this list, so labels,
 * ordering, and capability gating cannot drift between the two surfaces.
 */
export function buildThreadActionMenuItems(
  state: ThreadActionMenuState,
): ReadonlyArray<ContextMenuItem<ThreadActionMenuId>> {
  const isChat = !isRepoScopedConversation(state.conversationMode);
  const noun = isChat ? "chat" : "thread";
  // A branch only means something for a conversation that sits in a checkout.
  // A chat has no repo, so a branch on one is leftover context, not an
  // affordance worth offering.
  const branch = isChat ? null : state.branch;
  return [
    ...(branch
      ? [
          {
            id: "new-thread-on-branch" as const,
            label: `New thread on ${branch}`,
            icon: "message-square-plus",
          },
        ]
      : []),
    ...(state.supports.pinning
      ? [
          state.isPinned
            ? { id: "unpin" as const, label: `Unpin ${noun}`, icon: "pin-off" }
            : { id: "pin" as const, label: `Pin ${noun}`, icon: "pin" },
        ]
      : []),
    // Both lifecycle actions stay available on pinned threads: settling
    // clears the pin ("done" beats "keep on top"), and snoozing hides the
    // card until wake with the pin intact.
    ...(state.supports.settlement
      ? [
          state.isSettled
            ? { id: "unsettle" as const, label: `Un-settle ${noun}`, icon: "circle-check" }
            : { id: "settle" as const, label: `Settle ${noun}`, icon: "circle-check" },
        ]
      : []),
    ...(state.supports.snooze
      ? [
          state.isSnoozed
            ? { id: "unsnooze" as const, label: `Wake ${noun}`, icon: "clock" }
            : {
                id: "snooze" as const,
                label: "Snooze",
                icon: "clock",
                disabled: !state.canSnoozeNow,
                children: state.snoozePresets.map((preset) => ({
                  id: `snooze:${preset.id}` as const,
                  label: `${preset.label} (${preset.whenLabel})`,
                })),
              },
        ]
      : []),
    { id: "rename", label: `Rename ${noun}`, icon: "pencil", separatorBefore: true },
    ...(state.supports.titleRegeneration
      ? [
          {
            id: "regenerate-title" as const,
            label: state.isRegeneratingTitle ? "Regenerating…" : "Regenerate title",
            icon: "refresh-cw",
            disabled: state.isRegeneratingTitle,
          },
        ]
      : []),
    { id: "mark-unread", label: "Mark unread", icon: "mail-open" },
    {
      id: "copy",
      label: "Copy",
      icon: "copy",
      separatorBefore: true,
      children: [
        { id: "copy-path", label: "Path", icon: "folder" },
        ...(branch ? [{ id: "copy-branch" as const, label: "Branch", icon: "git-branch" }] : []),
        { id: "copy-thread-id", label: isChat ? "Chat ID" : "Thread ID", icon: "hash" },
      ],
    },
    // Archive removes the thread from the sidebar while keeping its
    // conversation under Settings > Archived threads — distinct from Settle
    // (stays visible in the Settled shelf) and Delete (clears history for
    // good), so it sits beside Delete without borrowing its destructive
    // styling.
    {
      id: "archive",
      label: `Archive ${noun}`,
      icon: "archive",
      disabled: state.isRunning,
      separatorBefore: true,
    },
    {
      id: "delete",
      label: noun === "chat" ? "Delete chat" : "Delete",
      destructive: true,
      icon: "trash",
    },
  ];
}
