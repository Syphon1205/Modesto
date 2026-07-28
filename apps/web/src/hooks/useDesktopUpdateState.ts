// FILE: useDesktopUpdateState.ts
// Purpose: Shares the Electron updater subscription between sidebar and settings surfaces.
// Layer: Web UI hook

import type { DesktopUpdateState } from "@modesto/contracts";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { isElectron } from "../env";

export function useDesktopUpdateState(): readonly [
  DesktopUpdateState | null,
  Dispatch<SetStateAction<DesktopUpdateState | null>>,
] {
  const [state, setState] = useState<DesktopUpdateState | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    const bridge = window.desktopBridge;
    if (
      !bridge ||
      typeof bridge.getUpdateState !== "function" ||
      typeof bridge.onUpdateState !== "function"
    ) {
      return;
    }

    let disposed = false;
    let receivedSubscriptionUpdate = false;
    const unsubscribe = bridge.onUpdateState((nextState) => {
      if (disposed) return;
      receivedSubscriptionUpdate = true;
      setState(nextState);
    });

    void bridge
      .getUpdateState()
      .then((nextState) => {
        if (disposed || receivedSubscriptionUpdate) return;
        setState(nextState);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return [state, setState] as const;
}
