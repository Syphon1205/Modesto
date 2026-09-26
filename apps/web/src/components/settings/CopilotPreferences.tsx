import { APP_VERSION } from "../../branding";
import { NotificationSoundSettings } from "./NotificationSoundSettings";
import { usePrimarySettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import { useTheme } from "../../hooks/useTheme";
import { getThemeDefinition } from "../../themePalette";
import { useSettingsDialogStore } from "../../settings/settingsDialogStore";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { getThemeCardDefinition, STANDARD_THEME_CARDS } from "./ThemePreviewCircles";
import { ThemeWireframe } from "./ThemeWireframe";
import { GitHubAccountRow } from "../sidebar/GitHubAccountRow";
import { AboutVersionSection } from "./SettingsPanels";
import { isElectron } from "../../env";

export function CopilotGeneralSettings() {
  const settings = usePrimarySettings();
  const update = useUpdatePrimarySettings();
  const show = useSettingsDialogStore((state) => state.show);
  const { theme, themeHalves, resolvedTheme } = useTheme();
  const definition = getThemeDefinition(themeHalves?.[resolvedTheme] ?? theme);
  const card = definition ? getThemeCardDefinition(definition) : STANDARD_THEME_CARDS[0]!;
  const colors = (
    card.previews.find((preview) => preview.mode === resolvedTheme) ?? card.previews[0]!
  ).colors;
  return (
    <SettingsPageContainer>
      <SettingsSection title="General">
        {isElectron ? (
          <AboutVersionSection />
        ) : (
          <SettingsRow
            id="about"
            title={`Modesto ${APP_VERSION}`}
            description="Your workspace for coding agents."
          />
        )}
        <SettingsRow title="Current theme" description="Customize the app’s color palette.">
          <div className="mt-2 flex items-center gap-3 rounded-lg bg-muted/40 p-3">
            <ThemeWireframe className="h-16 w-24 shrink-0 rounded-md" panes={[{ colors }]} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{card.label}</p>
              <div aria-hidden className="mt-1 flex gap-0.5">
                {[
                  colors.accent,
                  colors.messageAction,
                  "#d73a49",
                  "#e3b341",
                  "#3fb950",
                  "#58a6ff",
                  "#a371f7",
                ].map((color, i) => (
                  <span key={i} className="size-2 rounded-xs" style={{ background: color }} />
                ))}
              </div>
            </div>
            <Button size="xs" variant="outline" onClick={() => show("/settings/appearance")}>
              Change theme
            </Button>
          </div>
        </SettingsRow>
        <SettingsRow
          title="Delete chats without confirmation"
          description="Skip the confirmation dialog when deleting chats."
          control={
            <Switch
              aria-label="Delete chats without confirmation"
              checked={!settings.confirmThreadDelete}
              onCheckedChange={(checked) => update({ confirmThreadDelete: !checked })}
            />
          }
        />
        <SettingsRow
          title="Confirm before quitting"
          description="Hold the quit shortcut to avoid closing the desktop app accidentally."
          control={
            <Switch
              aria-label="Confirm before quitting"
              checked={settings.confirmQuit}
              onCheckedChange={(checked) => update({ confirmQuit: checked })}
            />
          }
        />
        <SettingsRow
          title="Chat tabs"
          description="Keep open conversations in a tab strip above the workspace."
          control={
            <Switch
              aria-label="Chat tabs"
              checked={settings.chatTabsEnabled}
              onCheckedChange={(checked) => update({ chatTabsEnabled: checked })}
            />
          }
        />
        <SettingsRow
          title="Wrap long lines"
          description="Wrap long message and code lines to the available width."
          control={
            <Switch
              aria-label="Wrap long lines"
              checked={settings.wordWrap}
              onCheckedChange={(checked) => update({ wordWrap: checked })}
            />
          }
        />
        <SettingsRow
          title="Time format"
          description="Choose how message timestamps are displayed."
          control={
            <select
              aria-label="Time format"
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              value={settings.timestampFormat}
              onChange={(event) =>
                update({ timestampFormat: event.target.value as "locale" | "12-hour" | "24-hour" })
              }
            >
              <option value="locale">System default</option>
              <option value="12-hour">12-hour</option>
              <option value="24-hour">24-hour</option>
            </select>
          }
        />
        <SettingsRow
          title="Thinking sound"
          description="Play a short chime when a session starts thinking."
          control={
            <Switch
              aria-label="Thinking sound"
              checked={settings.thinkingSoundEnabled}
              onCheckedChange={(checked) => update({ thinkingSoundEnabled: checked })}
            />
          }
        />
        <SettingsRow
          title="More preferences"
          description="Project grouping, storage location, updates, and advanced workspace settings."
          control={
            <Button size="xs" variant="outline" onClick={() => show("/settings/advanced")}>
              Open preferences
            </Button>
          }
        />
      </SettingsSection>
      <NotificationSoundSettings />
    </SettingsPageContainer>
  );
}

export function CopilotSessionsSettings() {
  const settings = usePrimarySettings();
  const update = useUpdatePrimarySettings();
  const show = useSettingsDialogStore((state) => state.show);
  return (
    <SettingsPageContainer>
      <SettingsSection title="Sessions">
        <SettingsRow
          title="New sessions"
          description="Choose where coding sessions work by default."
          control={
            <select
              aria-label="Default session environment"
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              value={settings.defaultThreadEnvMode}
              onChange={(e) =>
                update({
                  defaultThreadEnvMode: e.target.value === "worktree" ? "worktree" : "local",
                })
              }
            >
              <option value="local">Local checkout</option>
              <option value="worktree">New worktree</option>
            </select>
          }
        />
        {settings.defaultThreadEnvMode === "worktree" ? (
          <SettingsRow
            title="Start from origin"
            description="Create new worktrees from the latest remote default branch instead of the local checkout."
            control={
              <Switch
                aria-label="Start new worktrees from origin"
                checked={settings.newWorktreesStartFromOrigin}
                onCheckedChange={(checked) => update({ newWorktreesStartFromOrigin: checked })}
              />
            }
          />
        ) : null}
        <SettingsRow
          title="Settle merged sessions"
          description="Automatically settle a session after its pull request merges."
          control={
            <Switch
              aria-label="Settle merged sessions"
              checked={settings.sidebarAutoSettleOnMerge}
              onCheckedChange={(checked) => update({ sidebarAutoSettleOnMerge: checked })}
            />
          }
        />
        <SettingsRow
          title="Settle inactive sessions"
          description="Move inactive sessions out of the sidebar after a chosen number of days."
          control={
            <div className="flex items-center gap-2">
              <Switch
                aria-label="Settle inactive sessions"
                checked={settings.sidebarAutoSettleAfterDays !== null}
                onCheckedChange={(checked) =>
                  update({ sidebarAutoSettleAfterDays: checked ? 30 : null })
                }
              />
              {settings.sidebarAutoSettleAfterDays !== null ? (
                <input
                  aria-label="Days before settling inactive sessions"
                  className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
                  type="number"
                  min={1}
                  max={365}
                  value={settings.sidebarAutoSettleAfterDays}
                  onChange={(event) => {
                    const days = Number(event.target.value);
                    if (Number.isInteger(days) && days >= 1 && days <= 365)
                      update({ sidebarAutoSettleAfterDays: days });
                  }}
                />
              ) : null}
            </div>
          }
        />
        <SettingsRow
          title="Confirm before archiving"
          description="Require confirmation before archiving a session."
          control={
            <Switch
              aria-label="Confirm before archiving"
              checked={settings.confirmThreadArchive}
              onCheckedChange={(checked) => update({ confirmThreadArchive: checked })}
            />
          }
        />
        <SettingsRow
          title="Archived sessions"
          description="Review and restore conversations you have archived."
          control={
            <Button size="xs" variant="outline" onClick={() => show("/settings/archived")}>
              Manage archives
            </Button>
          }
        />
        <SettingsRow
          title="Git & pull requests"
          description="Manage source control integrations and repository settings."
          control={
            <Button size="xs" variant="outline" onClick={() => show("/settings/source-control")}>
              Configure
            </Button>
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function CopilotExperimentalSettings() {
  const settings = usePrimarySettings();
  const update = useUpdatePrimarySettings();
  return (
    <SettingsPageContainer>
      <SettingsSection title="Experimental">
        <SettingsRow
          title="Chat tabs"
          description="Keep open conversations in a tab strip above the workspace."
          control={
            <Switch
              aria-label="Chat tabs"
              checked={settings.chatTabsEnabled}
              onCheckedChange={(checked) => update({ chatTabsEnabled: checked })}
            />
          }
        />
        <SettingsRow
          title="Ambient presence"
          description="Show a movable status bubble for your active sessions."
          control={
            <Switch
              aria-label="Ambient presence"
              checked={settings.ambientPresenceEnabled}
              onCheckedChange={(checked) => update({ ambientPresenceEnabled: checked })}
            />
          }
        />
        <SettingsRow
          title="Automatic browser previews"
          description="Show the floating preview when an agent opens a browser."
          control={
            <Switch
              aria-label="Automatic browser previews"
              checked={settings.browserAutoShowFloatingPreview}
              onCheckedChange={(checked) => update({ browserAutoShowFloatingPreview: checked })}
            />
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function CopilotAccountsSettings() {
  const show = useSettingsDialogStore((state) => state.show);
  return (
    <SettingsPageContainer>
      <SettingsSection title="Accounts">
        <SettingsRow
          title="GitHub"
          description="Your connected GitHub identity. Open the account menu to manage it."
        >
          <div className="mt-3 rounded-lg border border-border p-3">
            <GitHubAccountRow settingsHeader />
          </div>
        </SettingsRow>
        <SettingsRow
          title="Environments & connections"
          description="Manage local, remote, and paired server connections."
          control={
            <Button
              size="xs"
              variant="outline"
              onClick={() => show("/settings/environment-connections")}
            >
              Manage connections
            </Button>
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
