import {
  DesktopAppshotPayloadSchema,
  DesktopAppshotPermissionStatusSchema,
} from "@modesto/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as AppshotsManager from "../../appshots/AppshotsManager.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

export const captureAppshotNow = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.APPSHOT_CAPTURE_NOW_CHANNEL,
  payload: Schema.Void,
  result: Schema.NullOr(DesktopAppshotPayloadSchema),
  handler: Effect.fn("desktop.ipc.appshots.captureNow")(function* () {
    const manager = yield* AppshotsManager.AppshotsManager;
    return yield* manager.captureNow;
  }),
});

export const getAppshotPermissionStatus = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.APPSHOT_PERMISSION_STATUS_CHANNEL,
  payload: Schema.Void,
  result: DesktopAppshotPermissionStatusSchema,
  handler: Effect.fn("desktop.ipc.appshots.permissionStatus")(function* () {
    const manager = yield* AppshotsManager.AppshotsManager;
    return yield* manager.getPermissionStatus;
  }),
});

export const openAppshotPrivacySettings = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.APPSHOT_OPEN_PRIVACY_SETTINGS_CHANNEL,
  payload: Schema.Void,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.appshots.openPrivacySettings")(function* () {
    const manager = yield* AppshotsManager.AppshotsManager;
    yield* manager.openPrivacySettings;
  }),
});
