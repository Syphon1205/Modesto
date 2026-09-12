// FILE: AppUpdateNotification.tsx
// Purpose: Announce a new Modesto build in the bottom-right updates stack, and
//          let the user download or install it from there.
// Layer: Updates UI
//
// Until now an available app update was only a small button in the sidebar -
// discoverable if you happened to look at it. The provider updates already
// announced themselves; the app's own update did not. This puts both in the
// same corner, driven by the same `DesktopUpdateState` the sidebar button
// reads, so the two can never disagree about what is available.

import type { DesktopUpdateState } from "@modesto/contracts";
import { DownloadIcon, RocketIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { useDesktopUpdateState } from "~/state/desktopUpdate";
import {
  getDesktopUpdateDownloadedVersion,
  resolveDesktopUpdateButtonAction,
  type DesktopUpdateButtonAction,
} from "../desktopUpdate.logic";
import { runDesktopUpdateDownload, runDesktopUpdateInstall } from "../desktopUpdateActions";
import { stackedThreadToast, updatesToastManager } from "../ui/toast";

type UpdatesToastId = ReturnType<typeof updatesToastManager.add>;

/**
 * The version an announcement is about. Keying on this - rather than on the
 * status - means the notification is shown once per build, and survives the
 * status moving from `available` to `downloading` to `downloaded` without
 * re-announcing the same version three times.
 */
export function appUpdateAnnouncementKey(state: DesktopUpdateState | null): string | null {
  if (!state || !state.enabled) return null;
  const action = resolveDesktopUpdateButtonAction(state);
  if (action === "none") return null;
  const version =
    action === "install" ? getDesktopUpdateDownloadedVersion(state) : state.availableVersion;
  return version ? `${action}:${version}` : null;
}

function announcementCopy(
  action: DesktopUpdateButtonAction,
  version: string | null,
): { readonly title: string; readonly description: string } | null {
  if (action === "download") {
    return {
      title: version ? `Modesto ${version} is available` : "A Modesto update is available",
      description: "Download it now and install whenever you're ready.",
    };
  }
  if (action === "install") {
    return {
      title: version ? `Modesto ${version} is ready` : "A Modesto update is ready",
      description: "Restart to install it. Anything running will be interrupted.",
    };
  }
  return null;
}

export function AppUpdateNotification() {
  const state = useDesktopUpdateState();
  const activeRef = useRef<{ readonly key: string; readonly toastId: UpdatesToastId } | null>(null);

  useEffect(() => {
    const key = appUpdateAnnouncementKey(state);
    const active = activeRef.current;

    // The build on offer changed (downloaded, superseded, or installed), so the
    // standing announcement is about something that is no longer true.
    if (active && active.key !== key) {
      updatesToastManager.close(active.toastId);
      activeRef.current = null;
    }

    if (!state || key === null || activeRef.current !== null) return;

    const action = resolveDesktopUpdateButtonAction(state);
    const version =
      action === "install" ? getDesktopUpdateDownloadedVersion(state) : state.availableVersion;
    const copy = announcementCopy(action, version);
    if (!copy) return;

    const toastId = updatesToastManager.add(
      stackedThreadToast({
        type: "info",
        title: copy.title,
        description: copy.description,
        timeout: 0,
        actionProps: {
          children: action === "install" ? "Restart" : "Download",
          onClick: () => {
            const bridge = window.desktopBridge;
            if (!bridge) return;
            const current = activeRef.current;
            if (current) {
              updatesToastManager.close(current.toastId);
              activeRef.current = null;
            }
            // Install runs its own confirmation - restarting interrupts work,
            // and a notification is not the place to skip that.
            void (action === "install"
              ? runDesktopUpdateInstall(bridge, state)
              : runDesktopUpdateDownload(bridge));
          },
        },
        actionVariant: "default",
        data: {
          hideCopyButton: true,
          leadingIcon:
            action === "install" ? (
              <RocketIcon aria-hidden="true" className="size-4 text-success" strokeWidth={2.25} />
            ) : (
              <DownloadIcon aria-hidden="true" className="size-4 text-success" strokeWidth={2.25} />
            ),
        },
      }),
    );
    activeRef.current = { key, toastId };
  }, [state]);

  return null;
}
