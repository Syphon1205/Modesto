// FILE: ChatTabStrip.tsx
// Purpose: The tab strip above the chat pane - the sessions and drafts you
//          have open, click to switch, x to close.
// Layer: Chat UI
//
// Modeled on OpenCode's tab strip (`packages/app/src/components/
// titlebar-tab-strip.tsx`), which is what "Tabs like OpenCode" means here.
// Placement differs deliberately: OpenCode puts tabs in the window titlebar,
// this sits directly under the existing chat header so it works identically in
// the browser build and needs no Electron chrome changes.
//
// All open/close/activate rules live in `chatTabs.ts`; this file is rendering
// and navigation only.

import { scopeThreadRef } from "@modesto/client-runtime/environment";
import { PlusIcon, XIcon } from "lucide-react";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CHAT_TAB_SWATCHES,
  type ChatTab,
  chatTabForOrdinal,
  chatTabKey,
  DRAFT_TAB_TITLE,
  type ChatTabGroupRef,
  groupChatTabs,
} from "../../chatTabs";
import { useChatTabsStore } from "../../chatTabsStore";
import { cn } from "../../lib/utils";
import { useProjects, useThreadShells } from "../../state/entities";
import { ThreadActivityIndicator } from "../ThreadStatusIndicators";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

/**
 * Drag payload type. A custom MIME rather than "text/plain" so a tab drag is
 * never mistaken for text dropped in from outside the app.
 */
const CHAT_TAB_DRAG_MIME = "application/x-modesto-chat-tab";

export interface ChatTabStripProps {
  /** Focuses a tab's thread/draft; owned by the caller so routing stays in one place. */
  readonly onActivate: (tab: ChatTab) => void;
  /** Opens a brand-new draft, same action as the strip's "+" button. */
  readonly onNewTab: () => void;
  /** Closes a tab. Navigation on closing the active tab is the caller's job. */
  readonly onClose: (key: string) => void;
}

function ChatTabStripItem({
  tab,
  title,
  status,
  isActive,
  color,
  groupKey,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToTheRight,
  canCloseOthers,
  canCloseToTheRight,
  onSetColor,
  onDropBefore,
}: {
  readonly tab: ChatTab;
  readonly title: string;
  /** Leading activity indicator, or `null` for a resting/draft tab. */
  readonly status: ReactNode;
  readonly isActive: boolean;
  /** User-chosen tab color, or `null` for the default treatment. */
  readonly color: string | null;
  /** The project group this tab belongs to; `null` when not known yet.
   *  Colouring targets the group, so the menu is hidden without one. */
  readonly groupKey: string | null;
  readonly onActivate: (tab: ChatTab) => void;
  readonly onClose: (key: string) => void;
  readonly onCloseOthers: (key: string) => void;
  readonly onCloseToTheRight: (key: string) => void;
  readonly canCloseOthers: boolean;
  readonly canCloseToTheRight: boolean;
  readonly onSetColor: (key: string, color: string | null) => void;
  /** Drops the dragged tab before this one; see `reorderChatTab`. */
  readonly onDropBefore: (draggedKey: string, beforeKey: string | null) => void;
}) {
  const key = chatTabKey(tab);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [isDropTarget, setDropTarget] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep the active tab reachable when the strip overflows - switching via
  // keyboard or from the sidebar can activate a tab scrolled out of view.
  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [isActive]);

  return (
    <div
      ref={ref}
      role="tab"
      aria-selected={isActive}
      // Chrome's core tab gesture. HTML drag-and-drop rather than pointer math
      // so the OS drag affordances (cursor, ghost) come for free.
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(CHAT_TAB_DRAG_MIME, key);
        event.dataTransfer.effectAllowed = "move";
        setDropTarget(false);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(CHAT_TAB_DRAG_MIME)) return;
        // Required, or the browser refuses the drop entirely.
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(event) => {
        const draggedKey = event.dataTransfer.getData(CHAT_TAB_DRAG_MIME);
        setDropTarget(false);
        if (!draggedKey) return;
        event.preventDefault();
        onDropBefore(draggedKey, key);
      }}
      onDragEnd={() => setDropTarget(false)}
      // Right-click only. The tab itself is deliberately NOT the menu trigger:
      // wrapping it in one made every left-click open the color menu instead
      // of switching tabs. The trigger below is an inert positioning anchor.
      onContextMenu={(event) => {
        event.preventDefault();
        if (groupKey !== null) setColorMenuOpen(true);
      }}
      className={cn(
        "group/chat-tab relative flex h-7 min-w-0 max-w-52 shrink-0 items-center gap-1 rounded-md pe-1 text-[12.5px] transition-colors",
        status ? "ps-1.5" : "ps-2.5",
        isActive
          ? "bg-sidebar-control-surface text-foreground"
          : "text-muted-foreground hover:bg-sidebar-row-hover hover:text-foreground",
        // A left edge marking where the drop will land, like Chrome's insertion point.
        isDropTarget &&
          "before:absolute before:inset-y-0 before:-start-0.5 before:w-0.5 before:rounded-full before:bg-primary",
      )}
    >
      {/* Colored edge along the tab's start: reads at a glance without
          tinting the label or fighting the active-tab background. */}
      {color && groupKey === null ? (
        <span
          aria-hidden
          className="absolute inset-y-1 start-0 w-0.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {status}
      <button
        type="button"
        title={title}
        // The label carries the tab's click target; the close button is a
        // sibling rather than a child so it is not a nested button.
        className="min-w-0 flex-1 truncate text-left outline-none"
        onClick={() => onActivate(tab)}
        onAuxClick={(event) => {
          // Middle-click closes, the convention every tabbed UI shares.
          if (event.button === 1) {
            event.preventDefault();
            onClose(key);
          }
        }}
      >
        {title}
      </button>
      <button
        type="button"
        aria-label={`Close ${title}`}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground opacity-0 hover:bg-sidebar-control-surface hover:text-foreground focus-visible:opacity-100 group-hover/chat-tab:opacity-100",
          isActive && "opacity-70",
        )}
        onClick={(event) => {
          event.stopPropagation();
          onClose(key);
        }}
      >
        <XIcon className="size-3" />
      </button>

      {/* Colouring targets the project, so there is nothing to colour until
          the tab's project is known. */}
      {groupKey === null ? null : (
        <Menu open={colorMenuOpen} onOpenChange={setColorMenuOpen}>
          {/* Inert anchor: it only tells the popup where to position itself.
            A real <button> because Base UI's trigger expects native button
            semantics, but hidden from pointers, tab order, and the a11y tree
            so it can never be activated - right-click is the only way in. */}
          <MenuTrigger
            render={
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="pointer-events-none absolute inset-0"
              />
            }
          />
          <MenuPopup align="start" className="min-w-0 p-1">
            <div className="flex items-center gap-1">
              {CHAT_TAB_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Set tab color ${swatch}`}
                  aria-pressed={color === swatch}
                  className={cn(
                    "size-5 rounded-full ring-offset-1 ring-offset-popover transition-[box-shadow]",
                    color === swatch ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border",
                  )}
                  style={{ backgroundColor: swatch }}
                  onClick={() => {
                    onSetColor(groupKey, swatch);
                    setColorMenuOpen(false);
                  }}
                />
              ))}
            </div>
            {color ? (
              <MenuItem
                onClick={() => {
                  onSetColor(groupKey, null);
                  setColorMenuOpen(false);
                }}
              >
                Clear color
              </MenuItem>
            ) : null}
            <MenuItem
              onClick={() => {
                onClose(key);
                setColorMenuOpen(false);
              }}
            >
              Close
            </MenuItem>
            <MenuItem
              disabled={!canCloseOthers}
              onClick={() => {
                onCloseOthers(key);
                setColorMenuOpen(false);
              }}
            >
              Close other tabs
            </MenuItem>
            <MenuItem
              disabled={!canCloseToTheRight}
              onClick={() => {
                onCloseToTheRight(key);
                setColorMenuOpen(false);
              }}
            >
              Close tabs to the right
            </MenuItem>
          </MenuPopup>
        </Menu>
      )}
    </div>
  );
}

export const ChatTabStrip = memo(function ChatTabStrip({
  onActivate,
  onNewTab,
  onClose,
}: ChatTabStripProps) {
  const tabs = useChatTabsStore((state) => state.tabs);
  const activeKey = useChatTabsStore((state) => state.activeKey);
  const colors = useChatTabsStore((state) => state.colors);
  const setGroupColor = useChatTabsStore((state) => state.setGroupColor);
  const ensureGroupColors = useChatTabsStore((state) => state.ensureGroupColors);
  const threads = useThreadShells();
  const projects = useProjects();

  // Tab labels and status both track the live thread, so a rename, an
  // auto-generated title, or a turn starting shows up in the strip with no
  // extra plumbing.
  const threadByTabKey = useMemo(() => {
    const map = new Map<string, (typeof threads)[number]>();
    for (const thread of threads) {
      map.set(
        chatTabKey({ type: "thread", ...scopeThreadRef(thread.environmentId, thread.id) }),
        thread,
      );
    }
    return map;
  }, [threads]);

  const titleFor = useCallback(
    (tab: ChatTab) =>
      tab.type === "draft"
        ? DRAFT_TAB_TITLE
        : (threadByTabKey.get(chatTabKey(tab))?.title ?? "Thread"),
    [threadByTabKey],
  );

  const projectTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(`${project.environmentId}:${project.id}`, project.title);
    }
    return map;
  }, [projects]);

  // A tab's group is its project. Resolved from live state rather than stored
  // on the tab, so a renamed or moved project is reflected without migrating
  // anything persisted.
  const resolveGroup = useCallback(
    (tab: ChatTab): ChatTabGroupRef | null => {
      if (tab.type === "draft") return null;
      const thread = threadByTabKey.get(chatTabKey(tab));
      if (!thread) return null;
      const key = `${thread.environmentId}:${thread.projectId}`;
      return { key, label: projectTitleById.get(key) ?? "Project" };
    },
    [projectTitleById, threadByTabKey],
  );

  const groups = useMemo(
    () => groupChatTabs({ tabs, colors, activeKey }, resolveGroup),
    [activeKey, colors, resolveGroup, tabs],
  );

  // Colours are assigned once the groups are known, because group keys come
  // from project state the tab store deliberately does not depend on.
  // The on-screen order after grouping. "Close to the right" and the number
  // shortcuts both mean what the user can see, not the raw open order.
  const displayedKeys = useMemo(
    () => groups.flatMap((group) => group.tabs.map(chatTabKey)),
    [groups],
  );

  const closeOthers = useChatTabsStore((state) => state.closeOthers);
  const closeToTheRightAction = useChatTabsStore((state) => state.closeToTheRight);
  const reorderTab = useChatTabsStore((state) => state.reorderTab);

  const handleCloseToTheRight = useCallback(
    (key: string) => closeToTheRightAction(key, displayedKeys),
    [closeToTheRightAction, displayedKeys],
  );

  const groupKeys = useMemo(
    () => groups.map((group) => group.key).filter((key): key is string => key !== null),
    [groups],
  );
  useEffect(() => {
    if (groupKeys.length > 0) ensureGroupColors(groupKeys);
  }, [ensureGroupColors, groupKeys]);

  // Chrome's number shortcuts. Bound on the window rather than the strip so
  // they work while the composer has focus, which is where the caret usually is.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const ordinal = Number.parseInt(event.key, 10);
      if (Number.isNaN(ordinal)) return;
      const targetKey = chatTabForOrdinal(displayedKeys, ordinal);
      if (targetKey === null) return;
      const tab = tabs.find((candidate) => chatTabKey(candidate) === targetKey);
      if (!tab) return;
      event.preventDefault();
      onActivate(tab);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [displayedKeys, onActivate, tabs]);

  // One shared component with the sidebar rows, so a thread reads identically
  // in both places rather than growing a second notion of "working". Drafts
  // have no session yet, so they have no status to show.
  const statusFor = useCallback(
    (tab: ChatTab): ReactNode => {
      if (tab.type === "draft") return null;
      const thread = threadByTabKey.get(chatTabKey(tab));
      return thread ? <ThreadActivityIndicator thread={thread} /> : null;
    },
    [threadByTabKey],
  );

  // One tab is just "the thread you are looking at" - a strip showing a single
  // tab is pure noise, so it stays hidden until there is something to switch
  // between.
  if (tabs.length < 2) {
    return null;
  }

  return (
    <TooltipProvider delay={400}>
      <div
        role="tablist"
        aria-label="Open threads"
        data-chat-tab-strip
        // Dropping past the last tab moves it to the end. Individual tabs stop
        // propagation implicitly by preventing default first, so this only
        // fires for the empty run of strip after them.
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(CHAT_TAB_DRAG_MIME)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          const draggedKey = event.dataTransfer.getData(CHAT_TAB_DRAG_MIME);
          if (!draggedKey) return;
          event.preventDefault();
          reorderTab(draggedKey, null);
        }}
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 bg-background px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((group, groupIndex) => {
          const groupKey = group.key;
          const items = group.tabs.map((tab) => {
            const key = chatTabKey(tab);
            return (
              <ChatTabStripItem
                key={key}
                tab={tab}
                title={titleFor(tab)}
                status={statusFor(tab)}
                isActive={key === activeKey}
                color={group.color}
                groupKey={groupKey}
                onActivate={onActivate}
                onClose={onClose}
                onCloseOthers={closeOthers}
                onCloseToTheRight={handleCloseToTheRight}
                canCloseOthers={displayedKeys.length > 1}
                canCloseToTheRight={displayedKeys.at(-1) !== key}
                onSetColor={setGroupColor}
                onDropBefore={reorderTab}
              />
            );
          });
          // A tab whose project is not known yet (an unsent draft, or a thread
          // whose shell has not loaded) stands alone rather than being grouped
          // into a bucket it would jump out of a moment later.
          if (groupKey === null) {
            return items;
          }
          return (
            <div
              key={groupKey}
              role="presentation"
              // The whole project reads as one unit: a shared underline in the
              // project's colour, with the project name leading it so the
              // grouping is legible without hovering anything.
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-md border-b-2 pb-px",
                groupIndex > 0 && "ms-2",
              )}
              style={{ borderBottomColor: group.color ?? "transparent" }}
            >
              {group.label ? (
                <span
                  className="max-w-24 shrink-0 truncate ps-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground"
                  title={group.label}
                >
                  {group.label}
                </span>
              ) : null}
              {items}
            </div>
          );
        })}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="New thread tab"
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-row-hover hover:text-foreground"
                onClick={onNewTab}
              />
            }
          >
            <PlusIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup side="bottom">New thread tab</TooltipPopup>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});
