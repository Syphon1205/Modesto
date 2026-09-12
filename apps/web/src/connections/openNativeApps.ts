import {
  detectNativeAppsToOpen,
  parseNativeAppComposerCommand,
  resolveNativeAppSendPrompt,
} from "@modesto/shared/nativeAppIntent";
import type { NativeApp } from "@modesto/shared/nativeApps";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { openFloatingChat } from "~/lib/floatingChatChrome";
import type { ThreadRouteTarget } from "~/threadRoutes";

export function rewriteNativeAppSendPrompt(prompt: string): string {
  const command = parseNativeAppComposerCommand(prompt);
  if (!command) return prompt;
  return resolveNativeAppSendPrompt(command.app, command.task);
}

export async function openNativeApp(app: NativeApp): Promise<boolean> {
  const openApplication = window.desktopBridge?.openApplication;
  if (typeof openApplication !== "function") return false;
  const result = await openApplication(app.id);
  if (!result.installed) {
    toastManager.add(
      stackedThreadToast({
        type: "warning",
        title: `${app.name} isn’t installed`,
        description: `Install ${app.name} on this computer, then try again.`,
      }),
    );
    return false;
  }
  if (!result.opened) {
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: `Couldn’t open ${app.name}`,
        description: "The app was found, but it didn’t come forward.",
      }),
    );
    return false;
  }
  return true;
}

export async function openNativeAppsFromChat(input: {
  readonly prompt: string;
  readonly threadTarget: ThreadRouteTarget | null;
  readonly popOutChat: boolean;
}): Promise<readonly NativeApp[]> {
  const apps = detectNativeAppsToOpen(input.prompt);
  let openedAny = false;
  for (const app of apps) {
    openedAny = (await openNativeApp(app)) || openedAny;
  }
  if (input.popOutChat && input.threadTarget && (openedAny || apps.length > 0)) {
    await openFloatingChat(input.threadTarget);
  }
  return apps;
}
