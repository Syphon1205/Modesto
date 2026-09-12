import { useEffect } from "react";
import type { EnvironmentThreadShell } from "@modesto/client-runtime/state/models";

import { spawnedThreadIsLive } from "~/components/agents/spawnedThreads";
import { useThreadShells } from "~/state/entities";

export function isThreadKeepingRendererAlive(
  thread: Pick<
    EnvironmentThreadShell,
    "hasPendingApprovals" | "hasPendingUserInput" | "session" | "backgroundLiveness" | "latestTurn"
  >,
): boolean {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) return true;
  if (thread.session?.status === "running" || thread.session?.status === "starting") return true;
  if (thread.backgroundLiveness === "working" || thread.backgroundLiveness === "monitoring") {
    return true;
  }
  if (spawnedThreadIsLive(thread)) return true;
  return false;
}

/**
 * Pushes renderer liveness to the desktop shell so Chromium does not throttle
 * the main window while agents / threads are still working in the background.
 */
export function DesktopRendererActivityLayer() {
  const threads = useThreadShells();

  useEffect(() => {
    const setLive = window.desktopBridge?.rendererActivity?.setLive;
    if (!setLive) return;

    const live = threads.some((thread) => isThreadKeepingRendererAlive(thread));
    void setLive(live);

    return () => {
      void setLive(false);
    };
  }, [threads]);

  return null;
}
