// FILE: AppshotsManager.ts
// Purpose: Supervise the macOS appshot helper, play shutter sound, push captures.
// Layer: Desktop appshots
//
// macOS-only. Starts `modesto-appshot-helper`, connects to its Unix socket, and
// forwards successful captures to every renderer via `desktop:appshot-received`.

import { spawn, type ChildProcess, execFile } from "node:child_process";
import { createConnection, type Socket } from "node:net";
import { access, constants as fsConstants, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

import type { DesktopAppshotPayload, DesktopAppshotPermissionStatus } from "@modesto/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Electron from "electron";

import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as ElectronWindow from "../electron/ElectronWindow.ts";
import * as DesktopClientSettings from "../settings/DesktopClientSettings.ts";
import * as IpcChannels from "../ipc/channels.ts";
import { parseAppshotHelperLine } from "./appshotProtocol.ts";

const execFileAsync = promisify(execFile);

const HELPER_BINARY_NAME = "modesto-appshot-helper";
const SHUTTER_SOUND_PATH = "/System/Library/Sounds/Tink.aiff";
const CONNECT_RETRY_MS = 80;
const CONNECT_RETRY_ATTEMPTS = 40;

export class AppshotsManager extends Context.Service<
  AppshotsManager,
  {
    readonly start: Effect.Effect<void>;
    readonly stop: Effect.Effect<void>;
    readonly captureNow: Effect.Effect<DesktopAppshotPayload | null>;
    readonly getPermissionStatus: Effect.Effect<DesktopAppshotPermissionStatus>;
    readonly openPrivacySettings: Effect.Effect<void>;
  }
>()("@modesto/desktop/appshots/AppshotsManager") {}

function resolveHelperCandidates(input: {
  readonly isPackaged: boolean;
  readonly isDevelopment: boolean;
  readonly resourcesPath: string;
  readonly rootDir: string;
}): readonly string[] {
  const packaged = path.join(input.resourcesPath, "appshot-helper", HELPER_BINARY_NAME);
  const sourceBuild = path.join(
    input.rootDir,
    "apps/desktop/native/appshot-helper/build",
    HELPER_BINARY_NAME,
  );
  if (input.isPackaged) {
    return [packaged, sourceBuild];
  }
  return [sourceBuild, packaged];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureHelperBuilt(rootDir: string): Promise<string | null> {
  const buildScript = path.join(rootDir, "apps/desktop/native/appshot-helper/build.sh");
  const outDir = path.join(rootDir, "apps/desktop/native/appshot-helper/build");
  const binary = path.join(outDir, HELPER_BINARY_NAME);
  if (await pathExists(binary)) {
    return binary;
  }
  if (!(await pathExists(buildScript))) {
    return null;
  }
  try {
    await execFileAsync("/bin/bash", [buildScript, outDir], {
      timeout: 120_000,
      env: process.env,
    });
  } catch {
    return null;
  }
  return (await pathExists(binary)) ? binary : null;
}

function playShutterSound(): void {
  void execFileAsync("/usr/bin/afplay", [SHUTTER_SOUND_PATH], { timeout: 5_000 }).catch(() => {
    // Shutter feedback is best-effort; never fail a capture on audio.
  });
}

function getScreenCaptureStatus(): DesktopAppshotPermissionStatus["screenRecording"] {
  if (process.platform !== "darwin") return "unknown";
  try {
    const status = Electron.systemPreferences.getMediaAccessStatus("screen");
    if (
      status === "granted" ||
      status === "denied" ||
      status === "restricted" ||
      status === "not-determined"
    ) {
      return status;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function getAccessibilityStatus(): DesktopAppshotPermissionStatus["accessibility"] {
  if (process.platform !== "darwin") return "unknown";
  try {
    const trusted = Electron.systemPreferences.isTrustedAccessibilityClient(false);
    return trusted ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

const make = Effect.fn("desktop.appshots.make")(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const electronWindow = yield* ElectronWindow.ElectronWindow;
  const clientSettings = yield* DesktopClientSettings.DesktopClientSettings;

  let child: ChildProcess | null = null;
  let socket: Socket | null = null;
  let lineBuffer = "";
  let stopped = false;
  let pendingCapture: {
    readonly resolve: (payload: DesktopAppshotPayload | null) => void;
    readonly timer: NodeJS.Timeout;
  } | null = null;

  const isEnabled = Effect.gen(function* () {
    const settings = yield* clientSettings.get;
    if (Option.isNone(settings)) {
      return true;
    }
    return settings.value.appshotsEnabled !== false;
  });

  const publishPayload = (payload: DesktopAppshotPayload) =>
    Effect.gen(function* () {
      playShutterSound();
      yield* electronWindow.sendAll(IpcChannels.APPSHOT_RECEIVED_CHANNEL, payload);
      const main = yield* electronWindow.currentMainOrFirst;
      if (Option.isSome(main)) {
        yield* electronWindow.reveal(main.value);
      }
    });

  const handleHelperLine = (line: string) => {
    const event = parseAppshotHelperLine(line);
    if (!event) return;

    if (event.type === "error") {
      if (pendingCapture) {
        clearTimeout(pendingCapture.timer);
        pendingCapture.resolve(null);
        pendingCapture = null;
      }
      return;
    }

    const payload: DesktopAppshotPayload = {
      appName: event.appName,
      windowTitle: event.windowTitle,
      accessibilityText: event.accessibilityText,
      pngBase64: event.pngBase64,
      mimeType: "image/png",
      capturedAt: event.capturedAt,
    };

    if (pendingCapture) {
      clearTimeout(pendingCapture.timer);
      pendingCapture.resolve(payload);
      pendingCapture = null;
    }

    void Effect.runPromise(
      Effect.gen(function* () {
        if (!(yield* isEnabled)) return;
        yield* publishPayload(payload);
      }),
    );
  };

  const attachSocket = (next: Socket) => {
    socket = next;
    lineBuffer = "";
    next.setEncoding("utf8");
    next.on("data", (chunk: string) => {
      lineBuffer += chunk;
      let newline = lineBuffer.indexOf("\n");
      while (newline !== -1) {
        const line = lineBuffer.slice(0, newline);
        lineBuffer = lineBuffer.slice(newline + 1);
        handleHelperLine(line);
        newline = lineBuffer.indexOf("\n");
      }
    });
    next.on("close", () => {
      if (socket === next) {
        socket = null;
      }
    });
    next.on("error", () => {
      if (socket === next) {
        socket = null;
      }
    });
  };

  const connectSocket = (targetPath: string): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const attempt = (remaining: number) => {
        const candidate = createConnection(targetPath);
        candidate.once("connect", () => resolve(candidate));
        candidate.once("error", (error) => {
          candidate.destroy();
          if (remaining <= 0) {
            reject(error);
            return;
          }
          setTimeout(() => attempt(remaining - 1), CONNECT_RETRY_MS);
        });
      };
      attempt(CONNECT_RETRY_ATTEMPTS);
    });

  const stopChild = () => {
    if (socket) {
      socket.destroy();
      socket = null;
    }
    if (child) {
      try {
        child.stdin?.write("quit\n");
      } catch {
        // ignore
      }
      child.kill("SIGTERM");
      child = null;
    }
  };

  const start = Effect.gen(function* () {
    if (environment.platform !== "darwin" || stopped) {
      return;
    }

    const candidates = resolveHelperCandidates({
      isPackaged: environment.isPackaged,
      isDevelopment: environment.isDevelopment,
      resourcesPath: environment.resourcesPath,
      rootDir: environment.rootDir,
    });

    let helperPath: string | null = null;
    for (const candidate of candidates) {
      if (yield* Effect.promise(() => pathExists(candidate))) {
        helperPath = candidate;
        break;
      }
    }
    if (!helperPath && environment.isDevelopment) {
      helperPath = yield* Effect.promise(() => ensureHelperBuilt(environment.rootDir));
    }
    if (!helperPath) {
      return;
    }

    const runtimeDir = path.join(environment.stateDir, "appshots");
    yield* Effect.promise(() => mkdir(runtimeDir, { recursive: true }));
    const socketPath = path.join(runtimeDir, `helper-${process.pid}.sock`);

    stopChild();

    const spawned = spawn(helperPath, [], {
      env: {
        ...process.env,
        MODESTO_APPSHOT_SOCKET: socketPath,
      },
      stdio: ["pipe", "ignore", "pipe"],
    });
    child = spawned;
    spawned.stderr?.on("data", () => {
      // Helper diagnostics stay on stderr for local debugging; avoid log spam.
    });
    spawned.on("exit", () => {
      if (child === spawned) {
        child = null;
      }
    });

    try {
      const connected = yield* Effect.promise(() => connectSocket(socketPath));
      attachSocket(connected);
    } catch {
      stopChild();
    }
  });

  const stop = Effect.sync(() => {
    stopped = true;
    if (pendingCapture) {
      clearTimeout(pendingCapture.timer);
      pendingCapture.resolve(null);
      pendingCapture = null;
    }
    stopChild();
  });

  const captureNow = Effect.gen(function* () {
    if (environment.platform !== "darwin") {
      return null;
    }
    if (!(yield* isEnabled)) {
      return null;
    }
    if (!child || !socket) {
      yield* start;
    }
    const activeChild = child;
    if (!activeChild || !socket) {
      return null;
    }

    return yield* Effect.promise(
      () =>
        new Promise<DesktopAppshotPayload | null>((resolve) => {
          if (pendingCapture) {
            clearTimeout(pendingCapture.timer);
            pendingCapture.resolve(null);
          }
          const timer = setTimeout(() => {
            if (pendingCapture?.resolve === resolve) {
              pendingCapture = null;
              resolve(null);
            }
          }, 8_000);
          pendingCapture = { resolve, timer };
          try {
            activeChild.stdin?.write("capture\n");
          } catch {
            clearTimeout(timer);
            pendingCapture = null;
            resolve(null);
          }
        }),
    );
  });

  const getPermissionStatus = Effect.sync(
    (): DesktopAppshotPermissionStatus => ({
      available: environment.platform === "darwin",
      helperRunning: child !== null && socket !== null,
      screenRecording: getScreenCaptureStatus(),
      accessibility: getAccessibilityStatus(),
    }),
  );

  const openPrivacySettings = Effect.promise(async () => {
    if (process.platform !== "darwin") return;
    await Electron.shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    );
  });

  yield* Effect.addFinalizer(() => stop);

  return AppshotsManager.of({
    start,
    stop,
    captureNow,
    getPermissionStatus,
    openPrivacySettings,
  });
});

export const layer = Layer.effect(AppshotsManager, make());
