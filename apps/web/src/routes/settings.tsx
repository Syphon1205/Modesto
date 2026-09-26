import { useSettingsDialogStore } from "../settings/settingsDialogStore";
import {
  Outlet,
  createFileRoute,
  redirect,
  useCanGoBack,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import RestoreSettingsButton from "../components/settings/RestoreSettingsButton";
import { SettingsBreadcrumb } from "../components/settings/SettingsBreadcrumb";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import {
  ensureClientSettingsHydrated,
  getClientSettings,
  resolveInterfaceStyle,
  useInterfaceStyle,
} from "../hooks/useSettings";
import { isElectron } from "../env";

function SettingsContentLayout() {
  const interfaceStyle = useInterfaceStyle();
  const location = useLocation();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const [restoreSignal, setRestoreSignal] = useState(0);
  const showRestoreDefaults = location.pathname === "/settings/general";
  const handleRestored = () => setRestoreSignal((value) => value + 1);
  const navigateBackWithinApp = useCallback(() => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, navigate]);

  useEffect(() => {
    if (interfaceStyle === "github") {
      useSettingsDialogStore.getState().show(location.pathname, location.hash);
      void navigate({ to: "/", replace: true });
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();

        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }

        navigateBackWithinApp();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [interfaceStyle, navigateBackWithinApp, navigate, location.pathname, location.hash]);

  const content = (
    <SidebarInset
      data-opencode-settings-content=""
      className={
        interfaceStyle === "github"
          ? "h-full min-h-0 overflow-hidden bg-background text-foreground isolate"
          : "h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate"
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader
          data-opencode-settings-header=""
          electron={isElectron && interfaceStyle !== "github"}
        >
          <div className="flex w-full items-center gap-3">
            <SettingsBreadcrumb pathname={location.pathname} />
            {showRestoreDefaults ? (
              <div className="ms-auto flex items-center gap-2">
                <RestoreSettingsButton onRestored={handleRestored} />
              </div>
            ) : null}
          </div>
        </WorkspacePageHeader>

        <div key={restoreSignal} className="min-h-0 flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </SidebarInset>
  );

  return content;
}

function SettingsRouteLayout() {
  return <SettingsContentLayout />;
}

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context, location }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }

    await ensureClientSettingsHydrated();
    if (resolveInterfaceStyle(getClientSettings()) === "github") {
      useSettingsDialogStore.getState().show(location.pathname, location.hash);
      throw redirect({ to: "/", replace: true });
    }

    if (location.pathname === "/settings") {
      throw redirect({ to: "/settings/general", replace: true });
    }
  },
  component: SettingsRouteLayout,
});
