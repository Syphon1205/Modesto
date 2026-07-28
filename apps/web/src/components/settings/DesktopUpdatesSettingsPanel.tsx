// FILE: DesktopUpdatesSettingsPanel.tsx
// Purpose: Presents a calm, actionable view of the Electron updater without exposing raw errors.
// Layer: Web settings UI

import { useMemo, useState } from "react";

import { APP_VERSION } from "../../branding";
import { isElectron } from "../../env";
import { useDesktopUpdateState } from "../../hooks/useDesktopUpdateState";
import { CheckCircle2Icon, DownloadIcon, Loader2Icon, RefreshCwIcon } from "../../lib/icons";
import { ensureNativeApi } from "../../nativeApi";
import { formatRelativeTime } from "../../lib/relativeTime";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { SettingsRow, SettingsSection } from "./SettingsPanelPrimitives";

type UpdateAction = "check" | "download" | "install";

export function DesktopUpdatesSettingsPanel() {
  const [updateState, setUpdateState] = useDesktopUpdateState();
  const [busyAction, setBusyAction] = useState<UpdateAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [channelChanging, setChannelChanging] = useState(false);
  const presentation = useMemo(() => updatePresentation(updateState), [updateState]);

  const runAction = async (action: UpdateAction) => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    setBusyAction(action);
    setActionError(null);
    try {
      if (action === "check") {
        const state = await bridge.checkForUpdates();
        setUpdateState(state);
        if (state.status === "error" && state.message) {
          setActionError(readableUpdateMessage(state.message));
        }
        return;
      }

      const result =
        action === "install" ? await bridge.installUpdate() : await bridge.downloadUpdate();
      setUpdateState(result.state);
      if (!result.accepted && result.state.message) {
        setActionError(readableUpdateMessage(result.state.message));
      }
    } catch (error) {
      setActionError(
        readableUpdateMessage(error instanceof Error ? error.message : "The update action failed."),
      );
    } finally {
      setBusyAction(null);
    }
  };

  const action = updateAction(updateState);
  const message = actionError ?? presentation.detail;
  const buildChannel = updateState?.buildChannel ?? "stable";
  const selectedChannel = updateState?.selectedChannel ?? buildChannel;

  const setDevelopmentChannel = async (enabled: boolean) => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    setChannelChanging(true);
    setActionError(null);
    try {
      setUpdateState(await bridge.setUpdateChannel(enabled ? "development" : "stable"));
    } catch (error) {
      setActionError(
        readableUpdateMessage(
          error instanceof Error ? error.message : "Could not change the update channel.",
        ),
      );
    } finally {
      setChannelChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="Update status">
        <div className="relative overflow-hidden px-4 py-4 sm:px-5">
          <div className="pointer-events-none absolute -right-12 -top-16 size-40 rounded-full bg-blue-500/[0.07] blur-3xl" />
          <div className="relative flex min-w-0 items-start gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${presentation.iconClassName}`}
              >
                {presentation.busy ? (
                  <Loader2Icon className="size-[18px] animate-spin" />
                ) : presentation.ready ? (
                  <DownloadIcon className="size-[18px]" />
                ) : (
                  <CheckCircle2Icon className="size-[18px]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{presentation.title}</h3>
                <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                  {message}
                </p>
                {updateState?.checkedAt ? (
                  <p className="mt-2 text-[10px] text-muted-foreground/75">
                    Last checked {formatRelativeTime(updateState.checkedAt)}
                  </p>
                ) : null}
                {isElectron && action ? (
                  <Button
                    size="xs"
                    variant={action === "install" ? "default" : "outline"}
                    className="mt-3"
                    disabled={busyAction !== null || presentation.busy || channelChanging}
                    onClick={() => void runAction(action)}
                  >
                    {busyAction ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : action === "check" ? (
                      <RefreshCwIcon className="size-3.5" />
                    ) : (
                      <DownloadIcon className="size-3.5" />
                    )}
                    {actionLabel(action, busyAction === action)}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {updateState?.status === "downloading" && updateState.downloadPercent !== null ? (
            <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-[width]"
                style={{ width: `${Math.max(0, Math.min(100, updateState.downloadPercent))}%` }}
              />
            </div>
          ) : null}
        </div>
        <SettingsRow
          title="Installed build"
          description={`${buildChannel === "development" ? "Development" : "Release"} build installed on this device.`}
          control={
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-muted/60 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {buildChannel === "development" ? "Dev" : "Release"}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {updateState?.currentVersion ?? APP_VERSION}
              </span>
            </div>
          }
        />
        <SettingsRow
          title="Automatic checks"
          description="Modesto checks the official GitHub release feed after launch and when returning after time away."
          status={
            updateState?.enabled === false
              ? "Automatic updates are disabled in development builds."
              : "Downloads happen in the background; restarting to install stays under your control."
          }
        />
      </SettingsSection>

      <SettingsSection title="Update channel">
        <SettingsRow
          title="Development builds"
          description={
            selectedChannel === "development"
              ? "Receive preview builds with the newest changes. These may be less stable."
              : "Stay on tested release builds. Development previews are ignored."
          }
          status={
            buildChannel === selectedChannel
              ? `This is a ${buildChannel === "development" ? "development" : "release"} build`
              : `This ${buildChannel === "development" ? "development" : "release"} build now follows the ${selectedChannel} channel`
          }
          control={
            <div className="flex items-center gap-3">
              {channelChanging ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              <Switch
                checked={selectedChannel === "development"}
                disabled={!isElectron || channelChanging || presentation.busy}
                onCheckedChange={(checked) => void setDevelopmentChannel(Boolean(checked))}
                aria-label="Receive development builds"
              />
            </div>
          }
        />
        <SettingsRow
          title="Release archive"
          description="Browse release notes and download installers manually."
          control={
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                void ensureNativeApi().shell.openExternal(
                  updateState?.releaseUrl ?? "https://github.com/Syphon1205/Modesto/releases",
                )
              }
            >
              View on GitHub
            </Button>
          }
        />
      </SettingsSection>
    </div>
  );
}

function updateAction(state: ReturnType<typeof useDesktopUpdateState>[0]): UpdateAction | null {
  if (!state?.enabled) return null;
  if (state.status === "downloaded") return "install";
  if (state.status === "available") return "download";
  if (state.status === "error" && state.errorContext === "download") return "download";
  if (state.status === "error" && state.errorContext === "install" && state.downloadedVersion) {
    return "install";
  }
  if (state.status === "idle" || state.status === "up-to-date" || state.status === "error") {
    return "check";
  }
  return null;
}

function actionLabel(action: UpdateAction, busy: boolean): string {
  if (busy) {
    return action === "check" ? "Checking…" : action === "download" ? "Preparing…" : "Updating…";
  }
  return action === "check"
    ? "Check now"
    : action === "download"
      ? "Download update"
      : "Restart to update";
}

function updatePresentation(state: ReturnType<typeof useDesktopUpdateState>[0]) {
  if (!isElectron || !state || !state.enabled || state.status === "disabled") {
    const isDevelopmentBuild = state?.buildChannel === "development";
    return {
      title: isDevelopmentBuild ? "Development build" : "Updates unavailable",
      detail:
        state?.message ??
        (isDevelopmentBuild
          ? "Automatic updates are available in signed release builds."
          : "This release cannot check for updates automatically."),
      busy: false,
      ready: false,
      iconClassName: "border-border/60 bg-muted/55 text-muted-foreground",
    };
  }
  if (state.status === "checking") {
    return {
      title: "Checking for updates",
      detail: "Looking for the latest stable Modesto release on GitHub.",
      busy: true,
      ready: false,
      iconClassName: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    };
  }
  if (state.status === "available" || state.status === "downloading") {
    return {
      title: state.availableVersion
        ? `Modesto ${state.availableVersion} is available`
        : "Update available",
      detail:
        state.status === "downloading"
          ? `Preparing the update${state.downloadPercent !== null ? ` · ${Math.floor(state.downloadPercent)}%` : ""}.`
          : "A new stable release is ready to download.",
      busy: state.status === "downloading",
      ready: true,
      iconClassName: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    };
  }
  if (state.status === "downloaded") {
    return {
      title: "Ready to install",
      detail: `Modesto ${state.downloadedVersion ?? state.availableVersion ?? "update"} will install when you restart.`,
      busy: false,
      ready: true,
      iconClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    };
  }
  if (state.status === "error") {
    return {
      title: "Update needs attention",
      detail: readableUpdateMessage(
        state.message ?? "Modesto could not complete the update check.",
      ),
      busy: false,
      ready: false,
      iconClassName: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    };
  }
  return {
    title: state.status === "up-to-date" ? "You’re up to date" : "Updates are ready",
    detail: `Modesto ${state.currentVersion} is the latest installed version.`,
    busy: false,
    ready: false,
    iconClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  };
}

function readableUpdateMessage(message: string): string {
  if (message.includes("modesto-mac.yml") || message.includes("latest-mac.yml")) {
    return "The latest GitHub release does not include update metadata yet. You can still download it manually from Releases.";
  }
  const firstLine = message.split(/\r?\n/, 1)[0]?.trim();
  return firstLine && firstLine.length <= 180
    ? firstLine
    : "Modesto could not complete the update. Try again or download the latest release manually.";
}
