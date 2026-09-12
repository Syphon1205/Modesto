import {
  DesktopOpenApplicationInputSchema,
  DesktopOpenApplicationResultSchema,
} from "@modesto/contracts";
import { candidateNativeAppPaths, nativeAppById, type NativeApp } from "@modesto/shared/nativeApps";
import { execFile } from "node:child_process";
import * as NodeFs from "node:fs";
import * as NodeOs from "node:os";
import { promisify } from "node:util";
import * as Effect from "effect/Effect";
import * as Electron from "electron";

import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

const execFileAsync = promisify(execFile);

function detectInstalledApp(app: NativeApp): string | null {
  return (
    candidateNativeAppPaths(
      {
        platform: process.platform,
        homeDir: NodeOs.homedir(),
        env: process.env,
        pathExists: (path) => NodeFs.existsSync(path),
      },
      app,
    ).find((path) => NodeFs.existsSync(path)) ?? null
  );
}

async function launchApp(app: NativeApp, appPath: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("/usr/bin/open", ["-a", appPath], { timeout: 15_000 });
    return;
  }
  const error = await Electron.shell.openPath(appPath);
  if (error.length > 0) {
    throw new Error(error);
  }
}

export const openApplication = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.OPEN_APPLICATION_CHANNEL,
  payload: DesktopOpenApplicationInputSchema,
  result: DesktopOpenApplicationResultSchema,
  handler: Effect.fn("desktop.ipc.openApplication")(function* (input) {
    const app = nativeAppById(input.id);
    if (!app) {
      return {
        id: input.id,
        name: input.id,
        opened: false,
        installed: false,
        appPath: null,
      };
    }
    const appPath = detectInstalledApp(app);
    if (!appPath) {
      return {
        id: app.id,
        name: app.name,
        opened: false,
        installed: false,
        appPath: null,
      };
    }
    const launched = yield* Effect.promise(() =>
      launchApp(app, appPath)
        .then(() => true)
        .catch(() => false),
    );
    return {
      id: app.id,
      name: app.name,
      opened: launched,
      installed: true,
      appPath,
    };
  }),
});
