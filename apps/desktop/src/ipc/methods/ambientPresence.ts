import { DesktopAmbientPresenceBubblesSchema } from "@modesto/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as AmbientPresenceOverlay from "../../ambient/AmbientPresenceOverlay.ts";
import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopWindow from "../../window/DesktopWindow.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

const NavigatePayload = Schema.Struct({
  routePath: Schema.String,
});

const AMBIENT_NAVIGATE_PREFIX = "ambient-navigate:";

export const openAmbientPresence = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.AMBIENT_PRESENCE_OPEN_CHANNEL,
  payload: Schema.Void,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.ambientPresence.open")(function* () {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    AmbientPresenceOverlay.configureAmbientPresenceOverlay({
      dirname: environment.dirname,
      platform: environment.platform,
    });
    yield* Effect.promise(() => AmbientPresenceOverlay.openAmbientPresenceOverlay());
  }),
});

export const closeAmbientPresence = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.AMBIENT_PRESENCE_CLOSE_CHANNEL,
  payload: Schema.Void,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.ambientPresence.close")(function* () {
    yield* Effect.promise(() => AmbientPresenceOverlay.closeAmbientPresenceOverlay());
  }),
});

export const setAmbientPresenceBubbles = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.AMBIENT_PRESENCE_SET_BUBBLES_CHANNEL,
  payload: DesktopAmbientPresenceBubblesSchema,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.ambientPresence.setBubbles")(function* ({ bubbles }) {
    yield* Effect.promise(() => AmbientPresenceOverlay.setAmbientPresenceBubbles(bubbles));
  }),
});

export const navigateAmbientPresence = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.AMBIENT_PRESENCE_NAVIGATE_CHANNEL,
  payload: NavigatePayload,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.ambientPresence.navigate")(function* ({ routePath }) {
    const desktopWindow = yield* DesktopWindow.DesktopWindow;
    yield* desktopWindow.revealOrCreateMain;
    yield* desktopWindow.dispatchMenuAction(`${AMBIENT_NAVIGATE_PREFIX}${routePath}`);
  }),
});

export { AMBIENT_NAVIGATE_PREFIX };
