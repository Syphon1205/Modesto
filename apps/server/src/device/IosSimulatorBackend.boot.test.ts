import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import { IosSimulatorBackend } from "./IosSimulatorBackend.ts";
import type { ProcessRunOptions, ProcessRunResult } from "./runProcess.ts";

function ok(stdout = "", stderr = ""): ProcessRunResult {
  return { stdout, stderr, code: 0, signal: null, timedOut: false };
}

function toolName(command: string): string {
  return command.split("/").pop() ?? command;
}

function isForbiddenBootInvocation(command: string, args: readonly string[]): string | null {
  const rendered = [command, ...args].join(" ");
  if (toolName(command) === "open" && args.some((arg) => /Xcode/iu.test(arg))) {
    return rendered;
  }
  if (args.includes("-project") || args.includes("-workspace")) return rendered;
  if (rendered.includes(".xcodeproj") || rendered.includes(".xcworkspace")) return rendered;
  return null;
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
        state: "Booted",
        isAvailable: true,
        deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro",
      },
    ],
  },
});

describe("IosSimulatorBackend.boot", () => {
  it("fires simctl boot without waiting for helper compile or plutil", async () => {
    const calls: string[] = [];
    let helperFinished = false;
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));

    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      listApplications: async () => ["Xcode.app"],
      xcodeBundleUsable: async () => true,
      processEnv: { DEVELOPER_DIR: XCODE_DEVELOPER },
      run: async (command, args, options) => {
        const forbidden = isForbiddenBootInvocation(command, args);
        expect(forbidden).toBeNull();
        const rendered = [command, ...args].join(" ");
        calls.push(rendered);
        if (rendered.includes("plutil")) {
          throw new Error("device-type catalogue must not run during boot");
        }
        if (command === "/bin/sh") {
          expect(options?.cwd).toBe(cacheRoot);
          await new Promise((resolve) => setTimeout(resolve, 250));
          helperFinished = true;
          return ok();
        }
        if (args.includes("boot") && !args.includes("bootstatus")) {
          expect(helperFinished).toBe(false);
          expect(toolName(command)).toBe("simctl");
          expect(command).toBe(`${XCODE_DEVELOPER}/usr/bin/simctl`);
          return ok();
        }
        if (args.includes("bootstatus")) {
          throw new Error("bootstatus must not block the boot RPC");
        }
        if (args.includes("list") && args.includes("devices")) return ok(LIST_JSON);
        if (toolName(command) === "xcode-select" || toolName(command) === "xcodebuild") {
          expect(args).toEqual(toolName(command) === "xcodebuild" ? ["-version"] : ["-p"]);
          if (toolName(command) === "xcodebuild") expect(options?.cwd).toBe(cacheRoot);
          return ok(XCODEBUILD_VERSION);
        }
        return ok();
      },
    });

    const device = await backend.boot(UDID);
    expect(device).toMatchObject({ udid: UDID, state: "booted", name: "iPhone 17 Pro" });
    expect(calls.some((call) => call.includes(`simctl boot ${UDID}`))).toBe(true);
    expect(calls.some((call) => call.includes("plutil"))).toBe(false);
    expect(helperFinished).toBe(false);
    expect(calls.some((call) => call.includes("open"))).toBe(false);
  });

  it("pins DEVELOPER_DIR to Xcode.app when xcode-select still points at the CLT", async () => {
    const calls: Array<{
      command: string;
      args: readonly string[];
      env?: NodeJS.ProcessEnv | undefined;
    }> = [];
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));

    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      listApplications: async () => ["Xcode.app"],
      xcodeBundleUsable: async () => true,
      processEnv: {},
      run: async (command, args, options?: ProcessRunOptions) => {
        expect(isForbiddenBootInvocation(command, args)).toBeNull();
        calls.push({ command, args, env: options?.env });
        if (toolName(command) === "xcode-select") {
          return ok("/Library/Developer/CommandLineTools");
        }
        if (args.includes("boot") && !args.includes("bootstatus")) {
          expect(options?.env?.DEVELOPER_DIR).toBe(XCODE_DEVELOPER);
          expect(command).toBe(`${XCODE_DEVELOPER}/usr/bin/simctl`);
          return ok();
        }
        if (args.includes("bootstatus")) {
          throw new Error("bootstatus must not block the boot RPC");
        }
        if (args.includes("list") && args.includes("devices")) return ok(LIST_JSON);
        if (toolName(command) === "xcodebuild") {
          expect(args).toEqual(["-version"]);
          expect(options?.cwd).toBe(cacheRoot);
          return ok(XCODEBUILD_VERSION);
        }
        if (command === "/bin/sh") {
          expect(options?.cwd).toBe(cacheRoot);
          return ok();
        }
        return ok();
      },
    });

    const device = await backend.boot(UDID);
    expect(device.state).toBe("booted");
    expect(
      calls.some((call) => call.args.includes("boot") && !call.args.includes("bootstatus")),
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          toolName(call.command) === "open" ||
          call.args.includes("-project") ||
          call.args.includes("-workspace"),
      ),
    ).toBe(false);
  });

  it("skips bootstatus when the simulator is already Booted", async () => {
    const calls: string[] = [];
    const cacheRoot = await mkdtemp(path.join(tmpdir(), "modesto-helper-"));
    const backend = new IosSimulatorBackend({
      platform: "darwin",
      helperCacheRoot: cacheRoot,
      helperSourceDir: cacheRoot,
      processEnv: { DEVELOPER_DIR: XCODE_DEVELOPER },
      run: async (command, args) => {
        expect(isForbiddenBootInvocation(command, args)).toBeNull();
        const rendered = [command, ...args].join(" ");
        calls.push(rendered);
        if (args.includes("boot") && !args.includes("bootstatus")) {
          return {
            stdout: "",
            stderr: "Unable to boot device in current state: Booted",
            code: 149,
            signal: null,
            timedOut: false,
          };
        }
        if (args.includes("bootstatus")) {
          throw new Error("bootstatus should be skipped for an already-booted device");
        }
        if (args.includes("list") && args.includes("devices")) return ok(LIST_JSON);
        if (toolName(command) === "xcode-select" || toolName(command) === "xcodebuild") {
          return ok(XCODEBUILD_VERSION);
        }
        return ok();
      },
    });

    const device = await backend.boot(UDID);
    expect(device.state).toBe("booted");
    expect(calls.some((call) => call.includes("bootstatus"))).toBe(false);
  });
});
