// FILE: desktopUpdateActions.ts
// Purpose: Run a desktop update action - download, or confirm-and-install -
//          with the error reporting that goes with it.
// Layer: Web UI (desktop update)
//
// The sidebar pill, the settings panel, and the bottom-right update
// notification all offer the same two buttons. Before this module each of them
// carried its own copy of the bridge call, the confirmation dialog, and four
// error toasts, and they had already drifted: only the sidebar surfaced the
// "downloaded" confirmation, and only the sidebar checked
// `shouldToastDesktopUpdateActionResult` before reporting a failure. One
// implementation means a fix to any of that lands everywhere.
//
// Failures are reported through the main toast stack, not the updates stack:
// they are the direct consequence of a button the user just pressed, which is
// what that stack is for.

import type { DesktopBridge, DesktopUpdateState } from "@modesto/contracts";

import { ensureLocalApi } from "~/localApi";
import {
  getDesktopUpdateActionError,
  getDesktopUpdateInstallConfirmationMessage,
  shouldToastDesktopUpdateActionResult,
} from "./desktopUpdate.logic";
import { showDesktopUpdateDownloadedToast } from "./desktopUpdate.toast";
import { stackedThreadToast, toastManager } from "./ui/toast";

function reportUpdateError(title: string, error: unknown, fallback: string): void {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : fallback,
    }),
  );
}

function reportUpdateResultError(title: string, message: string): void {
  toastManager.add(stackedThreadToast({ type: "error", title, description: message }));
}

/** Download the available build. Resolves once the attempt has settled. */
export async function runDesktopUpdateDownload(bridge: DesktopBridge): Promise<void> {
  try {
    const result = await bridge.downloadUpdate();
    if (result.completed) {
      showDesktopUpdateDownloadedToast(bridge, result.state);
    }
    if (!shouldToastDesktopUpdateActionResult(result)) return;
    const actionError = getDesktopUpdateActionError(result);
    if (actionError) {
      reportUpdateResultError("Could not download update", actionError);
    }
  } catch (error) {
    reportUpdateError("Could not start update download", error, "An unexpected error occurred.");
  }
}

/**
 * Confirm with the user, then restart into the downloaded build.
 *
 * Returns `false` when the user declined, so a caller holding a pending flag
 * can clear it. Installing restarts the app and interrupts running work, which
 * is why the confirmation is inside this function rather than optional at each
 * call site.
 */
export async function runDesktopUpdateInstall(
  bridge: DesktopBridge,
  state: Pick<DesktopUpdateState, "availableVersion" | "downloadedVersion">,
): Promise<boolean> {
  let confirmed = false;
  try {
    confirmed = await ensureLocalApi().dialogs.confirm(
      getDesktopUpdateInstallConfirmationMessage(state),
    );
  } catch (error) {
    reportUpdateError("Could not confirm update", error, "Update confirmation failed.");
    return false;
  }
  if (!confirmed) return false;

  try {
    const result = await bridge.installUpdate();
    if (!shouldToastDesktopUpdateActionResult(result)) return true;
    const actionError = getDesktopUpdateActionError(result);
    if (actionError) {
      reportUpdateResultError("Could not install update", actionError);
    }
  } catch (error) {
    reportUpdateError("Could not install update", error, "An unexpected error occurred.");
  }
  return true;
}
