import { scopeProjectRef } from "@modesto/client-runtime/environment";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderPlusIcon, LinkIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { openCommandPalette } from "../commandPaletteBus";
import { ModestoLogo } from "../components/ModestoLogo";
import { sortScopedProjectsForSidebar } from "../components/Sidebar.logic";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";
import { randomHomeLandingGreeting } from "../lib/greeting";
import { unscopedChatProjectRef } from "../lib/chatThreadActions";
import {
  useAllEnvironmentShellsBootstrapped,
  useProjects,
  useThreadShells,
} from "../state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "../state/environments";
import { APP_DISPLAY_NAME } from "~/branding";
import { hasCloudPublicConfig } from "~/cloud/publicConfig";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const { environments } = useEnvironments();

  if (authGateState.status === "hosted-static" && environments.length === 0) {
    return <HostedStaticOnboardingState />;
  }

  return <IndexDraftLanding />;
}

/**
 * Landing on the index route drops straight into a draft thread for the most
 * recently active project, so the first screen is a prompt instead of a dead
 * end. With no project yet, chats still open an unscoped composer.
 */
function IndexDraftLanding() {
  const projects = useProjects();
  const threads = useThreadShells();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const handleNewThread = useNewThreadHandler();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const startingRef = useRef(false);
  const [startState, setStartState] = useState({ failed: false, retryRequest: 0 });

  const mostRecentProject = useMemo(
    () =>
      bootstrapped
        ? (sortScopedProjectsForSidebar(projects, threads, "updated_at")[0] ?? null)
        : null,
    [bootstrapped, projects, threads],
  );

  useEffect(() => {
    if (!bootstrapped || startingRef.current) {
      return;
    }
    if (mostRecentProject !== null) {
      startingRef.current = true;
      void handleNewThread(scopeProjectRef(mostRecentProject.environmentId, mostRecentProject.id), {
        replace: true,
        conversationMode: "chat",
      }).catch(() => {
        startingRef.current = false;
        setStartState((state) => ({ ...state, failed: true }));
      });
      return;
    }
    if (primaryEnvironmentId === null) {
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
  }, [
    bootstrapped,
    handleNewThread,
    mostRecentProject,
    primaryEnvironmentId,
    startState.retryRequest,
  ]);

  if (!bootstrapped) {
    return null;
  }
  if (mostRecentProject !== null || primaryEnvironmentId !== null) {
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
  return <NoProjectsHero />;
}

function DraftStartError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <Empty className="flex-1">
        <EmptyHeader className="max-w-md">
          <EmptyTitle className="text-foreground text-xl">Couldn’t start a new thread</EmptyTitle>
          <EmptyDescription className="mt-2 text-sm text-muted-foreground/78">
            The project is still available. Try opening the draft again.
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

// Same visual language as the real chat landing (logo, greeting, centered
// composer-width card) - clicking the Modesto logo with zero projects lands
// here, so it should read as "the same chat window, just needing a project"
// rather than a different, flatter dead-end screen.
function NoProjectsHero() {
  const openAddProject = useCallback(() => openCommandPalette({ open: "add-project" }), []);
  const [greeting] = useState(randomHomeLandingGreeting);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-5 overflow-x-hidden bg-background px-6 pt-[8vh] text-center select-none">
        <ModestoLogo aria-label="Modesto logo" className="size-10" />
        <h1 className="font-normal text-2xl text-foreground tracking-tight sm:text-3xl">
          {greeting}
        </h1>
        <button
          type="button"
          onClick={openAddProject}
          className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-8 text-center transition-colors hover:border-foreground/30 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <FolderPlusIcon className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground/90">Add a project</span>
          <span className="text-xs text-muted-foreground/70">
            Pick a folder to start your first thread.
          </span>
        </button>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});

function HostedStaticOnboardingState() {
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
                <Button render={<Link to="/settings/connections" />} size="sm">
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
