import { DesktopRendererActivityLiveInputSchema } from "@modesto/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as MainWindowBackgroundThrottling from "../../window/mainWindowBackgroundThrottling.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

export const setRendererActivityLive = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.SET_RENDERER_ACTIVITY_CHANNEL,
  payload: DesktopRendererActivityLiveInputSchema,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.rendererActivity.setLive")(function* ({ live }) {
    MainWindowBackgroundThrottling.setMainWindowAgentLiveHold(live);
  }),
});
