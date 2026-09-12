// FILE: webAppConnections.ts
// Purpose: Pure model for "is this app connected?" - the states, and how a
//          probe result becomes one.
// Layer: Connections model (no React, no bridge)
//
// Split from the hook so the interesting part - what each state means and when
// it is honest to claim one - is testable without an Electron bridge.

import type { DesktopPreviewSignInProbeResult } from "@modesto/contracts";

export type WebAppConnectionStatus =
  /** Probing has not answered yet. */
  | { readonly kind: "checking" }
  /** The preview browser carries this site's session cookies. */
  | { readonly kind: "connected"; readonly expiresAt: number | null }
  /** The browser is reachable and carries no session for this site. */
  | { readonly kind: "signed-out" }
  /**
   * There is no preview browser to ask - the web build has no Electron host,
   * so no session exists to be signed in to. Deliberately distinct from
   * `signed-out`: one is "you are not signed in", the other is "this build
   * cannot tell you", and showing the first for the second would be a lie.
   */
  | { readonly kind: "unavailable" };

export function statusFromProbe(result: DesktopPreviewSignInProbeResult): WebAppConnectionStatus {
  return result.signedIn
    ? { kind: "connected", expiresAt: result.expiresAt }
    : { kind: "signed-out" };
}

export function describeConnectionStatus(status: WebAppConnectionStatus): string {
  switch (status.kind) {
    case "checking":
      return "Checking…";
    case "connected":
      return "Connected";
    case "signed-out":
      return "Not signed in";
    case "unavailable":
      return "Desktop app only";
  }
}

/**
 * Whether a connected session is close enough to expiry to be worth warning
 * about. Under a day is the threshold: long enough that a normal week of use
 * never trips it, short enough that a user who sees it still has time to act.
 */
const EXPIRY_WARNING_WINDOW_SECONDS = 24 * 60 * 60;

export function isExpiringSoon(status: WebAppConnectionStatus, nowSeconds: number): boolean {
  return (
    status.kind === "connected" &&
    status.expiresAt !== null &&
    status.expiresAt - nowSeconds < EXPIRY_WARNING_WINDOW_SECONDS
  );
}
