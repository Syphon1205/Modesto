import { useAppNavigate } from "~/hooks/useAppNavigate";
import { scopeProjectRef, scopeThreadRef } from "@modesto/client-runtime/environment";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CircleHelpIcon,
  FolderPlusIcon,
  EllipsisIcon,
  LinkIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { openCommandPalette } from "../commandPaletteBus";
import { sortScopedProjectsForSidebar } from "../components/Sidebar.logic";
import { OpenCodeProjectAvatar } from "../components/OpenCodeProjectAvatar";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../components/ui/menu";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";
import { useClientSettingsHydrated, useInterfaceStyle } from "../hooks/useSettings";
import { unscopedChatProjectRef } from "../lib/chatThreadActions";
import {
  useAllEnvironmentShellsBootstrapped,
  useProjects,
  useThreadShells,
} from "../state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "../state/environments";
import { APP_DISPLAY_NAME } from "~/branding";
import { hasCloudPublicConfig } from "~/cloud/publicConfig";
import { buildThreadRouteParams } from "../threadRoutes";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const { environments } = useEnvironments();
  const interfaceStyle = useInterfaceStyle();
  const settingsHydrated = useClientSettingsHydrated();

  if (!settingsHydrated) return null;

  if (authGateState.status === "hosted-static" && environments.length === 0) {
    return <HostedStaticOnboardingState />;
  }

  if (interfaceStyle === "opencode") return <OpenCodeHome />;

  return <IndexDraftLanding />;
}

function OpenCodeHome() {
  const projects = useProjects();
  const threads = useThreadShells();
  const navigate = useAppNavigate();
  const handleNewThread = useNewThreadHandler();
  const [search, setSearch] = useState("");
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const sortedProjects = useMemo(
    () => sortScopedProjectsForSidebar(projects, threads, "updated_at"),
    [projects, threads],
  );

  useEffect(() => {
    if (
      selectedProjectKey === null ||
      !sortedProjects.some(
        (project) => `${project.environmentId}:${project.id}` === selectedProjectKey,
      )
    ) {
      const first = sortedProjects[0];
      setSelectedProjectKey(first ? `${first.environmentId}:${first.id}` : null);
    }
  }, [selectedProjectKey, sortedProjects]);

  const selectedProject =
    sortedProjects.find(
      (project) => `${project.environmentId}:${project.id}` === selectedProjectKey,
    ) ?? null;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const sessions = useMemo(
    () =>
      threads
        .filter(
          (thread) =>
            thread.archivedAt === null &&
            thread.parentThreadId == null &&
            thread.conversationMode !== "chat" &&
            selectedProject !== null &&
            thread.environmentId === selectedProject.environmentId &&
            thread.projectId === selectedProject.id &&
            (normalizedSearch.length === 0 ||
              thread.title.toLocaleLowerCase().includes(normalizedSearch)),
        )
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [normalizedSearch, selectedProject, threads],
  );
  const today = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toDateString();
  const todaySessions = sessions.filter(
    (thread) => new Date(thread.updatedAt).toDateString() === today,
  );
  const yesterdaySessions = sessions.filter(
    (thread) => new Date(thread.updatedAt).toDateString() === yesterday,
  );
  const olderSessions = sessions.filter((thread) => {
    const updatedDay = new Date(thread.updatedAt).toDateString();
    return updatedDay !== today && updatedDay !== yesterday;
  });
  const openNewSession = useCallback(() => {
    if (selectedProject === null) {
      openCommandPalette({ open: "add-project" });
      return;
    }
    void handleNewThread(scopeProjectRef(selectedProject.environmentId, selectedProject.id));
  }, [handleNewThread, selectedProject]);
  const openSession = useCallback(
    (environmentId: string, threadId: string) => {
      void navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(scopeThreadRef(environmentId, threadId)),
      });
    },
    [navigate],
  );

  const renderSessions = (label: string, items: typeof sessions) =>
    items.length === 0 ? null : (
      <section data-opencode-home-session-group="">
        <h2>{label}</h2>
        {items.map((thread) => (
          <button
            key={`${thread.environmentId}:${thread.id}`}
            type="button"
            onClick={() => openSession(thread.environmentId, thread.id)}
          >
            <OpenCodeProjectAvatar
              environmentId={selectedProject?.environmentId ?? thread.environmentId}
              cwd={selectedProject?.workspaceRoot ?? null}
              faviconPath={selectedProject?.faviconPath ?? null}
              label={selectedProject?.title ?? thread.title}
            />
            <span>{thread.title}</span>
          </button>
        ))}
      </section>
    );

  const utilityNav = (mobile: boolean) => (
    <nav data-opencode-home-utility="" data-mobile={mobile || undefined}>
      <button type="button" onClick={() => void navigate({ to: "/settings" })}>
        <SettingsIcon />
        <span>Settings</span>
      </button>
      <a href="https://opencode.ai/docs" target="_blank" rel="noreferrer">
        <CircleHelpIcon />
        <span>Help</span>
      </a>
    </nav>
  );

  return (
    <SidebarInset data-opencode-home="" className="h-dvh min-h-0 overflow-hidden text-foreground">
      <div data-opencode-home-surface="">
        <aside data-opencode-home-projects="">
          <div data-opencode-home-section-heading="">
            <span>Projects</span>
            <button
              type="button"
              aria-label="Add project"
              onClick={() => openCommandPalette({ open: "add-project" })}
            >
              <FolderPlusIcon />
            </button>
          </div>
          <div data-opencode-home-project-list="">
            {sortedProjects.map((project) => {
              const key = `${project.environmentId}:${project.id}`;
              return (
                <div
                  key={key}
                  data-opencode-home-project-row=""
                  data-active={key === selectedProjectKey || undefined}
                >
                  <button type="button" onClick={() => setSelectedProjectKey(key)}>
                    <OpenCodeProjectAvatar
                      environmentId={project.environmentId}
                      cwd={project.workspaceRoot}
                      faviconPath={project.faviconPath}
                      label={project.title}
                    />
                    <span>{project.title}</span>
                  </button>
                  <button
                    type="button"
                    data-opencode-project-new-session=""
                    aria-label={`New session in ${project.title}`}
                    onClick={() =>
                      void handleNewThread(scopeProjectRef(project.environmentId, project.id))
                    }
                  >
                    <SquarePenIcon />
                  </button>
                  <Menu>
                    <MenuTrigger
                      render={
                        <button
                          type="button"
                          data-opencode-project-more=""
                          aria-label={`More options for ${project.title}`}
                          title={`More options for ${project.title}`}
                        />
                      }
                    >
                      <EllipsisIcon />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuItem
                        onClick={() =>
                          void navigate({
                            to: "/projects/$projectKey",
                            params: { projectKey: key },
                          })
                        }
                      >
                        Project settings
                      </MenuItem>
                      <MenuItem
                        onClick={() =>
                          void handleNewThread(scopeProjectRef(project.environmentId, project.id))
                        }
                      >
                        New session
                      </MenuItem>
                    </MenuPopup>
                  </Menu>
                </div>
              );
            })}
          </div>
          {utilityNav(false)}
        </aside>

        <main data-opencode-home-sessions="">
          <div data-opencode-home-search="">
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder={`Search sessions${selectedProject ? ` in ${selectedProject.title}` : ""}`}
              aria-label="Search sessions"
            />
          </div>
          <div data-opencode-home-new-session="">
            <span />
            <button type="button" onClick={openNewSession}>
              <SquarePenIcon />
              New session
            </button>
          </div>
          <div data-opencode-home-session-list="">
            {renderSessions("Today", todaySessions)}
            {renderSessions("Yesterday", yesterdaySessions)}
            {renderSessions(
              todaySessions.length === 0 && yesterdaySessions.length === 0
                ? "Recent sessions"
                : "Older",
              olderSessions,
            )}
            {sessions.length === 0 ? <p>No sessions yet</p> : null}
          </div>
        </main>
        {utilityNav(true)}
      </div>
    </SidebarInset>
  );
}

/**
 * Landing on the index route always opens an unscoped chat. Project context
 * is introduced only through an explicit handoff into the Projects surface.
 */
function IndexDraftLanding() {
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const handleNewThread = useNewThreadHandler();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const startingRef = useRef(false);
  const [startState, setStartState] = useState({ failed: false, retryRequest: 0 });

  useEffect(() => {
    if (!bootstrapped || primaryEnvironmentId === null || startingRef.current) {
      return;
    }
    startingRef.current = true;
    void handleNewThread(unscopedChatProjectRef(primaryEnvironmentId), {
      replace: true,
      conversationMode: "chat",
    }).catch(() => {
      startingRef.current = false;
      setStartState((state) => ({ ...state, failed: true }));
    });
  }, [bootstrapped, handleNewThread, primaryEnvironmentId, startState.retryRequest]);

  if (!bootstrapped) {
    return null;
  }
  if (primaryEnvironmentId !== null) {
    return startState.failed ? (
      <DraftStartError
        onRetry={() => {
          startingRef.current = false;
          setStartState((state) => ({
            failed: false,
            retryRequest: state.retryRequest + 1,
          }));
        }}
      />
    ) : null;
  }
  return null;
}

function DraftStartError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <Empty className="flex-1">
        <EmptyHeader className="max-w-md">
          <EmptyTitle className="text-foreground text-xl">Couldn’t start a new chat</EmptyTitle>
          <EmptyDescription className="mt-2 text-sm text-muted-foreground/78">
            Chat is still available. Try opening the draft again.
          </EmptyDescription>
          <div className="mt-5 flex justify-center">
            <Button size="sm" onClick={onRetry}>
              <RotateCcwIcon className="size-4" />
              Try again
            </Button>
          </div>
        </EmptyHeader>
      </Empty>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});

function HostedStaticOnboardingState() {
  const navigate = useAppNavigate();
  const cloudEnabled = hasCloudPublicConfig();

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <WorkspacePageHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
              {APP_DISPLAY_NAME}
            </span>
          </div>
        </WorkspacePageHeader>

        <Empty className="flex-1">
          <div className="w-full max-w-xl rounded-3xl border border-border/55 bg-card/20 px-8 py-12 shadow-sm/5">
            <EmptyHeader className="max-w-none">
              <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground">
                <LinkIcon className="size-5" />
              </div>
              <EmptyTitle className="text-foreground text-xl">
                Connect an environment to get started
              </EmptyTitle>
              <EmptyDescription className="mt-2 text-sm leading-relaxed text-muted-foreground/78">
                {cloudEnabled
                  ? "Sign in to T3 Connect to connect a linked environment through its managed tunnel, or add a reachable backend manually."
                  : "Add a reachable backend manually to start working from this browser."}
              </EmptyDescription>
              <div className="mt-6 flex justify-center">
                <Button onClick={() => void navigate({ to: "/settings/connections" })} size="sm">
                  <PlusIcon className="size-4" />
                  {cloudEnabled ? "Open Connections" : "Add environment"}
                </Button>
              </div>
            </EmptyHeader>
          </div>
        </Empty>
      </div>
    </SidebarInset>
  );
}
