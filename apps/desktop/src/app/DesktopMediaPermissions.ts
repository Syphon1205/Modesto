// FILE: DesktopMediaPermissions.ts
// Purpose: Lets the renderer capture the microphone, so composer dictation
//          works in the packaged desktop app — and exposes grant status for
//          the Integrations → Voice settings row.
// Layer: Desktop startup (Electron session configuration)
//
// Electron denies every permission request unless the app installs a handler.
// Without this, `getUserMedia` fails in the desktop build even though the
// browser build records fine and the mac entitlement is already declared
// (NSMicrophoneUsageDescription, see scripts/lib/desktop-platform-build-config).
//
// Only "media" is ever granted here; every other permission stays denied.

import type { DesktopMicrophoneAccessStatus } from "@modesto/contracts";
import * as Electron from "electron";
import * as Effect from "effect/Effect";

/**
 * Decides whether a media permission request is one we should allow.
 *
 * Electron marks `mediaTypes` as optional and audio-only requests may omit it
 * entirely, so a missing value is treated as "potentially audio". Denying it
 * would suppress the macOS system prompt outright, and the user would never
 * get the chance to grant access - the failure mode this guard exists to
 * avoid. A request that explicitly asks only for video is denied.
 */
export function shouldAllowMediaPermissionRequest(details: unknown): boolean {
  const mediaTypes =
    typeof details === "object" &&
    details !== null &&
    "mediaTypes" in details &&
    Array.isArray((details as { mediaTypes: unknown }).mediaTypes)
      ? ((details as { mediaTypes: ReadonlyArray<unknown> }).mediaTypes as ReadonlyArray<unknown>)
      : null;
  if (!mediaTypes || mediaTypes.length === 0) {
    return true;
  }
  return mediaTypes.includes("audio");
}

const KNOWN_MICROPHONE_STATUSES = new Set<DesktopMicrophoneAccessStatus>([
  "not-determined",
  "granted",
  "denied",
  "restricted",
  "unknown",
]);

/**
 * Reads the OS microphone grant. Electron exposes this on macOS and Windows;
 * other hosts fall back to `"unknown"` rather than inventing a grant.
 */
export function getMicrophoneAccessStatus(): DesktopMicrophoneAccessStatus {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return "unknown";
  }
  const status = Electron.systemPreferences.getMediaAccessStatus("microphone");
  return KNOWN_MICROPHONE_STATUSES.has(status as DesktopMicrophoneAccessStatus)
    ? (status as DesktopMicrophoneAccessStatus)
    : "unknown";
}

/**
 * Raises the OS microphone prompt when access is still undetermined (macOS).
 * On hosts without `askForMediaAccess`, reports whether media is already
 * treated as granted by the session handlers below.
 */
export async function requestMicrophoneAccess(): Promise<{
  granted: boolean;
  status: DesktopMicrophoneAccessStatus;
}> {
  if (process.platform === "darwin") {
    const current = getMicrophoneAccessStatus();
    if (current === "granted") {
      return { granted: true, status: current };
    }
    const granted = await Electron.systemPreferences.askForMediaAccess("microphone");
    return { granted, status: getMicrophoneAccessStatus() };
  }
  // Non-macOS: the session permission handler below grants media directly, so
  // a settings "request" cannot raise a separate OS prompt. Report current
  // readable status (Windows) or treat the session policy as granted.
  const status = getMicrophoneAccessStatus();
  if (status === "unknown") {
    return { granted: true, status: "granted" };
  }
  return { granted: status === "granted", status };
}

/**
 * Installs the session permission handlers. Runs once, after `whenReady`.
 *
 * On macOS the request is forwarded to `askForMediaAccess`, which is what
 * raises the system prompt the first time; on other platforms Electron's own
 * prompt is sufficient and the request is granted directly.
 */
export const configureMediaPermissions = Effect.sync(() => {
  const defaultSession = Electron.session.defaultSession;

  defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission !== "media") {
      return false;
    }
    return process.platform === "darwin"
      ? Electron.systemPreferences.getMediaAccessStatus("microphone") === "granted"
      : true;
  });

  defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission !== "media" || !shouldAllowMediaPermissionRequest(details)) {
      callback(false);
      return;
    }
    if (process.platform !== "darwin") {
      callback(true);
      return;
    }
    if (Electron.systemPreferences.getMediaAccessStatus("microphone") === "granted") {
      callback(true);
      return;
    }
    // Raises the macOS prompt; a rejection here means the user said no.
    void Electron.systemPreferences
      .askForMediaAccess("microphone")
      .then(callback, () => callback(false));
  });
});
