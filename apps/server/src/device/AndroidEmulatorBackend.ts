/**
 * AndroidEmulatorBackend - official AOSP emulator + adb, same shape as iOS.
 *
 * There is no third-party Android "simulator" to vendor. Google's emulator
 * (Apache 2.0) and platform-tools are the current runtimes; they pull the
 * latest system images (Android 17 as of 2026) through `sdkmanager`. This
 * backend wraps those binaries the way IosSimulatorBackend wraps `simctl`.
 *
 * @module device/AndroidEmulatorBackend
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";

import type {
  DeviceAvailability,
  DeviceDescribeUiResult,
  DeviceDescriptor,
  DeviceGeometry,
  DeviceHardwareButton,
  DeviceInstallAppResult,
  DeviceLaunchAppResult,
  DeviceScreenshotResult,
  DeviceSetupStep,
  DeviceStartRecordingResult,
  DeviceStopRecordingResult,
  DeviceUiNode,
} from "@modesto/contracts";

import {
  DeviceBackendError,
  type DeviceBackend,
  type DeviceFrameListener,
  type DeviceGravity,
  type DeviceKeyEvent,
  type DeviceListOptions,
  type DeviceSwipeGesture,
} from "./DeviceBackend.ts";
import { AndroidH264Assembler } from "./androidH264.ts";
import { readPngDimensions } from "./IosSimulatorBackend.ts";
import { createCoalescedWriter } from "./coalescedWriter.ts";
import { runProcess, type ProcessRunResult } from "./runProcess.ts";

const ADB_TIMEOUT_MS = 20_000;
const BOOT_TIMEOUT_MS = 180_000;
const AVAILABILITY_TTL_MS = 15_000;
const LIST_TTL_MS = 10_000;
const DEVICE_UDID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const ANDROID_API_NAMES: Record<number, string> = {
  34: "Android 14",
  35: "Android 15",
  36: "Android 16",
  37: "Android 17",
};

const HARDWARE_KEYCODES: Record<Exclude<DeviceHardwareButton, "rotate">, number> = {
  home: 3,
  lock: 26,
  "volume-up": 24,
  "volume-down": 25,
};

export interface AndroidSdkLayout {
  readonly root: string;
  readonly adb: string;
  readonly emulator: string;
}

export interface AndroidEmulatorBackendOptions {
  readonly platform?: NodeJS.Platform;
  readonly processEnv?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
  readonly run?: typeof runProcess;
  readonly spawnProcess?: (
    command: string,
    args: readonly string[],
  ) => ChildProcessWithoutNullStreams;
  readonly now?: () => number;
}

export function androidExecutableName(platform: NodeJS.Platform, name: string): string {
  return platform === "win32" ? `${name}.exe` : name;
}

export function candidateAndroidSdkRoots(input: {
  readonly env: NodeJS.ProcessEnv;
  readonly homeDir: string;
  readonly platform: NodeJS.Platform;
}): readonly string[] {
  const roots: string[] = [];
  const push = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) roots.push(trimmed);
  };
  push(input.env.ANDROID_HOME);
  push(input.env.ANDROID_SDK_ROOT);
  push(path.join(input.homeDir, "Library", "Android", "sdk"));
  push(path.join(input.homeDir, "Android", "Sdk"));
  if (input.env.LOCALAPPDATA) {
    push(path.join(input.env.LOCALAPPDATA, "Android", "Sdk"));
  }
  if (input.platform === "win32") {
    push(path.join(input.homeDir, "AppData", "Local", "Android", "Sdk"));
  }
  return [...new Set(roots)];
}

export function parseAvdNames(stdout: string): readonly string[] {
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("INFO") && !line.startsWith("ERROR"));
}

export function avdUdid(name: string): string | null {
  const udid = name.trim().replace(/\s+/gu, "_");
  return DEVICE_UDID_PATTERN.test(udid) ? udid : null;
}

export function runtimeLabelFromSysdir(sysdir: string): string {
  const match = /android-(\d+)/u.exec(sysdir);
  if (!match) return "Android";
  const api = Number.parseInt(match[1]!, 10);
  const name = ANDROID_API_NAMES[api];
  return name ? `${name} (API ${api})` : `Android API ${api}`;
}

function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

export class AndroidEmulatorBackend implements DeviceBackend {
  readonly platform = "android-emulator" as const;

  private readonly osPlatform: NodeJS.Platform;
  private readonly processEnv: NodeJS.ProcessEnv;
  private readonly homeDir: string;
  private readonly run: typeof runProcess;
  private readonly spawnProcess: (
    command: string,
    args: readonly string[],
  ) => ChildProcessWithoutNullStreams;
  private readonly now: () => number;
  private readonly serialByUdid = new Map<string, string>();
  /**
   * Sensor writes, coalesced per device. A free-look drag emits a vector every
   * animation frame and each `adb emu` call is a process spawn costing tens of
   * milliseconds, so queuing them would build a backlog that keeps tilting the
   * guest long after the user let go. Only the newest vector survives.
   */
  private readonly gravityWrites = createCoalescedWriter<DeviceGravity>(async (udid, gravity) => {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const vector = [gravity.x, gravity.y, gravity.z].map((value) => value.toFixed(3)).join(":");
    await this.adb(sdk, serial, ["emu", "sensor", "set", "acceleration", vector]);
  });
  private readonly geometryByUdid = new Map<string, DeviceGeometry>();
  private readonly emulatorProcesses = new Map<string, ChildProcessWithoutNullStreams>();
  private readonly streams = new Map<string, ChildProcessWithoutNullStreams>();
  private sdkLayout: AndroidSdkLayout | null | undefined;
  private availabilityMemo: { at: number; value: Promise<DeviceAvailability> } | null = null;
  private listedDevicesMemo: { at: number; devices: Promise<readonly DeviceDescriptor[]> } | null =
    null;
  private disposed = false;

  constructor(options: AndroidEmulatorBackendOptions = {}) {
    this.osPlatform = options.platform ?? process.platform;
    this.processEnv = options.processEnv ?? process.env;
    this.homeDir = options.homeDir ?? homedir();
    this.run = options.run ?? runProcess;
    this.spawnProcess =
      options.spawnProcess ??
      ((command, args) => spawn(command, [...args], { stdio: "pipe", windowsHide: true }));
    this.now = options.now ?? Date.now;
  }

  async availability(): Promise<DeviceAvailability> {
    const now = this.now();
    if (this.availabilityMemo && now - this.availabilityMemo.at < AVAILABILITY_TTL_MS) {
      return await this.availabilityMemo.value;
    }
    const value = this.probeAvailability();
    this.availabilityMemo = { at: now, value };
    try {
      return await value;
    } catch (error) {
      if (this.availabilityMemo?.value === value) this.availabilityMemo = null;
      throw error;
    }
  }

  private async probeAvailability(): Promise<DeviceAvailability> {
    const sdk = await this.resolveSdk();
    const emulatorExists = sdk !== null && (await fileExists(sdk.emulator));
    const adbExists = sdk !== null && (await fileExists(sdk.adb));
    const avds = emulatorExists ? await this.listAvdNames(sdk!) : [];
    const steps: DeviceSetupStep[] = [
      {
        id: "install-android-sdk",
        label: "Install the Android SDK command-line tools",
        done: sdk !== null,
        detail: sdk
          ? sdk.root
          : "Install Android Studio or the command-line tools, then set ANDROID_HOME.",
      },
      {
        id: "install-android-platform-tools",
        label: "Install platform-tools (adb)",
        done: adbExists,
        detail: adbExists ? undefined : "sdkmanager platform-tools",
      },
      {
        id: "install-android-emulator",
        label: "Install the Android Emulator",
        done: emulatorExists,
        detail: emulatorExists ? undefined : "sdkmanager emulator",
      },
      {
        id: "install-android-avd",
        label: "Create an Android Virtual Device",
        done: avds.length > 0,
        detail:
          avds.length > 0
            ? undefined
            : "sdkmanager 'system-images;android-36;google_apis;arm64-v8a' && avdmanager create avd -n Pixel_8 -k 'system-images;android-36;google_apis;arm64-v8a'",
      },
    ];
    if (!steps.every((step) => step.done)) {
      return { kind: "setup-required", steps };
    }
    return { kind: "available" };
  }

  async listDevices(options: DeviceListOptions = {}): Promise<readonly DeviceDescriptor[]> {
    const now = this.now();
    if (!this.listedDevicesMemo || now - this.listedDevicesMemo.at >= LIST_TTL_MS) {
      this.listedDevicesMemo = { at: now, devices: this.listDevicesUncached() };
    }
    const devices = await this.listedDevicesMemo.devices;
    return options.includeShutdown === true
      ? devices
      : devices.filter((device) => device.state !== "shutdown");
  }

  private async listDevicesUncached(): Promise<readonly DeviceDescriptor[]> {
    const sdk = await this.resolveSdk();
    if (!sdk) return [];
    const names = await this.listAvdNames(sdk);
    const booted = await this.listBootedSerials(sdk);
    const devices: DeviceDescriptor[] = [];
    for (const name of names) {
      const udid = avdUdid(name);
      if (!udid) continue;
      const serial = booted.get(udid) ?? booted.get(name) ?? null;
      if (serial) this.serialByUdid.set(udid, serial);
      const state = serial ? "booted" : "shutdown";
      devices.push({
        platform: "android-emulator",
        udid,
        name,
        runtime: await this.runtimeForAvd(name),
        state,
        bootSource: "user",
        family: "phone",
        // The emulator console exposes virtual sensors, so free look can turn
        // the guest as well as the view.
        supportsMotion: true,
      });
    }
    return devices;
  }

  async boot(udid: string): Promise<DeviceDescriptor> {
    this.listedDevicesMemo = null;
    this.availabilityMemo = null;
    const sdk = await this.requireSdk();
    const existing = this.serialByUdid.get(udid) ?? (await this.serialForAvd(sdk, udid));
    if (existing) {
      await this.waitForBoot(sdk, existing);
      return await this.requireDescriptor(udid);
    }
    const child = this.spawnProcess(sdk.emulator, [
      "-avd",
      udid,
      "-no-window",
      "-no-audio",
      "-gpu",
      "swiftshader_indirect",
    ]);
    this.emulatorProcesses.set(udid, child);
    child.once("exit", () => {
      this.emulatorProcesses.delete(udid);
      this.serialByUdid.delete(udid);
    });
    const serial = await this.waitForSerial(sdk, udid);
    this.serialByUdid.set(udid, serial);
    await this.waitForBoot(sdk, serial);
    await this.refreshGeometry(sdk, udid, serial);
    return await this.requireDescriptor(udid);
  }

  async shutdown(udid: string): Promise<void> {
    this.listedDevicesMemo = null;
    await this.detachStream(udid);
    const sdk = await this.resolveSdk();
    const serial = this.serialByUdid.get(udid);
    if (sdk && serial) {
      await this.adb(sdk, serial, ["emu", "kill"], { allowFailure: true });
    }
    this.emulatorProcesses.get(udid)?.kill("SIGTERM");
    this.emulatorProcesses.delete(udid);
    this.serialByUdid.delete(udid);
  }

  async install(udid: string, appPath: string): Promise<DeviceInstallAppResult> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const result = await this.adb(sdk, serial, ["install", "-r", appPath]);
    if (result.code !== 0) {
      throw new DeviceBackendError(`adb install failed: ${result.stderr || result.stdout}`);
    }
    const packageName = await this.packageNameFromApk(appPath);
    return { udid, bundleId: packageName };
  }

  async launch(
    udid: string,
    bundleId: string,
    _launchArguments: readonly string[] = [],
  ): Promise<DeviceLaunchAppResult> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const result = await this.adb(sdk, serial, [
      "shell",
      "monkey",
      "-p",
      bundleId,
      "-c",
      "android.intent.category.LAUNCHER",
      "1",
    ]);
    if (result.code !== 0) {
      throw new DeviceBackendError(`adb launch failed: ${result.stderr || result.stdout}`);
    }
    return { udid, bundleId, pid: null };
  }

  async openUrl(udid: string, url: string): Promise<void> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const result = await this.adb(sdk, serial, [
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      url,
    ]);
    if (result.code !== 0) {
      throw new DeviceBackendError(`adb openurl failed: ${result.stderr || result.stdout}`);
    }
  }

  async tap(udid: string, x: number, y: number): Promise<void> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const pixels = this.toPixels(udid, x, y);
    await this.adb(sdk, serial, ["shell", "input", "tap", String(pixels.x), String(pixels.y)]);
  }

  async swipe(udid: string, gesture: DeviceSwipeGesture): Promise<void> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const from = this.toPixels(udid, gesture.fromX, gesture.fromY);
    const to = this.toPixels(udid, gesture.toX, gesture.toY);
    await this.adb(sdk, serial, [
      "shell",
      "input",
      "swipe",
      String(from.x),
      String(from.y),
      String(to.x),
      String(to.y),
      String(Math.max(1, Math.round(gesture.durationMs))),
    ]);
  }

  async typeText(udid: string, text: string): Promise<void> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const encoded = text.replace(/([\\$"'` ])/gu, "\\$1").replace(/\n/gu, "%s");
    await this.adb(sdk, serial, ["shell", "input", "text", encoded]);
  }

  async keyEvent(udid: string, event: DeviceKeyEvent): Promise<void> {
    if (event.direction === "up") return;
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const keycode = hidToAndroidKeycode(event.keyCode);
    if (keycode === null) return;
    await this.adb(sdk, serial, ["shell", "input", "keyevent", String(keycode)]);
  }

  async pressButton(udid: string, button: DeviceHardwareButton): Promise<void> {
    if (button === "rotate") {
      throw new DeviceBackendError(
        "Rotating a headless emulator is not supported; rotate from inside the app.",
      );
    }
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    await this.adb(sdk, serial, ["shell", "input", "keyevent", String(HARDWARE_KEYCODES[button])]);
  }

  /**
   * Aim the guest's accelerometer, via the emulator console's virtual sensors.
   *
   * Writes coalesce per device: a free-look drag produces a vector every frame,
   * and each `adb emu` call is a process spawn costing tens of milliseconds, so
   * queuing them would build a backlog that keeps tilting the guest long after
   * the user let go. Only the newest vector is ever pending, and only one call
   * is ever in flight — the guest tracks the hand instead of trailing it.
   */
  async setGravity(udid: string, gravity: DeviceGravity): Promise<void> {
    await this.gravityWrites.write(udid, gravity);
  }

  async screenshot(
    udid: string,
    options: { readonly save?: boolean } = {},
  ): Promise<DeviceScreenshotResult> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const png = coercePng(
      await this.execBinary(sdk.adb, ["-s", serial, "exec-out", "screencap", "-p"]),
    );
    if (png.byteLength === 0) {
      throw new DeviceBackendError("adb screencap returned an empty image");
    }
    const dimensions = readPngDimensions(png);
    const savedPath = options.save === true ? await this.saveScreenshotFile(udid, png) : undefined;
    return {
      ...(savedPath ? { path: savedPath } : {}),
      udid,
      name: `emulator-${udid}.png`,
      mimeType: "image/png",
      width: dimensions?.width ?? 1,
      height: dimensions?.height ?? 1,
      sizeBytes: png.byteLength,
      bytesBase64: png.toString("base64"),
      capturedAt: new Date(this.now()).toISOString(),
    };
  }

  async startRecording(udid: string): Promise<DeviceStartRecordingResult> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const directory = await mkdtemp(path.join(tmpdir(), "modesto-android-"));
    const outputPath = path.join(directory, `${udid}.mp4`);
    await this.adb(sdk, serial, ["shell", "rm", "-f", "/sdcard/modesto-record.mp4"], {
      allowFailure: true,
    });
    this.spawnProcess(sdk.adb, [
      "-s",
      serial,
      "shell",
      "screenrecord",
      "/sdcard/modesto-record.mp4",
    ]);
    return {
      udid,
      path: outputPath,
      startedAt: new Date(this.now()).toISOString(),
    };
  }

  async stopRecording(udid: string): Promise<DeviceStopRecordingResult> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    await this.adb(sdk, serial, ["shell", "pkill", "-l", "SIGINT", "screenrecord"], {
      allowFailure: true,
    });
    const directory = await mkdtemp(path.join(tmpdir(), "modesto-android-"));
    const outputPath = path.join(directory, `${udid}.mp4`);
    await this.adb(sdk, serial, ["pull", "/sdcard/modesto-record.mp4", outputPath], {
      allowFailure: true,
    });
    const info = await readFile(outputPath).then(
      (bytes) => ({ sizeBytes: bytes.byteLength }),
      () => ({ sizeBytes: 0 }),
    );
    return {
      udid,
      path: outputPath,
      sizeBytes: info.sizeBytes,
      durationMs: 0,
      stoppedAt: new Date(this.now()).toISOString(),
    };
  }

  async describeUi(udid: string): Promise<DeviceDescribeUiResult> {
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    const dump = await this.adb(sdk, serial, ["exec-out", "uiautomator", "dump", "/dev/tty"], {
      allowFailure: true,
    });
    const xml = dump.stdout.includes("<hierarchy") ? dump.stdout : dump.stderr;
    const root = parseUiAutomatorDump(xml, this.geometryByUdid.get(udid)?.scale ?? 1);
    return {
      udid,
      capturedAt: new Date(this.now()).toISOString(),
      root,
    };
  }

  geometry(udid: string): DeviceGeometry | null {
    return this.geometryByUdid.get(udid) ?? null;
  }

  async attachStream(udid: string, onFrame: DeviceFrameListener): Promise<void> {
    await this.detachStream(udid);
    const sdk = await this.requireSdk();
    const serial = await this.requireSerial(udid);
    await this.refreshGeometry(sdk, udid, serial);
    const child = this.spawnProcess(sdk.adb, [
      "-s",
      serial,
      "exec-out",
      "screenrecord",
      "--output-format=h264",
      "--bit-rate",
      "4000000",
      "-",
    ]);
    this.streams.set(udid, child);
    const assembler = new AndroidH264Assembler();
    let sequence = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      const units = assembler.push(chunk);
      for (const unit of units) {
        sequence = (sequence + 1) >>> 0;
        onFrame({
          sequence,
          timestampMs: this.now(),
          keyframe: unit.keyframe,
          codecConfig: unit.codecConfig,
          data: unit.data,
        });
      }
    });
    await new Promise<void>((resolve, reject) => {
      if (child.pid) {
        resolve();
        return;
      }
      const onError = (error: Error) => {
        child.removeListener("spawn", onSpawn);
        reject(
          new DeviceBackendError(`Android screen capture failed: ${error.message}`, {
            retryable: true,
            cause: error,
          }),
        );
      };
      const onSpawn = () => {
        child.removeListener("error", onError);
        resolve();
      };
      child.once("error", onError);
      child.once("spawn", onSpawn);
    });
  }

  async detachStream(udid: string): Promise<void> {
    const child = this.streams.get(udid);
    if (!child) return;
    this.streams.delete(udid);
    child.kill("SIGTERM");
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await Promise.all([...this.streams.keys()].map((udid) => this.detachStream(udid)));
    for (const child of this.emulatorProcesses.values()) child.kill("SIGTERM");
    this.emulatorProcesses.clear();
  }

  private async resolveSdk(): Promise<AndroidSdkLayout | null> {
    if (this.sdkLayout !== undefined) return this.sdkLayout;
    const adbName = androidExecutableName(this.osPlatform, "adb");
    const emulatorName = androidExecutableName(this.osPlatform, "emulator");
    for (const root of candidateAndroidSdkRoots({
      env: this.processEnv,
      homeDir: this.homeDir,
      platform: this.osPlatform,
    })) {
      const adb = path.join(root, "platform-tools", adbName);
      const emulator = path.join(root, "emulator", emulatorName);
      if ((await fileExists(adb)) || (await fileExists(emulator))) {
        this.sdkLayout = { root, adb, emulator };
        return this.sdkLayout;
      }
    }
    this.sdkLayout = null;
    return null;
  }

  private async requireSdk(): Promise<AndroidSdkLayout> {
    const sdk = await this.resolveSdk();
    if (!sdk) {
      throw new DeviceBackendError(
        "The Android SDK was not found. Install Android Studio or set ANDROID_HOME.",
      );
    }
    return sdk;
  }

  private async listAvdNames(sdk: AndroidSdkLayout): Promise<readonly string[]> {
    const result = await this.run(sdk.emulator, ["-list-avds"], {
      timeoutMs: ADB_TIMEOUT_MS,
      allowNonZeroExit: true,
    }).catch(() => null);
    if (!result || result.code !== 0) return [];
    return parseAvdNames(result.stdout);
  }

  private async listBootedSerials(sdk: AndroidSdkLayout): Promise<Map<string, string>> {
    const result = await this.adbRaw(sdk, ["devices"], { allowFailure: true });
    const serials = result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("emulator-") && /\sdevice\b/u.test(line));
    const map = new Map<string, string>();
    for (const line of serials) {
      const serial = line.split(/\s+/u)[0];
      if (!serial) continue;
      const nameResult = await this.adb(sdk, serial, ["emu", "avd", "name"], {
        allowFailure: true,
      });
      const name = nameResult.stdout.trim().split(/\r?\n/u)[0]?.trim();
      if (name) {
        const udid = avdUdid(name);
        if (udid) map.set(udid, serial);
      }
    }
    return map;
  }

  private async serialForAvd(sdk: AndroidSdkLayout, udid: string): Promise<string | null> {
    const booted = await this.listBootedSerials(sdk);
    return booted.get(udid) ?? null;
  }

  private async requireSerial(udid: string): Promise<string> {
    const sdk = await this.requireSdk();
    const serial = this.serialByUdid.get(udid) ?? (await this.serialForAvd(sdk, udid));
    if (!serial) {
      throw new DeviceBackendError(`Android emulator ${udid} is not booted`, { retryable: true });
    }
    this.serialByUdid.set(udid, serial);
    return serial;
  }

  private async requireDescriptor(udid: string): Promise<DeviceDescriptor> {
    const devices = await this.listDevices({ includeShutdown: true });
    const device = devices.find((candidate) => candidate.udid === udid);
    if (!device) throw new DeviceBackendError(`Android emulator ${udid} disappeared after boot`);
    return { ...device, state: "booted" };
  }

  private async waitForSerial(sdk: AndroidSdkLayout, udid: string): Promise<string> {
    const deadline = this.now() + BOOT_TIMEOUT_MS;
    while (this.now() < deadline) {
      const serial = await this.serialForAvd(sdk, udid);
      if (serial) return serial;
      await delay(1_000);
    }
    throw new DeviceBackendError(`Timed out waiting for ${udid} to appear in adb`, {
      retryable: true,
    });
  }

  private async waitForBoot(sdk: AndroidSdkLayout, serial: string): Promise<void> {
    const deadline = this.now() + BOOT_TIMEOUT_MS;
    while (this.now() < deadline) {
      const result = await this.adb(sdk, serial, ["shell", "getprop", "sys.boot_completed"], {
        allowFailure: true,
      });
      if (result.stdout.trim() === "1") return;
      await delay(1_000);
    }
    throw new DeviceBackendError("Timed out waiting for the Android emulator to finish booting", {
      retryable: true,
    });
  }

  private async refreshGeometry(
    sdk: AndroidSdkLayout,
    udid: string,
    serial: string,
  ): Promise<void> {
    const size = await this.adb(sdk, serial, ["shell", "wm", "size"], { allowFailure: true });
    const density = await this.adb(sdk, serial, ["shell", "wm", "density"], { allowFailure: true });
    const sizeMatch = /(\d+)x(\d+)/u.exec(size.stdout);
    const densityMatch = /(\d+)/u.exec(density.stdout);
    if (!sizeMatch) return;
    const pixelWidth = Number.parseInt(sizeMatch[1]!, 10);
    const pixelHeight = Number.parseInt(sizeMatch[2]!, 10);
    const dpi = densityMatch ? Number.parseInt(densityMatch[1]!, 10) : 160;
    const scale = Math.max(1, dpi / 160);
    this.geometryByUdid.set(udid, {
      pointWidth: pixelWidth / scale,
      pointHeight: pixelHeight / scale,
      scale,
    });
  }

  private toPixels(udid: string, x: number, y: number): { x: number; y: number } {
    const geometry = this.geometryByUdid.get(udid);
    const scale = geometry?.scale ?? 1;
    return { x: Math.round(x * scale), y: Math.round(y * scale) };
  }

  private async runtimeForAvd(name: string): Promise<string> {
    const configPath = path.join(this.homeDir, ".android", "avd", `${name}.avd`, "config.ini");
    const contents = await readFile(configPath, "utf8").catch(() => "");
    const match = /^image\.sysdir(?:\.1)?\s*=\s*(.+)$/mu.exec(contents);
    return match ? runtimeLabelFromSysdir(match[1]!.trim()) : "Android";
  }

  private async packageNameFromApk(appPath: string): Promise<string> {
    const base = path.basename(appPath, path.extname(appPath));
    return base.replace(/[^\w.]+/gu, ".") || "app";
  }

  private async saveScreenshotFile(udid: string, bytes: Buffer): Promise<string> {
    const directory = await mkdtemp(path.join(tmpdir(), "modesto-android-"));
    const target = path.join(directory, `${udid}.png`);
    await writeFile(target, bytes);
    return target;
  }

  private async adb(
    sdk: AndroidSdkLayout,
    serial: string,
    args: readonly string[],
    options: { readonly allowFailure?: boolean } = {},
  ): Promise<ProcessRunResult> {
    return await this.adbRaw(sdk, ["-s", serial, ...args], options);
  }

  private execBinary(command: string, args: readonly string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = this.spawnProcess(command, args);
      const chunks: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code !== 0) {
          reject(new DeviceBackendError(`adb screencap failed with code ${code}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
  }

  private async adbRaw(
    sdk: AndroidSdkLayout,
    args: readonly string[],
    options: { readonly allowFailure?: boolean } = {},
  ): Promise<ProcessRunResult> {
    const result = await this.run(sdk.adb, [...args], {
      timeoutMs: ADB_TIMEOUT_MS,
      allowNonZeroExit: true,
    });
    if (!options.allowFailure && result.code !== 0) {
      throw new DeviceBackendError(
        `adb ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`,
        { retryable: result.timedOut },
      );
    }
    return result;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hidToAndroidKeycode(hidUsage: number): number | null {
  if (hidUsage === 0x28) return 66;
  if (hidUsage === 0x2a) return 67;
  if (hidUsage === 0x29) return 4;
  return null;
}

function coercePng(bytes: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const offset = bytes.indexOf(signature);
  return offset > 0 ? bytes.subarray(offset) : bytes;
}

export function parseUiAutomatorDump(xml: string, scale: number): DeviceUiNode {
  const nodes: DeviceUiNode[] = [];
  const tag = /<node\b([^>]*)\/?>/gu;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(xml))) {
    const attrs = match[1] ?? "";
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/u.exec(attrs);
    const cls = /class="([^"]*)"/u.exec(attrs)?.[1] ?? "View";
    const text = /text="([^"]*)"/u.exec(attrs)?.[1] || null;
    const desc = /content-desc="([^"]*)"/u.exec(attrs)?.[1] || null;
    const left = bounds ? Number.parseInt(bounds[1]!, 10) / scale : 0;
    const top = bounds ? Number.parseInt(bounds[2]!, 10) / scale : 0;
    const right = bounds ? Number.parseInt(bounds[3]!, 10) / scale : 0;
    const bottom = bounds ? Number.parseInt(bounds[4]!, 10) / scale : 0;
    nodes.push({
      role: cls.split(".").at(-1) ?? "View",
      subrole: null,
      label: text ?? desc,
      value: null,
      frame: {
        x: left,
        y: top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      },
      activationPoint: {
        x: left + Math.max(0, right - left) / 2,
        y: top + Math.max(0, bottom - top) / 2,
      },
      children: [],
    });
  }
  return nodes[0]
    ? { ...nodes[0], children: nodes.slice(1) }
    : {
        role: "Window",
        subrole: null,
        label: null,
        value: null,
        frame: { x: 0, y: 0, width: 0, height: 0 },
        activationPoint: null,
        children: [],
      };
}
