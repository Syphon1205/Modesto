import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { XIcon } from "lucide-react";
import { useInterfaceStyle } from "../../hooks/useSettings";
import { useSettingsDialogStore } from "../../settings/settingsDialogStore";
import { Dialog, DialogPopup, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import CopilotCustomizeSettings from "./CopilotCustomizeSettings";
import { CopilotSettingsNavigation, COPILOT_SETTINGS_SECTIONS } from "./CopilotSettingsNavigation";
import { settingsSectionLabel } from "./SettingsBreadcrumb";

const RestoreSettingsButton = lazy(() => import("./RestoreSettingsButton"));
const General = lazy(() =>
  import("./SettingsPanels").then((m) => ({ default: m.GeneralSettingsPanel })),
);
const Appearance = lazy(() =>
  import("./SettingsPanels").then((m) => ({ default: m.AppearanceSettingsPanel })),
);
const Archived = lazy(() =>
  import("./SettingsPanels").then((m) => ({ default: m.ArchivedThreadsPanel })),
);
const Providers = lazy(() =>
  import("./ProviderSettingsPanel").then((m) => ({ default: m.ProviderSettingsPanel })),
);
const Keybindings = lazy(() =>
  import("./KeybindingsSettings").then((m) => ({ default: m.KeybindingsSettingsPanel })),
);
const SourceControl = lazy(() =>
  import("./SourceControlSettings").then((m) => ({ default: m.SourceControlSettingsPanel })),
);
const Integrations = lazy(() =>
  import("./IntegrationsSettings").then((m) => ({ default: m.IntegrationsSettingsPanel })),
);
const Connections = lazy(() =>
  import("./ConnectionsSettings").then((m) => ({ default: m.ConnectionsSettings })),
);
const Customize = CopilotCustomizeSettings;
const Diagnostics = lazy(() =>
  import("./DiagnosticsSettings").then((m) => ({ default: m.DiagnosticsSettingsPanel })),
);

const CopilotGeneral = lazy(() =>
  import("./CopilotPreferences").then((m) => ({ default: m.CopilotGeneralSettings })),
);
const Sessions = lazy(() =>
  import("./CopilotPreferences").then((m) => ({ default: m.CopilotSessionsSettings })),
);
const Experimental = lazy(() =>
  import("./CopilotPreferences").then((m) => ({ default: m.CopilotExperimentalSettings })),
);
const Accounts = lazy(() =>
  import("./CopilotPreferences").then((m) => ({ default: m.CopilotAccountsSettings })),
);

const PANELS: Record<string, ComponentType> = {
  "/settings/general": CopilotGeneral,
  "/settings/advanced": General,
  "/settings/sessions": Sessions,
  "/settings/experimental": Experimental,
  "/settings/appearance": Appearance,
  "/settings/archived": Archived,
  "/settings/providers": Providers,
  "/settings/connections": Accounts,
  "/settings/keybindings": Keybindings,
  "/settings/source-control": SourceControl,
  "/settings/integrations": Customize,
  "/settings/diagnostics": Diagnostics,
  "/settings/integration-preferences": Integrations,
  "/settings/environment-connections": Connections,
};

export function SettingsDialog() {
  const { open, pathname, close } = useSettingsDialogStore();
  const interfaceStyle = useInterfaceStyle();
  const [restoreSignal, setRestoreSignal] = useState(0);
  useEffect(() => {
    if (interfaceStyle !== "github") close();
  }, [interfaceStyle, close]);
  const Panel = PANELS[pathname] ?? General;
  return (
    <Dialog
      open={open && interfaceStyle === "github"}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogPopup
        showCloseButton={false}
        bottomStickOnMobile={false}
        className="copilot-settings-dialog"
        data-settings-dialog=""
        data-interface-shell="github"
        data-opencode-settings=""
        aria-describedby={undefined}
      >
        <aside aria-label="Settings navigation" className="copilot-settings-navigation">
          <CopilotSettingsNavigation />
        </aside>
        <section className="copilot-settings-content">
          <header className="copilot-settings-header">
            <DialogTitle className="text-[13px] font-semibold leading-5">
              {COPILOT_SETTINGS_SECTIONS.find((section) => section.path === pathname)?.label ??
                (
                  {
                    "/settings/advanced": "Preferences",
                    "/settings/integration-preferences": "Integration preferences",
                    "/settings/environment-connections": "Connections",
                  } as Record<string, string>
                )[pathname] ??
                settingsSectionLabel(pathname, "classic")}
            </DialogTitle>
            {pathname === "/settings/advanced" ? (
              <Suspense fallback={null}>
                <RestoreSettingsButton onRestored={() => setRestoreSignal((value) => value + 1)} />
              </Suspense>
            ) : null}
            <Button size="icon-xs" variant="ghost" aria-label="Close settings" onClick={close}>
              <XIcon />
            </Button>
          </header>
          <div
            key={`${pathname}:${restoreSignal}`}
            className="flex min-h-0 flex-1 flex-col"
            id="settings-dialog-content"
            tabIndex={-1}
          >
            <Suspense
              fallback={
                <p role="status" className="p-5 text-sm text-muted-foreground">
                  Loading settings…
                </p>
              }
            >
              <Panel />
            </Suspense>
          </div>
        </section>
      </DialogPopup>
    </Dialog>
  );
}
