import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import {
  hasAvailableIosSimulatorRuntime,
  IosSimulatorBackend,
  iosSimulatorRuntimeInstallCommand,
} from "./IosSimulatorBackend.ts";
import type { ProcessRunResult } from "./runProcess.ts";

function ok(stdout = "", stderr = ""): ProcessRunResult {
  return { stdout, stderr, code: 0, signal: null, timedOut: false };
}

function toolName(command: string): string {
  return command.split("/").pop() ?? command;
}

const UDID = "8D819C5C-F423-4061-9431-97A62AF58EAB";
const XCODE_DEVELOPER = "/Applications/Xcode.app/Contents/Developer";
const XCODEBUILD_VERSION = "Xcode 26.6\nBuild version 17F140";

const LIST_JSON = JSON.stringify({
  devices: {
    "com.apple.CoreSimulator.SimRuntime.iOS-27-0": [
      {
        udid: UDID,
        name: "iPhone 17 Pro",
        state: "Shutdown",
        isAvailable: true,
        deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro",
      },
    ],
  },
});

describe("IosSimulatorBackend.availability", () => {
  it("treats Select Xcode as done when Xcode.app is discovered while CLT is selected", async () => {
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));
    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      listApplications: async () => ["Xcode.app"],
      xcodeBundleUsable: async () => true,
      processEnv: {},
      run: async (command, args) => {
        expect(args.includes("-project")).toBe(false);
        expect(args.includes("-workspace")).toBe(false);
        if (toolName(command) === "xcode-select") return ok("/Library/Developer/CommandLineTools");
        if (toolName(command) === "xcodebuild") return ok(XCODEBUILD_VERSION);
        if (args.includes("list") && args.includes("devices")) return ok(LIST_JSON);
        return ok();
      },
    });

    const availability = await backend.availability();
    expect(availability.kind).toBe("setup-required");
    if (availability.kind !== "setup-required") return;
    const byId = Object.fromEntries(availability.steps.map((step) => [step.id, step]));
    expect(byId["install-xcode"]?.done).toBe(true);
    expect(byId["select-xcode-command-line-tools"]?.done).toBe(true);
    expect(byId["install-ios-runtime"]?.done).toBe(true);
    expect(byId["select-xcode-command-line-tools"]?.detail).toBeUndefined();
  });

  it("still lists simulators when the Xcode license card is unfinished", async () => {
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));
    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      listApplications: async () => ["Xcode.app"],
      xcodeBundleUsable: async () => true,
      processEnv: { DEVELOPER_DIR: XCODE_DEVELOPER },
      run: async (command, args) => {
        if (toolName(command) === "xcodebuild") {
          return {
            stdout: "",
            stderr: "Agreeing to the Xcode license requires admin privileges",
            code: 69,
            signal: null,
            timedOut: false,
          };
        }
        if (args.includes("list") && args.includes("devices")) return ok(LIST_JSON);
        return ok();
      },
    });

    const availability = await backend.availability();
    expect(availability.kind).toBe("setup-required");
    if (availability.kind !== "setup-required") return;
    const byId = Object.fromEntries(availability.steps.map((step) => [step.id, step]));
    expect(byId["install-ios-runtime"]?.done).toBe(true);
    expect(byId["accept-xcode-license"]?.done).toBe(false);

    const devices = await backend.listDevices({ includeShutdown: true });
    expect(devices.map((device) => device.name)).toEqual(["iPhone 17 Pro"]);
  });

  it("marks the runtime step done when simctl lists iPhones and does not suggest the no-op download", async () => {
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));
    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      listApplications: async () => ["Xcode.app"],
      xcodeBundleUsable: async () => true,
      processEnv: { DEVELOPER_DIR: XCODE_DEVELOPER },
      run: async (command, args) => {
        expect(args.join(" ")).not.toBe("-downloadPlatform iOS");
        if (args.includes("list") && args.includes("devices")) return ok(LIST_JSON);
        if (args.includes("runtimes")) throw new Error("runtimes must not run when devices exist");
        if (toolName(command) === "xcodebuild") return ok(XCODEBUILD_VERSION);
        return ok();
      },
    });

    const availability = await backend.availability();
    expect(availability.kind).toBe("setup-required");
    if (availability.kind !== "setup-required") return;
    const runtime = availability.steps.find((step) => step.id === "install-ios-runtime");
    expect(runtime?.done).toBe(true);
    expect(runtime?.detail).toBeUndefined();
  });

  it("treats an installed iOS runtime as done even when the device list is empty", async () => {
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));
    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      listApplications: async () => ["Xcode.app"],
      xcodeBundleUsable: async () => true,
      processEnv: { DEVELOPER_DIR: XCODE_DEVELOPER },
      run: async (command, args) => {
        if (args.includes("list") && args.includes("devices"))
          return ok(JSON.stringify({ devices: {} }));
        if (args.includes("runtimes")) {
          return ok(
            JSON.stringify({
              runtimes: [
                {
                  identifier: "com.apple.CoreSimulator.SimRuntime.iOS-27-0",
                  name: "iOS 27.0",
                  isAvailable: true,
                },
              ],
            }),
          );
        }
        if (toolName(command) === "xcodebuild") return ok(XCODEBUILD_VERSION);
        return ok();
      },
    });

    const availability = await backend.availability();
    if (availability.kind !== "setup-required") return;
    expect(availability.steps.find((step) => step.id === "install-ios-runtime")?.done).toBe(true);
  });

  it("suggests a flagged download command, not the Xcode 26 no-op, when no runtime exists", async () => {
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));
    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      listApplications: async () => ["Xcode.app"],
      xcodeBundleUsable: async () => true,
      processEnv: { DEVELOPER_DIR: XCODE_DEVELOPER },
      run: async (command, args) => {
        if (args.includes("list") && args.includes("devices"))
          return ok(JSON.stringify({ devices: {} }));
        if (args.includes("runtimes")) return ok(JSON.stringify({ runtimes: [] }));
        if (toolName(command) === "xcodebuild") return ok(XCODEBUILD_VERSION);
        return ok();
      },
    });

    const availability = await backend.availability();
    if (availability.kind !== "setup-required") return;
    const runtime = availability.steps.find((step) => step.id === "install-ios-runtime");
    expect(runtime?.done).toBe(false);
    expect(runtime?.detail).not.toBe("xcodebuild -downloadPlatform iOS");
    expect(runtime?.detail).toBe(iosSimulatorRuntimeInstallCommand());
    expect(runtime?.detail).toContain("-architectureVariant");
  });
});

describe("hasAvailableIosSimulatorRuntime", () => {
  it("keeps available iOS disk images and drops watch runtimes", () => {
    expect(
      hasAvailableIosSimulatorRuntime(
        JSON.stringify({
          runtimes: [
            {
              identifier: "com.apple.CoreSimulator.SimRuntime.iOS-27-0",
              name: "iOS 27.0",
              isAvailable: true,
            },
            {
              identifier: "com.apple.CoreSimulator.SimRuntime.watchOS-26-5",
              name: "watchOS 26.5",
              isAvailable: true,
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(hasAvailableIosSimulatorRuntime(JSON.stringify({ runtimes: [] }))).toBe(false);
  });
});
