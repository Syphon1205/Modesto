// FILE: useWebAppConnections.ts
// Purpose: Probe the preview browser for each catalog app's signed-in state.
// Layer: Connections UI hook
//
// One probe per app, run together, refreshed when the window regains focus -
// signing in happens in a browser tab, so coming back to this surface is
// exactly the moment the answer is likely to have changed.
//
// The probe crosses the desktop bridge and returns cookie names only, never
// values (see `DesktopPreviewSignInProbeResultSchema`). On the web build the
// bridge is absent and every app reports `unavailable` rather than pretending
// to know.

import type { EnvironmentId } from "@modesto/contracts";
import { useCallback, useEffect, useState } from "react";

import { previewBridge } from "~/components/preview/previewBridge";
import { statusFromProbe, type WebAppConnectionStatus } from "./webAppConnections";
import { WEB_APPS } from "./webApps";

export type WebAppConnectionStatuses = Readonly<Record<string, WebAppConnectionStatus>>;

const UNAVAILABLE: WebAppConnectionStatuses = Object.fromEntries(
  WEB_APPS.map((app) => [app.id, { kind: "unavailable" } as const]),
);

const CHECKING: WebAppConnectionStatuses = Object.fromEntries(
  WEB_APPS.map((app) => [app.id, { kind: "checking" } as const]),
);

export function useWebAppConnections(environmentId: EnvironmentId | null): {
  readonly statuses: WebAppConnectionStatuses;
  readonly refresh: () => void;
  /**
   * A probe round is in flight. Reported separately from the statuses because
   * a re-probe deliberately keeps the last answers on screen - blanking every
   * row back to "Checking…" on each window focus would make the surface
   * flicker for a result that is usually unchanged.
   */
  readonly probing: boolean;
} {
  const bridge = previewBridge;
  const [statuses, setStatuses] = useState<WebAppConnectionStatuses>(
    bridge && environmentId ? CHECKING : UNAVAILABLE,
  );
  const [probing, setProbing] = useState(false);

  const refresh = useCallback(() => {
    if (!bridge || !environmentId) {
      setStatuses(UNAVAILABLE);
      setProbing(false);
      return;
    }
    let cancelled = false;
    setProbing(true);
    void Promise.all(
      WEB_APPS.map(async (app) => {
        try {
          const result = await bridge.probeSignIn({
            environmentId,
            domain: app.cookieDomain,
            cookieNames: app.sessionCookieNames,
          });
          return [app.id, statusFromProbe(result)] as const;
        } catch {
          // A failed probe is not evidence of being signed out; report the
          // honest "cannot tell" rather than flipping a connected row to
          // disconnected on one bad call.
          return [app.id, { kind: "unavailable" } as const] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setStatuses(Object.fromEntries(entries));
      setProbing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bridge, environmentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!bridge || !environmentId) return;
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [bridge, environmentId, refresh]);

  return { statuses, refresh, probing };
}
