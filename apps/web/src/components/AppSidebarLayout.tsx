import { SettingsDialog } from "./settings/SettingsDialog";
import { useAppNavigate } from "~/hooks/useAppNavigate";
import { useAtomValue } from "@effect/atom-react";
import * as Schema from "effect/Schema";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocation } from "@tanstack/react-router";
import { Grid2X2Icon, SettingsIcon } from "lucide-react";

import { isElectron } from "../env";
import { useCompactChatChrome } from "../lib/floatingChatChrome";
import { getLocalStorageItem, removeLocalStorageItem } from "../hooks/useLocalStorage";
import { resolveShortcutCommand, shortcutLabelForCommand } from "../keybindings";
import { cn, isMacPlatform } from "../lib/utils";
import { primaryServerKeybindingsAtom } from "../state/server";
import {
  useEnvironmentIdentificationMode,
  useInterfaceStyle,
  useLegacySidebarEnabled,
} from "../hooks/useSettings";
import { PROVIDER_LAYOUT_SPECS, providerLayoutOf } from "../providerLayouts";
import LegacyThreadSidebar from "./LegacySidebar";
import ThreadSidebar from "./Sidebar";
import { SettingsSidebarNav } from "./settings/SettingsSidebarNav";
import { SidebarChromeHeader } from "./sidebar/SidebarChrome";
import {
  resolveSidebarStageFocusRingOffsetClass,
  useSidebarStageBackdropVariant,
} from "./SidebarStageBackdrop";
import { useProjects } from "../state/entities";
import {
  resolveInitialThreadSidebarWidth,
  resolveThreadSidebarMaximumWidth,
  THREAD_MAIN_CONTENT_MIN_WIDTH,
  THREAD_SIDEBAR_MIN_WIDTH,
  THREAD_SIDEBAR_WIDTH_STORAGE_KEY,
} from "./threadSidebarWidth";
import {
  Sidebar,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
  useSidebarVisibility,
} from "./ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { ChatTabStrip } from "./chat/ChatTabStrip";
import { useChatTabNavigation } from "../hooks/useChatTabNavigation";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { startNewThreadFromContext } from "../lib/chatThreadActions";

const MACOS_TRAFFIC_LIGHTS_LEFT_INSET = "90px";

function subscribeToViewportWidth(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function readViewportWidth(): number {
  return window.innerWidth;
}

function readInitialThreadSidebarWidth(
  storageKey = THREAD_SIDEBAR_WIDTH_STORAGE_KEY,
  defaultWidth?: number,
): number {
  try {
    return resolveInitialThreadSidebarWidth(
      getLocalStorageItem(storageKey, Schema.Finite) ?? defaultWidth ?? null,
      window.innerWidth,
    );
  } catch (error) {
    console.error("Could not read persisted thread sidebar width.", error);
    return resolveInitialThreadSidebarWidth(defaultWidth ?? null, window.innerWidth);
  }
}

function SidebarControl() {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const { toggleSidebar } = useSidebar();
  const isSidebarVisible = useSidebarVisibility();
  const environmentIdentificationMode = useEnvironmentIdentificationMode();
  const stageBackdropVariant = useSidebarStageBackdropVariant(
    environmentIdentificationMode === "artwork",
  );
  const shortcutLabel = shortcutLabelForCommand(keybindings, "sidebar.toggle");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("[data-keybinding-capture]")
      ) {
        return;
      }
      if (resolveShortcutCommand(event, keybindings) !== "sidebar.toggle") return;

      event.preventDefault();
      event.stopPropagation();
      toggleSidebar();
    };

    // Capture before focused editors consume commands such as Mod+B for rich-text formatting.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [keybindings, toggleSidebar]);

  return (
    // The right-side layout controls carry mr-px (border compensation inside
    // the panel), so the trigger mirrors it: both clusters sit one extra pixel
    // off their edge and the titlebar reads symmetric.
    <div
      className="pointer-events-none fixed left-[var(--workspace-controls-left)] top-[var(--workspace-controls-top)] z-50 ml-px flex h-[var(--workspace-topbar-height)] items-center"
      data-sidebar-control=""
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarTrigger
              className={cn(
                "pointer-events-auto",
                isSidebarVisible &&
                  stageBackdropVariant &&
                  "focus-visible:ring-white/90 [&_svg]:stroke-white/90! [&_svg]:opacity-100! [&_svg]:hover:stroke-white! [:hover,[data-pressed]]:bg-white/15",
                isSidebarVisible &&
                  stageBackdropVariant &&
                  resolveSidebarStageFocusRingOffsetClass(stageBackdropVariant),
              )}
              aria-label="Toggle main sidebar"
            />
          }
        />
        <TooltipPopup side="bottom">
          Toggle main sidebar{shortcutLabel ? ` (${shortcutLabel})` : ""}
        </TooltipPopup>
      </Tooltip>
    </div>
  );
}

// Settings swaps the thread sidebar out of the tree. Keep the lightweight
// project projection subscribed so returning to a draft never renders the
// zero-project state while the environment snapshot reconnects.
function ProjectProjectionRetention() {
  useProjects();
  return null;
}

function OpenCodeTitlebar() {
  const navigate = useAppNavigate();
  const chatTabNavigation = useChatTabNavigation();
  const newThreadContext = useHandleNewThread();
  const openNewSession = () => {
    void startNewThreadFromContext({
      activeDraftThread: newThreadContext.activeDraftThread,
      activeThread: newThreadContext.activeThread ?? undefined,
      defaultProjectRef: newThreadContext.defaultProjectRef,
      handleNewThread: newThreadContext.handleNewThread,
    });
  };

  return (
    <header data-opencode-titlebar="" aria-label="OpenCode workspace controls">
      <button type="button" aria-label="Home" onClick={() => void navigate({ to: "/" })}>
        <Grid2X2Icon />
      </button>
      <ChatTabStrip
        onActivate={chatTabNavigation.activateTab}
        onNewTab={openNewSession}
        onClose={chatTabNavigation.closeTab}
      />
      <div data-opencode-titlebar-drag="" />
      <button
        type="button"
        aria-label="Settings"
        onClick={() => void navigate({ to: "/settings/general" })}
      >
        <SettingsIcon />
      </button>
    </header>
  );
}

export function AppSidebarLayout({ children }: { children: ReactNode }) {
  const navigate = useAppNavigate();
  const compactChrome = useCompactChatChrome();
  const interfaceStyle = useInterfaceStyle();
  const legacySidebarEnabled = useLegacySidebarEnabled();
  // Settings routes show the settings nav in place of whichever thread
  // sidebar is active.
  const pathname = useLocation({ select: (location) => location.pathname });
  const isOnSettings = pathname === "/settings" || pathname.startsWith("/settings/");
  const isMacosDesktop = isElectron && isMacPlatform(navigator.platform);
  const providerLayout = providerLayoutOf(interfaceStyle);
  const sidebarStorageKey =
    interfaceStyle === "github"
      ? "copilot_sidebar_width"
      : providerLayout !== null
        ? `provider_sidebar_width_${providerLayout}`
        : THREAD_SIDEBAR_WIDTH_STORAGE_KEY;
  const defaultSidebarWidth =
    interfaceStyle === "github"
      ? 280
      : providerLayout !== null
        ? PROVIDER_LAYOUT_SPECS[providerLayout].sidebarWidth
        : undefined;
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readInitialThreadSidebarWidth(sidebarStorageKey, defaultSidebarWidth),
  );
  useEffect(() => {
    setSidebarWidth(readInitialThreadSidebarWidth(sidebarStorageKey, defaultSidebarWidth));
  }, [sidebarStorageKey, defaultSidebarWidth]);
  // Subscribed rather than read once: the clamp must track live window size,
  // and a clamped drag ends with an unchanged width, which skips the re-render
  // that would otherwise refresh a render-time snapshot.
  const viewportWidth = useSyncExternalStore(subscribeToViewportWidth, readViewportWidth);
  const sidebarMaximumWidth = resolveThreadSidebarMaximumWidth(viewportWidth);
  const resetSidebarWidth = () => {
    try {
      removeLocalStorageItem(sidebarStorageKey);
    } catch (error) {
      console.error("Could not clear persisted thread sidebar width.", error);
    }
    setSidebarWidth(resolveInitialThreadSidebarWidth(defaultSidebarWidth ?? null, viewportWidth));
  };
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(() => {
    const getWindowFullscreenState = window.desktopBridge?.getWindowFullscreenState;
    return isMacosDesktop && typeof getWindowFullscreenState === "function"
      ? getWindowFullscreenState()
      : false;
  });
  const sidebarProviderStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
    ...(isMacosDesktop && !isWindowFullscreen
      ? { "--workspace-controls-left": MACOS_TRAFFIC_LIGHTS_LEFT_INSET }
      : {}),
  } as CSSProperties;

  useEffect(() => {
    if (!isMacosDesktop) return;
    const bridge = window.desktopBridge;
    if (!bridge) return;
    const { getWindowFullscreenState, onWindowFullscreenStateChange } = bridge;
    if (
      typeof getWindowFullscreenState !== "function" ||
      typeof onWindowFullscreenStateChange !== "function"
    ) {
      return;
    }

    const unsubscribe = onWindowFullscreenStateChange(setIsWindowFullscreen);
    setIsWindowFullscreen(getWindowFullscreenState());
    return unsubscribe;
  }, [isMacosDesktop]);

  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function") {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      if (action === "open-settings") {
        const isSettingsRoute = /^\/settings(\/|$)/.test(pathname);
        if (!isSettingsRoute) {
          void navigate({ to: "/settings" });
        }
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [navigate, pathname]);

  return (
    <SidebarProvider
      className="h-dvh! min-h-0!"
      defaultOpen
      style={sidebarProviderStyle}
      data-interface-shell={interfaceStyle}
      data-opencode-settings={interfaceStyle === "opencode" && isOnSettings ? "" : undefined}
    >
      <ProjectProjectionRetention />
      {interfaceStyle === "opencode" && !compactChrome ? <OpenCodeTitlebar /> : null}
      {compactChrome || (interfaceStyle === "opencode" && !isOnSettings) ? null : (
        <Sidebar
          side="left"
          variant="sidebar"
          collapsible="offcanvas"
          data-interface-sidebar={interfaceStyle}
          data-app-sidebar=""
          className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
          resizable={
            interfaceStyle === "opencode"
              ? false
              : {
                  maxWidth: sidebarMaximumWidth,
                  minWidth: THREAD_SIDEBAR_MIN_WIDTH,
                  shouldAcceptWidth: ({ currentWidth, nextWidth, wrapper }) =>
                    nextWidth <= currentWidth ||
                    wrapper.clientWidth - nextWidth >= THREAD_MAIN_CONTENT_MIN_WIDTH,
                  storageKey: sidebarStorageKey,
                  onResize: setSidebarWidth,
                }
          }
        >
          {isOnSettings && interfaceStyle !== "github" ? (
            <>
              <SidebarChromeHeader isElectron={isElectron} />
              <SettingsSidebarNav pathname={pathname} />
            </>
          ) : legacySidebarEnabled ? (
            <LegacyThreadSidebar />
          ) : (
            <ThreadSidebar />
          )}
          {interfaceStyle === "opencode" ? null : <SidebarRail onDoubleClick={resetSidebarWidth} />}
        </Sidebar>
      )}
      {children}
      <SettingsDialog />
      {compactChrome || interfaceStyle === "opencode" || providerLayout !== null ? null : (
        <SidebarControl />
      )}
    </SidebarProvider>
  );
}
