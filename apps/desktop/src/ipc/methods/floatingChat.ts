import { DesktopFloatingChatOpenInputSchema } from "@modesto/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as FloatingChatWindow from "../../window/FloatingChatWindow.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

export const openFloatingChat = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.FLOATING_CHAT_OPEN_CHANNEL,
  payload: DesktopFloatingChatOpenInputSchema,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.floatingChat.open")(function* ({ routePath }) {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    FloatingChatWindow.configureFloatingChatWindow({
      preloadPath: environment.preloadPath,
      platform: environment.platform,
      isDevelopment: environment.isDevelopment,
    });
    yield* Effect.promise(() => FloatingChatWindow.openFloatingChatWindow(routePath));
  }),
});

export const closeFloatingChat = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.FLOATING_CHAT_CLOSE_CHANNEL,
  payload: Schema.Void,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.floatingChat.close")(function* () {
    FloatingChatWindow.closeFloatingChatWindow();
  }),
});
