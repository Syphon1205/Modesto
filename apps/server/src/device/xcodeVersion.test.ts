import { ThreadDeviceState, ThreadId } from "@modesto/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";

import {
  familyFromDeviceTypeIdentifier,
  isPhoneOrTabletSimulator,
  parseSimctlDevices,
  parseXcodebuildVersion,
} from "./IosSimulatorBackend.ts";

describe("parseXcodebuildVersion", () => {
  it("reads the marketing version from xcodebuild -version", () => {
    expect(parseXcodebuildVersion("Xcode 26.6\nBuild version 17F140")).toBe("26.6");
    expect(parseXcodebuildVersion("not xcode")).toBeNull();
  });
});

describe("isPhoneOrTabletSimulator", () => {
  it("keeps iPhones and iPads and drops watches", () => {
    expect(isPhoneOrTabletSimulator({ name: "iPhone 17 Pro", family: "phone" })).toBe(true);
    expect(isPhoneOrTabletSimulator({ name: "iPad mini (A17 Pro)", family: "tablet" })).toBe(true);
    expect(isPhoneOrTabletSimulator({ name: "Apple Watch Series 11" })).toBe(false);
    expect(isPhoneOrTabletSimulator({ name: "Apple Vision Pro" })).toBe(false);
  });

  it("reads phone vs tablet from a CoreSimulator type identifier", () => {
    expect(
      familyFromDeviceTypeIdentifier("com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro"),
    ).toBe("phone");
    expect(
      familyFromDeviceTypeIdentifier("com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch"),
    ).toBe("tablet");
    expect(
      familyFromDeviceTypeIdentifier("com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-11"),
    ).toBeUndefined();
  });
});

describe("parseSimctlDevices", () => {
  it("keeps iPhones and iPads from the type identifier without a profile catalogue", () => {
    const devices = parseSimctlDevices(
      JSON.stringify({
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-27-0": [
            {
              udid: "8D819C5C-F423-4061-9431-97A62AF58EAB",
              name: "iPhone 17 Pro",
              state: "Shutdown",
              isAvailable: true,
              deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro",
            },
            {
              udid: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
              name: "iPad Pro 13-inch (M5)",
              state: "Shutdown",
              isAvailable: true,
              deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch",
            },
            {
              udid: "11111111-1111-1111-1111-111111111111",
              name: "Apple Watch Series 11",
              state: "Shutdown",
              isAvailable: true,
              deviceTypeIdentifier: "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-11",
            },
          ],
        },
      }),
    );
    expect(devices.map((device) => ({ name: device.name, family: device.family }))).toEqual([
      { name: "iPhone 17 Pro", family: "phone" },
      { name: "iPad Pro 13-inch (M5)", family: "tablet" },
    ]);
    expect(
      Schema.encodeUnknownExit(ThreadDeviceState)({
        threadId: ThreadId.make("thread-1"),
        version: 0,
        attachedDeviceUdid: null,
        devices,
        agentActive: false,
        availability: { kind: "available" },
        lastError: null,
        attachPhase: null,
      })._tag,
    ).toBe("Success");
  });
});
