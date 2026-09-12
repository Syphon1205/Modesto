import {
  DesktopMicrophoneStatusSchema,
  DesktopRequestMicrophoneResultSchema,
} from "@modesto/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  getMicrophoneAccessStatus,
  requestMicrophoneAccess,
} from "../../app/DesktopMediaPermissions.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

export const getMicrophoneStatus = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.MICROPHONE_STATUS_CHANNEL,
  payload: Schema.Void,
  result: DesktopMicrophoneStatusSchema,
  handler: Effect.fn("desktop.ipc.microphone.status")(function* () {
    return { status: getMicrophoneAccessStatus() };
  }),
});

export const requestMicrophone = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.REQUEST_MICROPHONE_CHANNEL,
  payload: Schema.Void,
  result: DesktopRequestMicrophoneResultSchema,
  handler: Effect.fn("desktop.ipc.microphone.request")(function* () {
    return yield* Effect.promise(() => requestMicrophoneAccess());
  }),
});
