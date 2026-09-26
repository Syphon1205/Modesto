import { useState, type ReactNode } from "react";
import {
  ChevronRightIcon,
  EllipsisIcon,
  FolderIcon,
  FolderPlusIcon,
  ListFilterIcon,
  MessageCircleIcon,
  PlusIcon,
  SquarePenIcon,
} from "lucide-react";
import type { EnvironmentThreadShell } from "@modesto/client-runtime/state/models";
import type { SidebarProjectSnapshot } from "~/sidebarProjectGrouping";
import { disclosureChevronClassName } from "~/lib/disclosureMotion";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";

export function CopilotSessionTree({
  headingLabel = "Sessions",
  projects,
  chats,
  threads,
  renderThread,
  onNewChat,
  onNewProject,
  onNewSession,
  onProjectSettings,
  onDeleteProject,
  onMarkAllRead,
}: {
  headingLabel?: string;
  projects: readonly SidebarProjectSnapshot[];
  chats: readonly EnvironmentThreadShell[];
  threads: readonly EnvironmentThreadShell[];
  renderThread: (thread: EnvironmentThreadShell) => ReactNode;
  onMarkAllRead: () => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onNewSession: (project: SidebarProjectSnapshot) => void;
  onProjectSettings: (project: SidebarProjectSnapshot) => void;
  onDeleteProject: (project: SidebarProjectSnapshot) => void;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState("project");
  const [ordering, setOrdering] = useState("updated");
  const [show, setShow] = useState("all");
  const [openProjectMenuKey, setOpenProjectMenuKey] = useState<string | null>(null);
  const sorted = (rows: readonly EnvironmentThreadShell[]) =>
    [...rows].sort((a, b) =>
      ordering === "title"
        ? a.title.localeCompare(b.title)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const groups = [
    ...(show !== "projects"
      ? [
          {
            key: "chats",
            title: "Chats",
            rows: chats,
            onNew: onNewChat,
            chat: true,
            project: null as SidebarProjectSnapshot | null,
          },
        ]
      : []),
    ...(show !== "chats"
      ? projects.map((project) => ({
          key: project.projectKey,
          title: project.displayName,
          rows: threads.filter((thread) =>
            project.memberProjectRefs.some(
              (ref) =>
                ref.environmentId === thread.environmentId && ref.projectId === thread.projectId,
            ),
          ),
          onNew: () => onNewSession(project),
          chat: false,
          project: project as SidebarProjectSnapshot | null,
        }))
      : []),
  ];
  return (
    <>
      <div data-github-sessions-heading="">
        <span>{headingLabel}</span>
        <div>
          <Menu>
            <MenuTrigger aria-label="Configure sessions" title="Configure sessions">
              <ListFilterIcon />
            </MenuTrigger>
            <MenuPopup align="start" className="w-56">
              <MenuSub>
                <MenuSubTrigger>
                  Grouping
                  <span className="ml-auto text-muted-foreground">
                    {grouping === "project" ? "Project" : "None"}
                  </span>
                </MenuSubTrigger>
                <MenuSubPopup>
                  <MenuRadioGroup value={grouping} onValueChange={setGrouping}>
                    <MenuRadioItem value="project">Project</MenuRadioItem>
                    <MenuRadioItem value="none">None</MenuRadioItem>
                  </MenuRadioGroup>
                </MenuSubPopup>
              </MenuSub>
              <MenuSub>
                <MenuSubTrigger>
                  Ordering
                  <span className="ml-auto text-muted-foreground">
                    {ordering === "updated" ? "Updated" : "Title"}
                  </span>
                </MenuSubTrigger>
                <MenuSubPopup>
                  <MenuRadioGroup value={ordering} onValueChange={setOrdering}>
                    <MenuRadioItem value="updated">Updated</MenuRadioItem>
                    <MenuRadioItem value="title">Title</MenuRadioItem>
                  </MenuRadioGroup>
                </MenuSubPopup>
              </MenuSub>
              <MenuSub>
                <MenuSubTrigger>Show</MenuSubTrigger>
                <MenuSubPopup>
                  <MenuRadioGroup value={show} onValueChange={setShow}>
                    <MenuRadioItem value="all">All sessions</MenuRadioItem>
                    <MenuRadioItem value="chats">Chats</MenuRadioItem>
                    <MenuRadioItem value="projects">Project sessions</MenuRadioItem>
                  </MenuRadioGroup>
                </MenuSubPopup>
              </MenuSub>
              <MenuSeparator />
              <MenuItem
                onClick={() => {
                  setGrouping("project");
                  setOrdering("updated");
                  setShow("all");
                }}
              >
                Reset filters
              </MenuItem>
              <MenuItem onClick={() => setCollapsed(new Set(groups.map((group) => group.key)))}>
                Collapse all
              </MenuItem>
              <MenuItem onClick={() => setCollapsed(new Set())}>Expand all</MenuItem>
              <MenuItem onClick={onMarkAllRead}>Mark all as read</MenuItem>
            </MenuPopup>
          </Menu>
          <Menu>
            <MenuTrigger aria-label="New project or session" title="New project or session">
              <PlusIcon />
            </MenuTrigger>
            <MenuPopup align="start">
              <MenuItem onClick={onNewChat}>
                <MessageCircleIcon />
                New chat
              </MenuItem>
              <MenuItem onClick={onNewProject}>
                <FolderPlusIcon />
                New project
              </MenuItem>
              {projects.length > 0 ? <MenuSeparator /> : null}
              {projects.map((project) => (
                <MenuItem key={project.projectKey} onClick={() => onNewSession(project)}>
                  <SquarePenIcon />
                  New session in {project.displayName}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
        </div>
      </div>
      {grouping === "none" ? (
        <ul data-github-session-list="" aria-label="Sessions">
          {sorted(groups.flatMap((group) => group.rows)).map(renderThread)}
        </ul>
      ) : (
        groups.map((group) => {
          const open = !collapsed.has(group.key);
          return (
            <Collapsible
              key={group.key}
              open={open}
              onOpenChange={(nextOpen) =>
                setCollapsed((previous) => {
                  const next = new Set(previous);
                  if (nextOpen) next.delete(group.key);
                  else next.add(group.key);
                  return next;
                })
              }
            >
              <div
                className="group/copilot-project flex h-8 items-center rounded-md hover:bg-sidebar-accent"
                onContextMenu={
                  group.project
                    ? (event) => {
                        // Right-click opens the same menu as the "..." trigger - it
                        // must never fire the destructive action directly, one
                        // misclick away from "Remove project" is exactly the kind
                        // of thing that caused real data loss earlier.
                        event.preventDefault();
                        setOpenProjectMenuKey(group.key);
                      }
                    : undefined
                }
              >
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 px-2 text-left text-xs text-sidebar-foreground">
                  {group.chat ? (
                    <MessageCircleIcon className="size-4 shrink-0" />
                  ) : (
                    <FolderIcon className="size-4 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{group.title}</span>
                  <ChevronRightIcon
                    className={disclosureChevronClassName(
                      open,
                      "opacity-0 group-hover/copilot-project:opacity-70",
                    )}
                  />
                </CollapsibleTrigger>
                <button
                  type="button"
                  className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/copilot-project:opacity-100"
                  aria-label={group.chat ? "New chat" : `New session in ${group.title}`}
                  onClick={group.onNew}
                >
                  <SquarePenIcon className="size-3.5" />
                </button>
                {group.project ? (
                  <Menu
                    open={openProjectMenuKey === group.key}
                    onOpenChange={(nextOpen) => setOpenProjectMenuKey(nextOpen ? group.key : null)}
                  >
                    <MenuTrigger
                      render={
                        <button
                          type="button"
                          className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 data-[popup-open]:opacity-100 group-hover/copilot-project:opacity-100"
                          aria-label={`More options for ${group.title}`}
                          title={`More options for ${group.title}`}
                          onClick={(event) => event.stopPropagation()}
                        />
                      }
                    >
                      <EllipsisIcon className="size-3.5" />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuItem
                        onClick={() => onProjectSettings(group.project as SidebarProjectSnapshot)}
                      >
                        Project settings
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        variant="destructive"
                        onClick={() => onDeleteProject(group.project as SidebarProjectSnapshot)}
                      >
                        Remove project
                      </MenuItem>
                    </MenuPopup>
                  </Menu>
                ) : null}
              </div>
              <CollapsiblePanel>
                <ul
                  data-github-session-list=""
                  className="pl-6"
                  aria-label={`${group.title} sessions`}
                >
                  {group.rows.length ? (
                    sorted(group.rows).map(renderThread)
                  ) : (
                    <li className="px-2 py-2 text-xs text-muted-foreground">
                      {group.chat ? "No chats yet" : "No sessions yet"}
                    </li>
                  )}
                </ul>
              </CollapsiblePanel>
            </Collapsible>
          );
        })
      )}
    </>
  );
}
