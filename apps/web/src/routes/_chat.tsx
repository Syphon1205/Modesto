import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCompactChatChrome } from "../lib/floatingChatChrome";
import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { useChatTabsStore } from "../chatTabsStore";
import { isCommandPaletteOpen } from "../commandPaletteBus";
import { useClientSettings } from "../hooks/useSettings";
import { SpeakingPresenceChip } from "../components/ambient/SpeakingPresenceChip";
import { AmbientPresenceLayer } from "../components/ambient/AmbientPresenceLayer";
import { DesktopRendererActivityLayer } from "../components/DesktopRendererActivityLayer";
import { dispatchPreviewAction } from "../components/preview/previewActionBus";
import { useChatTabNavigation } from "../hooks/useChatTabNavigation";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { startNewThreadFromContext } from "../lib/chatThreadActions";
import { isPreviewFocused } from "../lib/previewFocus";
import { isTerminalFocused } from "../lib/terminalFocus";
import { resolveShortcutCommand } from "../keybindings";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../terminalUiStateStore";
import { isPreviewSupportedInRuntime } from "../previewStateStore";
import { selectActiveRightPanel, useRightPanelStore } from "../rightPanelStore";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { primaryServerKeybindingsAtom } from "~/state/server";

function ChatRouteGlobalShortcuts() {
  const navigate = useNavigate();
  const chatTabNavigation = useChatTabNavigation();
  const clearSelection = useThreadSelectionStore((state) => state.clearSelection);
  const selectedThreadKeysSize = useThreadSelectionStore((state) => state.selectedThreadKeys.size);
  const {
    activeDraftThread,
    activeThread,
    defaultProjectRef,
    unscopedChatProjectRef,
    handleNewThread,
    routeThreadRef,
  } = useHandleNewThread();
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const chatTabsEnabled = useClientSettings((settings) => settings.chatTabsEnabled);
  const terminalOpen = useTerminalUiStateStore((state) =>
    routeThreadRef
      ? selectThreadTerminalUiState(state.terminalUiStateByThreadKey, routeThreadRef).terminalOpen
      : false,
  );
  // The `previewOpen` shortcut-context flag here uses the store-only value;
  // the URL-aware arbitration lives inside ChatView's `onTogglePreview`,
  // which we invoke via the action bus to avoid duplicating the rule.
  const previewOpen = useRightPanelStore((state) =>
    routeThreadRef
      ? selectActiveRightPanel(state.byThreadKey, routeThreadRef) === "preview"
      : false,
  );
  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: isTerminalFocused(),
          terminalOpen,
          previewFocus: isPreviewFocused(),
          previewOpen,
        },
      });

      if (isCommandPaletteOpen()) {
        return;
      }

      if (event.key === "Escape" && selectedThreadKeysSize > 0) {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (command === "chat.newLocal") {
        event.preventDefault();
        event.stopPropagation();
        void startNewThreadFromContext({
          activeDraftThread,
          activeThread: activeThread ?? undefined,
          defaultProjectRef,
          handleNewThread,
        });
        return;
      }

      if (command === "chat.new") {
        event.preventDefault();
        event.stopPropagation();
        // Match the sidebar's New Chat action: open a fresh chat landing
        // where Chat vs Work can still be chosen before the first send.
        void startNewThreadFromContext(
          {
            activeDraftThread,
            activeThread: activeThread ?? undefined,
            defaultProjectRef,
            unscopedChatProjectRef,
            handleNewThread,
          },
          { conversationMode: "chat" },
        );
        return;
      }

      if (command === "tab.new") {
        // Tabs are opt-in. With the strip hidden this shortcut would create a
        // thread whose tab nobody can see, so it falls through to the ordinary
        // new-thread path instead of pretending the strip exists.
        if (!chatTabsEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        // A new tab *is* a new thread, so this routes through the exact same
        // creation path as `chat.new` rather than a parallel one - a bare
        // `/draft/<new-id>` has no draft session behind it and bounces to `/`.
        void startNewThreadFromContext({
          activeDraftThread,
          activeThread: activeThread ?? undefined,
          defaultProjectRef,
          handleNewThread,
        });
        return;
      }

      if (command === "tab.close") {
        if (!chatTabsEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        // Same implementation the strip's x button uses, so the two paths
        // cannot drift apart on where they leave you.
        const { activeKey } = useChatTabsStore.getState();
        if (activeKey !== null) chatTabNavigation.closeTab(activeKey);
        return;
      }

      if (command === "preview.toggle") {
        event.preventDefault();
        event.stopPropagation();
        if (!routeThreadRef) return;
        if (!isPreviewSupportedInRuntime()) {
          toastManager.add(
            stackedThreadToast({
              type: "info",
              title: "Preview is desktop-only",
              description: "Open Modesto in the desktop app to use the in-app preview.",
            }),
          );
          return;
        }
        dispatchPreviewAction("toggle-panel");
        return;
      }

      // The remaining preview commands only fire when the panel is the
      // currently-focused tenant. The `when: previewFocus` rule already
      // gates this, but defend against the keybinding being misconfigured.
      if (
        command === "preview.refresh" ||
        command === "preview.focusUrl" ||
        command === "preview.zoomIn" ||
        command === "preview.zoomOut" ||
        command === "preview.resetZoom"
      ) {
        event.preventDefault();
        event.stopPropagation();
        const action =
          command === "preview.refresh"
            ? "refresh"
            : command === "preview.focusUrl"
              ? "focus-url"
              : command === "preview.zoomIn"
                ? "zoom-in"
                : command === "preview.zoomOut"
                  ? "zoom-out"
                  : "reset-zoom";
        dispatchPreviewAction(action);
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    activeDraftThread,
    activeThread,
    clearSelection,
    handleNewThread,
    keybindings,
    defaultProjectRef,
    previewOpen,
    routeThreadRef,
    selectedThreadKeysSize,
    chatTabNavigation,
    chatTabsEnabled,
    navigate,
    terminalOpen,
  ]);

  return null;
}

function ChatRouteLayout() {
  const compactChrome = useCompactChatChrome();
  return (
    <>
      {compactChrome ? null : <ChatRouteGlobalShortcuts />}
      {compactChrome ? null : <AmbientPresenceLayer />}
      <DesktopRendererActivityLayer />
      {compactChrome ? null : <SpeakingPresenceChip />}
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_chat")({
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: ChatRouteLayout,
});
