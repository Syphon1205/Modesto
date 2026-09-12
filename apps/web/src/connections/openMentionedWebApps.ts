// FILE: openMentionedWebApps.ts
// Purpose: Open each @mentioned web app in the thread's preview browser.
// Layer: Connections + preview glue
//
// Connections exist so the agent can work inside an app the user is signed
// into. Naming one in the composer is the signal: open that app beside the
// thread, using the same preview session the `preview_*` tools already drive.

import type { PreviewSessionSnapshot, ScopedThreadRef } from "@modesto/contracts";

import type { OpenPreviewMutation } from "~/browser/openFileInPreview";
import { openPreviewSession } from "~/components/preview/openPreviewSession";
import { useRightPanelStore } from "~/rightPanelStore";

import { collectWebAppsFromPrompt } from "./webApps";

export async function openMentionedWebApps<E>(input: {
  readonly prompt: string;
  readonly threadRef: ScopedThreadRef;
  readonly openPreview: OpenPreviewMutation<E>;
}): Promise<void> {
  const apps = collectWebAppsFromPrompt(input.prompt);
  for (const app of apps) {
    const result = await openPreviewSession({
      openPreview: input.openPreview,
      threadRef: input.threadRef,
      url: app.homeUrl,
    });
    if (result._tag === "Failure") {
      continue;
    }
    const snapshot: PreviewSessionSnapshot = result.value;
    useRightPanelStore.getState().openBrowser(input.threadRef, snapshot.tabId);
  }
}
