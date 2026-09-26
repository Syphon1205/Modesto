import type { EnvironmentThreadShell } from "@modesto/client-runtime/state/models";
import { scopedThreadKey, scopeThreadRef } from "@modesto/client-runtime/environment";
import type { ScopedThreadRef } from "@modesto/contracts";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  ClockIcon,
  CodeIcon,
  EllipsisIcon,
  FolderIcon,
  FolderPlusIcon,
  GitBranchIcon,
  LayoutGridIcon,
  ListFilterIcon,
  MessageCircleIcon,
  PinIcon,
  PlusIcon,
  PuzzleIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
  WandSparklesIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import {
  memo,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { useAppNavigate } from "~/hooks/useAppNavigate";
import {
  DISCLOSURE_INNER_CLASS,
  disclosureChevronClassName,
  disclosureContentClassName,
  disclosureShellClassName,
} from "~/lib/disclosureMotion";
import { useProviderLayoutStore } from "~/providerLayoutStore";
import {
  compactAgeLabel,
  PROVIDER_LAYOUT_SPECS,
  sidebarRecencyBucket,
  type ProviderLayout,
  type SidebarRecencyBucket,
} from "~/providerLayouts";
import type { SidebarProjectSnapshot } from "~/sidebarProjectGrouping";
import { cn } from "../../lib/utils";
import { resolveSidebarThreadStatus } from "../Sidebar.logic";
import { ThreadActivityIndicator } from "../ThreadStatusIndicators";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { Kbd, KbdGroup } from "../ui/kbd";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import { SidebarContent, SidebarFooter, SidebarHeader, SidebarTrigger } from "../ui/sidebar";
import { GitHubAccountRow } from "./GitHubAccountRow";
import { SidebarProviderUpdatePill } from "./SidebarProviderUpdatePill";

export interface ProviderSidebarSearch {
  readonly open: boolean;
  readonly query: string;
  readonly results: readonly EnvironmentThreadShell[];
  readonly activeIndex: number;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onQueryChange: (query: string) => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}

export interface ProviderSidebarRename {
  readonly threadKey: string | null;
  readonly title: string;
  readonly onStart: (threadRef: ScopedThreadRef, title: string) => void;
  readonly onChange: (title: string) => void;
  readonly onCommit: (threadRef: ScopedThreadRef, title: string, originalTitle: string) => void;
  readonly onCancel: () => void;
}

export interface ProviderLayoutSidebarProps {
  readonly layout: ProviderLayout;
  readonly isElectron: boolean;
  readonly projects: readonly SidebarProjectSnapshot[];
  /** Top-level work threads, already sorted for the sidebar. */
  readonly codeThreads: readonly EnvironmentThreadShell[];
  /** Top-level chat threads, already sorted for the sidebar. */
  readonly chatThreads: readonly EnvironmentThreadShell[];
  readonly pinnedThreads: readonly EnvironmentThreadShell[];
  readonly routeThreadKey: string | null;
  readonly newThreadActive: boolean;
  readonly automationsActive: boolean;
  readonly pluginsActive: boolean;
  readonly newThreadShortcutLabel: string | null | undefined;
  readonly search: ProviderSidebarSearch;
  readonly rename: ProviderSidebarRename;
  readonly onNewThread: () => void;
  readonly onNewThreadInProject: (project: SidebarProjectSnapshot) => void;
  readonly onNewProject: () => void;
  readonly onActivateThread: (threadRef: ScopedThreadRef) => void;
  readonly onThreadContextMenu: (
    threadRef: ScopedThreadRef,
    position: { x: number; y: number },
  ) => void;
}

/**
 * Sidebars for the Claude, Codex, and Cursor interface styles. Each one
 * mirrors the navigation of its desktop app; all of them drive the same
 * Modesto threads, projects, search, and rename state owned by `Sidebar`.
 */
export const ProviderLayoutSidebar = memo(function ProviderLayoutSidebar(
  props: ProviderLayoutSidebarProps,
) {
  return (
    <>
      <ProviderSidebarHeader
        layout={props.layout}
        isElectron={props.isElectron}
        search={props.search}
      />
      <SidebarContent
        data-provider-sidebar-content={props.layout}
        className="gap-0 overflow-x-hidden px-2 pb-2"
      >
        {props.layout === "claude" ? (
          <ClaudeSidebarBody {...props} />
        ) : props.layout === "codex" ? (
          <CodexSidebarBody {...props} />
        ) : (
          <CursorSidebarBody {...props} />
        )}
      </SidebarContent>
      <ProviderSidebarFooter layout={props.layout} />
    </>
  );
});

// ── Chrome ──────────────────────────────────────────────────────────────

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="no-drag flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function ProviderSidebarHeader({
  layout,
  isElectron,
  search,
}: {
  layout: ProviderLayout;
  isElectron: boolean;
  search: ProviderSidebarSearch;
}) {
  return (
    <SidebarHeader
      data-provider-sidebar-header={layout}
      className={cn(
        "h-[var(--workspace-topbar-height)] shrink-0 flex-row items-center gap-0.5 py-0 pe-2 ps-[max(0.5rem,var(--workspace-titlebar-content-left))]",
        isElectron && "drag-region",
      )}
    >
      <SidebarTrigger className="no-drag size-7 shrink-0" aria-label="Hide sidebar" />
      {layout === "cursor" ? (
        <HeaderIconButton label="Search agents" onClick={search.onOpen}>
          <SearchIcon />
        </HeaderIconButton>
      ) : (
        <>
          <HeaderIconButton label="Back" onClick={() => window.history.back()}>
            <ArrowLeftIcon />
          </HeaderIconButton>
          <HeaderIconButton label="Forward" onClick={() => window.history.forward()}>
            <ArrowRightIcon />
          </HeaderIconButton>
          {layout === "claude" ? <ClaudeSectionSwitch /> : null}
        </>
      )}
    </SidebarHeader>
  );
}

function ProviderSidebarFooter({ layout }: { layout: ProviderLayout }) {
  const navigate = useAppNavigate();
  if (layout === "codex") {
    return (
      <SidebarFooter data-provider-sidebar-footer={layout} className="px-2 pb-2 pt-1">
        <SidebarProviderUpdatePill />
        <NavRow
          icon={SettingsIcon}
          label="Settings"
          onClick={() => void navigate({ to: "/settings" })}
        />
      </SidebarFooter>
    );
  }
  return (
    <SidebarFooter data-provider-sidebar-footer={layout} className="px-2 pb-2 pt-1">
      <SidebarProviderUpdatePill />
      <GitHubAccountRow />
    </SidebarFooter>
  );
}

// ── Shared rows ─────────────────────────────────────────────────────────

function NavRow({
  icon: Icon,
  label,
  onClick,
  active = false,
  shortcutLabel,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  shortcutLabel?: string | null | undefined;
}) {
  return (
    <button
      type="button"
      data-provider-nav-row=""
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className="group/nav flex w-full items-center gap-2.5 rounded-md px-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-row-hover data-[active]:bg-sidebar-row-active"
    >
      <Icon className="size-4 shrink-0 text-sidebar-foreground/80" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcutLabel ? (
        <KbdGroup className="text-sidebar-muted-foreground opacity-0 transition-opacity group-hover/nav:opacity-80">
          {shortcutLabel.split("+").map((part) => (
            <Kbd key={part} className="bg-transparent px-0 text-[11px]">
              {part}
            </Kbd>
          ))}
        </KbdGroup>
      ) : null}
    </button>
  );
}

function SectionHeading({ label, actions }: { label: string; actions?: ReactNode }) {
  return (
    <div
      data-provider-section-heading=""
      className="group/heading flex items-center justify-between gap-1 ps-2 pe-1 text-sidebar-muted-foreground"
    >
      <span className="min-w-0 truncate">{label}</span>
      {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
    </div>
  );
}

function HeadingIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}

function ThreadRow({
  thread,
  props,
  leading,
  trailing,
  indent = false,
}: {
  thread: EnvironmentThreadShell;
  props: ProviderLayoutSidebarProps;
  leading?: ReactNode;
  trailing?: ReactNode;
  indent?: boolean;
}) {
  const threadRef = useMemo(
    () => scopeThreadRef(thread.environmentId, thread.id),
    [thread.environmentId, thread.id],
  );
  const threadKey = scopedThreadKey(threadRef);
  const isActive = props.routeThreadKey === threadKey;
  const isRenaming = props.rename.threadKey === threadKey;
  const renameSettledRef = useRef(false);

  const handleRenameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      renameSettledRef.current = true;
      props.rename.onCommit(threadRef, props.rename.title, thread.title);
    } else if (event.key === "Escape") {
      event.preventDefault();
      renameSettledRef.current = true;
      props.rename.onCancel();
    }
  };

  return (
    <div
      role="listitem"
      data-provider-thread-row=""
      data-active={isActive || undefined}
      className={cn(
        "group/thread flex w-full items-center gap-2.5 rounded-md px-2 text-sidebar-foreground transition-colors hover:bg-sidebar-row-hover data-[active]:bg-sidebar-row-active",
        indent && "ps-8",
      )}
      onContextMenu={(event: ReactMouseEvent) => {
        event.preventDefault();
        props.onThreadContextMenu(threadRef, { x: event.clientX, y: event.clientY });
      }}
    >
      {leading ? (
        <span className="flex size-4 shrink-0 items-center justify-center">{leading}</span>
      ) : null}
      {isRenaming ? (
        <input
          autoFocus
          aria-label="Thread title"
          value={props.rename.title}
          onChange={(event) => props.rename.onChange(event.target.value)}
          onFocus={(event) => {
            renameSettledRef.current = false;
            event.currentTarget.select();
          }}
          onKeyDown={handleRenameKeyDown}
          onBlur={() => {
            if (!renameSettledRef.current) {
              props.rename.onCommit(threadRef, props.rename.title, thread.title);
            }
          }}
          className="min-w-0 flex-1 rounded-sm border border-input bg-card px-1 text-card-foreground outline-none focus:border-foreground"
        />
      ) : (
        <button
          type="button"
          title={thread.title}
          className="min-w-0 flex-1 truncate text-left outline-none"
          onClick={() => props.onActivateThread(threadRef)}
          onDoubleClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            props.rename.onStart(threadRef, thread.title);
          }}
        >
          {thread.title}
        </button>
      )}
      {trailing ? (
        <span className="flex shrink-0 items-center text-sidebar-muted-foreground">{trailing}</span>
      ) : null}
    </div>
  );
}

function SearchRow({
  search,
  placeholder,
}: {
  search: ProviderSidebarSearch;
  placeholder: string;
}) {
  return (
    <div className={disclosureShellClassName(search.open)}>
      <div className={DISCLOSURE_INNER_CLASS}>
        <div
          data-provider-sidebar-search=""
          className={disclosureContentClassName(
            search.open,
            "mb-1 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-control-surface px-2",
          )}
        >
          <SearchIcon className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
          <input
            ref={search.inputRef}
            type="search"
            tabIndex={search.open ? undefined : -1}
            value={search.query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => search.onQueryChange(event.currentTarget.value)}
            onKeyDown={search.onKeyDown}
            className="h-7 min-w-0 flex-1 bg-transparent text-sidebar-foreground outline-none placeholder:text-sidebar-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="button"
            aria-label="Close search"
            tabIndex={search.open ? undefined : -1}
            onClick={search.onClose}
            className="flex size-5 items-center justify-center rounded text-sidebar-muted-foreground hover:text-sidebar-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchResults({
  props,
  renderLeading,
}: {
  props: ProviderLayoutSidebarProps;
  renderLeading: (thread: EnvironmentThreadShell) => ReactNode;
}) {
  const { search } = props;
  if (search.results.length === 0) {
    return <p className="px-2 py-1 text-sidebar-muted-foreground">No matches</p>;
  }
  return (
    <div role="list" aria-label="Search results">
      {search.results.map((thread, index) => (
        <div
          key={scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))}
          id={`sidebar-thread-search-result-${index}`}
          data-search-highlighted={index === search.activeIndex || undefined}
          className="rounded-md data-[search-highlighted]:bg-sidebar-row-hover"
        >
          <ThreadRow thread={thread} props={props} leading={renderLeading(thread)} />
        </div>
      ))}
    </div>
  );
}

function threadsInProject(
  project: SidebarProjectSnapshot,
  threads: readonly EnvironmentThreadShell[],
): EnvironmentThreadShell[] {
  return threads.filter((thread) =>
    project.memberProjectRefs.some(
      (ref) => ref.environmentId === thread.environmentId && ref.projectId === thread.projectId,
    ),
  );
}

function threadKeyOf(thread: EnvironmentThreadShell): string {
  return scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
}

// ── Claude Code desktop ─────────────────────────────────────────────────

type ClaudeGrouping = "date" | "project";
const CLAUDE_VISIBLE_SESSION_LIMIT = 10;
const CLAUDE_BUCKETS: readonly SidebarRecencyBucket[] = ["Today", "Yesterday", "Older"];

function ClaudeStatusGlyph({ thread }: { thread: EnvironmentThreadShell }) {
  const status = resolveSidebarThreadStatus(thread);
  if (status === "ready") {
    return (
      <span
        aria-hidden="true"
        className="size-[9px] rounded-full border-[1.5px] border-sidebar-muted-foreground/70"
      />
    );
  }
  if (status === "approval" || status === "input") {
    return <span aria-label="Needs input" className="size-[7px] rounded-full bg-[#d97757]" />;
  }
  return <ThreadActivityIndicator thread={thread} />;
}

/** Claude Code desktop's Chat / Code switch in the sidebar title bar. */
function ClaudeSectionSwitch() {
  const section = useProviderLayoutStore((state) => state.claudeSection);
  const setSection = useProviderLayoutStore((state) => state.setClaudeSection);
  return (
    <div
      role="tablist"
      aria-label="Session type"
      data-claude-section-switch=""
      className="no-drag ms-auto flex items-center gap-px rounded-lg bg-sidebar-control-surface p-0.5"
    >
      {(
        [
          ["chat", MessageCircleIcon, "Chat"],
          ["code", CodeIcon, "Code"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={section === value}
          aria-label={label}
          title={label}
          onClick={() => setSection(value)}
          className="flex h-6 w-7 items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors hover:text-sidebar-foreground aria-selected:bg-sidebar-row-active aria-selected:text-sidebar-foreground"
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

function ClaudeSidebarBody(props: ProviderLayoutSidebarProps) {
  const navigate = useAppNavigate();
  const section = useProviderLayoutStore((state) => state.claudeSection);
  const [grouping, setGrouping] = useState<ClaudeGrouping>("date");
  const [expanded, setExpanded] = useState(false);
  const spec = PROVIDER_LAYOUT_SPECS.claude;
  const pinnedKeys = useMemo(
    () => new Set(props.pinnedThreads.map(threadKeyOf)),
    [props.pinnedThreads],
  );
  const sessions = useMemo(
    () =>
      (section === "chat" ? props.chatThreads : props.codeThreads).filter(
        (thread) => !pinnedKeys.has(threadKeyOf(thread)),
      ),
    [pinnedKeys, props.chatThreads, props.codeThreads, section],
  );
  const visible = expanded ? sessions : sessions.slice(0, CLAUDE_VISIBLE_SESSION_LIMIT);
  const groups =
    grouping === "date"
      ? CLAUDE_BUCKETS.map((bucket) => ({
          key: bucket,
          label: bucket as string,
          rows: visible.filter((thread) => sidebarRecencyBucket(thread.updatedAt) === bucket),
        })).filter((group) => group.rows.length > 0)
      : props.projects
          .map((project) => ({
            key: project.projectKey,
            label: project.displayName,
            rows: threadsInProject(project, visible),
          }))
          .filter((group) => group.rows.length > 0);
  const leading = (thread: EnvironmentThreadShell) => <ClaudeStatusGlyph thread={thread} />;
  const headingActions = (
    <>
      <HeadingIconButton label="Search sessions" onClick={props.search.onOpen}>
        <SearchIcon />
      </HeadingIconButton>
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label="Filter sessions"
              title="Filter sessions"
              className="flex size-6 items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground [&_svg]:size-3.5"
            />
          }
        >
          <ListFilterIcon />
        </MenuTrigger>
        <MenuPopup align="end" className="w-44">
          <MenuRadioGroup
            value={grouping}
            onValueChange={(value) => setGrouping(value === "project" ? "project" : "date")}
          >
            <MenuRadioItem value="date">Group by date</MenuRadioItem>
            <MenuRadioItem value="project">Group by project</MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </>
  );

  return (
    <>
      <nav aria-label="Workspace navigation" className="flex flex-col gap-px">
        <NavRow
          icon={PlusIcon}
          label={spec.newThreadLabel}
          active={props.newThreadActive}
          shortcutLabel={props.newThreadShortcutLabel}
          onClick={props.onNewThread}
        />
        <NavRow
          icon={ClockIcon}
          label="Routines"
          active={props.automationsActive}
          onClick={() => void navigate({ to: "/automations" })}
        />
        <NavRow
          icon={WandSparklesIcon}
          label="Customize"
          active={props.pluginsActive}
          onClick={() => void navigate({ to: "/plugins" })}
        />
      </nav>

      <div className="mt-5 flex flex-col gap-px">
        <SearchRow search={props.search} placeholder="Search sessions" />
        {props.search.open && props.search.query.trim().length > 0 ? (
          <SearchResults props={props} renderLeading={leading} />
        ) : (
          <>
            {props.pinnedThreads.length > 0 ? (
              <div role="list" aria-label="Pinned" className="mb-3 flex flex-col gap-px">
                <SectionHeading label="Pinned" />
                {props.pinnedThreads.map((thread) => (
                  <ThreadRow
                    key={threadKeyOf(thread)}
                    thread={thread}
                    props={props}
                    leading={<PinIcon className="size-3 text-sidebar-muted-foreground" />}
                  />
                ))}
              </div>
            ) : null}
            {groups.length === 0 ? (
              <>
                <SectionHeading label="Today" actions={headingActions} />
                <p className="px-2 py-1 text-sidebar-muted-foreground">
                  {section === "chat" ? "No chats yet" : "No sessions yet"}
                </p>
              </>
            ) : (
              groups.map((group, index) => (
                <div
                  key={group.key}
                  role="list"
                  aria-label={group.label}
                  className="mb-3 flex flex-col gap-px"
                >
                  <SectionHeading
                    label={group.label}
                    actions={index === 0 ? headingActions : undefined}
                  />
                  {group.rows.map((thread) => (
                    <ThreadRow
                      key={threadKeyOf(thread)}
                      thread={thread}
                      props={props}
                      leading={leading(thread)}
                    />
                  ))}
                </div>
              ))
            )}
            {sessions.length > CLAUDE_VISIBLE_SESSION_LIMIT ? (
              <button
                type="button"
                data-provider-show-more=""
                onClick={() => setExpanded((value) => !value)}
                className="rounded-md ps-8 text-left text-sidebar-muted-foreground transition-colors hover:text-sidebar-foreground"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

// ── Codex ───────────────────────────────────────────────────────────────

function CodexProjectGroup({
  project,
  threads,
  props,
}: {
  project: SidebarProjectSnapshot;
  threads: readonly EnvironmentThreadShell[];
  props: ProviderLayoutSidebarProps;
}) {
  const containsActive = threads.some((thread) => threadKeyOf(thread) === props.routeThreadKey);
  const [open, setOpen] = useState(containsActive);
  return (
    <Collapsible open={open || containsActive} onOpenChange={setOpen}>
      <div className="group/project relative flex items-center">
        <CollapsibleTrigger
          data-provider-nav-row=""
          className="flex w-full items-center gap-2.5 rounded-md px-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-row-hover"
        >
          <span className="relative flex size-4 shrink-0 items-center justify-center">
            <FolderIcon
              className="size-4 text-sidebar-foreground/80 group-hover/project:opacity-0"
              strokeWidth={1.75}
            />
            <ChevronRightIcon
              className={cn(
                "absolute size-3.5 text-sidebar-muted-foreground opacity-0 group-hover/project:opacity-100",
                disclosureChevronClassName(open || containsActive),
              )}
            />
          </span>
          <span className="min-w-0 flex-1 truncate">{project.displayName}</span>
        </CollapsibleTrigger>
        <button
          type="button"
          aria-label={`New chat in ${project.displayName}`}
          title="New chat"
          onClick={() => props.onNewThreadInProject(project)}
          className="absolute right-1 flex size-6 items-center justify-center rounded-md text-sidebar-muted-foreground opacity-0 transition-opacity hover:text-sidebar-foreground group-hover/project:opacity-100 [&_svg]:size-3.5"
        >
          <SquarePenIcon />
        </button>
      </div>
      <CollapsiblePanel>
        <div role="list" aria-label={project.displayName} className="flex flex-col gap-px">
          {threads.length === 0 ? (
            <p className="ps-8 text-sidebar-muted-foreground">No chats</p>
          ) : (
            threads.map((thread) => (
              <ThreadRow
                key={threadKeyOf(thread)}
                thread={thread}
                props={props}
                indent
                trailing={<CodexThreadTrailing thread={thread} />}
              />
            ))
          )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

function CodexThreadTrailing({ thread }: { thread: EnvironmentThreadShell }) {
  const status = resolveSidebarThreadStatus(thread);
  if (status !== "ready") return <ThreadActivityIndicator thread={thread} />;
  return <span className="tabular-nums">{compactAgeLabel(thread.updatedAt)}</span>;
}

function CodexSidebarBody(props: ProviderLayoutSidebarProps) {
  const navigate = useAppNavigate();
  const [projectOrder, setProjectOrder] = useState<"recent" | "name">("recent");
  const pinnedKeys = useMemo(
    () => new Set(props.pinnedThreads.map(threadKeyOf)),
    [props.pinnedThreads],
  );
  const projects = useMemo(
    () =>
      projectOrder === "name"
        ? [...props.projects].sort((a, b) => a.displayName.localeCompare(b.displayName))
        : props.projects,
    [projectOrder, props.projects],
  );
  const chats = props.chatThreads.filter((thread) => !pinnedKeys.has(threadKeyOf(thread)));
  const trailing = (thread: EnvironmentThreadShell) => <CodexThreadTrailing thread={thread} />;

  return (
    <>
      <nav aria-label="Workspace navigation" className="flex flex-col gap-px pt-1">
        <NavRow
          icon={SquarePenIcon}
          label={PROVIDER_LAYOUT_SPECS.codex.newThreadLabel}
          active={props.newThreadActive && !props.search.open}
          onClick={props.onNewThread}
        />
        <NavRow
          icon={SearchIcon}
          label="Search"
          active={props.search.open}
          onClick={props.search.open ? props.search.onClose : props.search.onOpen}
        />
        <NavRow
          icon={LayoutGridIcon}
          label="Plugins"
          active={props.pluginsActive}
          onClick={() => void navigate({ to: "/plugins" })}
        />
        <NavRow
          icon={ClockIcon}
          label="Automations"
          active={props.automationsActive}
          onClick={() => void navigate({ to: "/automations" })}
        />
      </nav>

      <div className="mt-4 flex flex-col gap-px">
        <SearchRow search={props.search} placeholder="Search chats" />
        {props.search.open && props.search.query.trim().length > 0 ? (
          <SearchResults props={props} renderLeading={() => null} />
        ) : (
          <>
            {props.pinnedThreads.length > 0 ? (
              <div role="list" aria-label="Pinned" className="mb-4 flex flex-col gap-px">
                <SectionHeading label="Pinned" />
                {props.pinnedThreads.map((thread) => (
                  <ThreadRow
                    key={threadKeyOf(thread)}
                    thread={thread}
                    props={props}
                    leading={<PinIcon className="size-3.5 text-sidebar-muted-foreground" />}
                    trailing={trailing(thread)}
                  />
                ))}
              </div>
            ) : null}

            <div className="mb-4 flex flex-col gap-px">
              <SectionHeading
                label="Projects"
                actions={
                  <>
                    <Menu>
                      <MenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Sort projects"
                            title="Sort projects"
                            className="flex size-6 items-center justify-center rounded-md text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground [&_svg]:size-3.5"
                          />
                        }
                      >
                        <ListFilterIcon />
                      </MenuTrigger>
                      <MenuPopup align="end" className="w-40">
                        <MenuRadioGroup
                          value={projectOrder}
                          onValueChange={(value) =>
                            setProjectOrder(value === "name" ? "name" : "recent")
                          }
                        >
                          <MenuRadioItem value="recent">Recent</MenuRadioItem>
                          <MenuRadioItem value="name">Name</MenuRadioItem>
                        </MenuRadioGroup>
                      </MenuPopup>
                    </Menu>
                    <HeadingIconButton label="Add new project" onClick={props.onNewProject}>
                      <FolderPlusIcon />
                    </HeadingIconButton>
                  </>
                }
              />
              {projects.length === 0 ? (
                <p className="px-2 text-sidebar-muted-foreground">No projects</p>
              ) : (
                projects.map((project) => (
                  <CodexProjectGroup
                    key={project.projectKey}
                    project={project}
                    threads={threadsInProject(project, props.codeThreads).filter(
                      (thread) => !pinnedKeys.has(threadKeyOf(thread)),
                    )}
                    props={props}
                  />
                ))
              )}
            </div>

            <div role="list" aria-label="Chats" className="flex flex-col gap-px">
              <SectionHeading
                label="Chats"
                actions={
                  <HeadingIconButton label="New chat" onClick={props.onNewThread}>
                    <SquarePenIcon />
                  </HeadingIconButton>
                }
              />
              {chats.length === 0 ? (
                <p className="px-2 text-sidebar-muted-foreground/70">No chats</p>
              ) : (
                chats.map((thread) => (
                  <ThreadRow
                    key={threadKeyOf(thread)}
                    thread={thread}
                    props={props}
                    trailing={trailing(thread)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Cursor agents window ────────────────────────────────────────────────

const CURSOR_VISIBLE_PER_GROUP = 6;

function CursorStatusGlyph({ thread }: { thread: EnvironmentThreadShell }) {
  const status = resolveSidebarThreadStatus(thread);
  if (status !== "ready") return <ThreadActivityIndicator thread={thread} />;
  if (thread.branch != null || thread.worktreePath != null) {
    return <GitBranchIcon className="size-3.5 text-[#a78bfa]" strokeWidth={2} />;
  }
  return (
    <span aria-hidden="true" className="size-[5px] rounded-full bg-sidebar-muted-foreground/70" />
  );
}

function CursorAgentGroup({
  label,
  threads,
  props,
}: {
  label: string;
  threads: readonly EnvironmentThreadShell[];
  props: ProviderLayoutSidebarProps;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? threads : threads.slice(0, CURSOR_VISIBLE_PER_GROUP);
  return (
    <div role="list" aria-label={label} className="mb-3 flex flex-col gap-px">
      <SectionHeading label={label} />
      {visible.map((thread) => (
        <ThreadRow
          key={threadKeyOf(thread)}
          thread={thread}
          props={props}
          leading={<CursorStatusGlyph thread={thread} />}
        />
      ))}
      {threads.length > CURSOR_VISIBLE_PER_GROUP ? (
        <button
          type="button"
          data-provider-nav-row=""
          onClick={() => setExpanded((value) => !value)}
          className="flex items-center gap-2.5 rounded-md px-2 text-left text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
        >
          <EllipsisIcon className="size-4" />
          {expanded ? "Less" : "More"}
        </button>
      ) : null}
    </div>
  );
}

function CursorSidebarBody(props: ProviderLayoutSidebarProps) {
  const navigate = useAppNavigate();
  const groups = props.projects
    .map((project) => ({
      key: project.projectKey,
      label: project.displayName,
      threads: threadsInProject(project, props.codeThreads),
    }))
    .filter((group) => group.threads.length > 0);
  const leading = (thread: EnvironmentThreadShell) => <CursorStatusGlyph thread={thread} />;

  return (
    <>
      <nav aria-label="Workspace navigation" className="flex flex-col gap-px pt-1">
        <NavRow
          icon={SquarePenIcon}
          label={PROVIDER_LAYOUT_SPECS.cursor.newThreadLabel}
          active={props.newThreadActive}
          shortcutLabel={props.newThreadShortcutLabel}
          onClick={props.onNewThread}
        />
        <NavRow
          icon={PuzzleIcon}
          label="Marketplace"
          active={props.pluginsActive}
          onClick={() => void navigate({ to: "/plugins" })}
        />
      </nav>

      <div className="mt-4 flex flex-col gap-px">
        <SearchRow search={props.search} placeholder="Search agents" />
        {props.search.open && props.search.query.trim().length > 0 ? (
          <SearchResults props={props} renderLeading={leading} />
        ) : (
          <>
            {props.pinnedThreads.length > 0 ? (
              <CursorAgentGroup label="Pinned" threads={props.pinnedThreads} props={props} />
            ) : null}
            {groups.map((group) => (
              <CursorAgentGroup
                key={group.key}
                label={group.label}
                threads={group.threads}
                props={props}
              />
            ))}
            {props.chatThreads.length > 0 ? (
              <CursorAgentGroup label="Chats" threads={props.chatThreads} props={props} />
            ) : null}
            <NavRow icon={FolderPlusIcon} label="Open Workspace" onClick={props.onNewProject} />
          </>
        )}
      </div>
    </>
  );
}
