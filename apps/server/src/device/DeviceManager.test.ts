import type {
  DeviceAvailability,
  DeviceDescribeUiResult,
  DeviceDescriptor,
  DeviceGeometry,
  DeviceHardwareButton,
  DeviceInstallAppResult,
  DeviceLaunchAppResult,
  DeviceScreenshotResult,
  DeviceStartRecordingResult,
  DeviceStopRecordingResult,
} from "@modesto/contracts";
import { describe, expect, it } from "@effect/vitest";

import {
  type DeviceBackend,
  type DeviceFrameListener,
  type DeviceKeyEvent,
  type DeviceListOptions,
  type DeviceSwipeGesture,
} from "./DeviceBackend.ts";
import { DeviceManager, matchingBootedDevice } from "./DeviceManager.ts";

function iphone(
  udid: string,
  state: DeviceDescriptor["state"],
  name = "iPhone 17 Pro",
): DeviceDescriptor {
  return {
    platform: "ios-simulator",
    udid,
    name,
    runtime: "iOS 27.0",
    state,
    bootSource: "user",
    family: "phone",
  };
}

class FakeBackend implements DeviceBackend {
  readonly platform = "ios-simulator" as const;
  readonly events: string[] = [];
  devices: DeviceDescriptor[];
  availabilityCalls = 0;
  listRelatedDevices?: NonNullable<DeviceBackend["listRelatedDevices"]>;

  constructor(devices: readonly DeviceDescriptor[]) {
    this.devices = [...devices];
  }

  warmupAttach(udid: string): void {
    this.events.push(`warmup:${udid}`);
  }

  availability(): Promise<DeviceAvailability> {
    this.availabilityCalls += 1;
    this.events.push("availability");
    return Promise.resolve({ kind: "available" });
  }

  listDevices(_options?: DeviceListOptions): Promise<readonly DeviceDescriptor[]> {
    this.events.push("list");
    return Promise.resolve(this.devices);
  }

  boot(udid: string): Promise<DeviceDescriptor> {
    this.events.push(`boot:${udid}`);
    const device = this.devices.find((candidate) => candidate.udid === udid);
    if (!device) throw new Error(`unknown ${udid}`);
    const booted = { ...device, state: "booted" as const };
    this.devices = this.devices.map((candidate) => (candidate.udid === udid ? booted : candidate));
    return Promise.resolve(booted);
  }

  shutdown(_udid: string): Promise<void> {
    return Promise.resolve();
  }

  install(udid: string, _appPath: string): Promise<DeviceInstallAppResult> {
    return Promise.resolve({ udid, bundleId: "app" });
  }

  launch(udid: string, bundleId: string): Promise<DeviceLaunchAppResult> {
    return Promise.resolve({ udid, bundleId, pid: null });
  }

  openUrl(_udid: string, _url: string): Promise<void> {
    return Promise.resolve();
  }

  tap(_udid: string, _x: number, _y: number): Promise<void> {
    return Promise.resolve();
  }

  swipe(_udid: string, _gesture: DeviceSwipeGesture): Promise<void> {
    return Promise.resolve();
  }

  typeText(_udid: string, _text: string): Promise<void> {
    return Promise.resolve();
  }

  keyEvent(_udid: string, _event: DeviceKeyEvent): Promise<void> {
    return Promise.resolve();
  }

  pressButton(_udid: string, _button: DeviceHardwareButton): Promise<void> {
    return Promise.resolve();
  }

  screenshot(udid: string): Promise<DeviceScreenshotResult> {
    return Promise.resolve({
      udid,
      name: `${udid}.png`,
      mimeType: "image/png",
      width: 1,
      height: 1,
      sizeBytes: 1,
      bytesBase64: "A",
      capturedAt: "2026-09-08T00:00:00.000Z",
    });
  }

  startRecording(udid: string): Promise<DeviceStartRecordingResult> {
    return Promise.resolve({ udid, path: "/tmp/rec.mp4", startedAt: "2026-09-08T00:00:00.000Z" });
  }

  stopRecording(udid: string): Promise<DeviceStopRecordingResult> {
    return Promise.resolve({
      udid,
      path: "/tmp/rec.mp4",
      sizeBytes: 0,
      durationMs: 0,
      stoppedAt: "2026-09-08T00:00:00.000Z",
    });
  }

  describeUi(udid: string): Promise<DeviceDescribeUiResult> {
    return Promise.resolve({
      udid,
      capturedAt: "2026-09-08T00:00:00.000Z",
      root: {
        role: "Window",
        subrole: null,
        label: null,
        value: null,
        frame: { x: 0, y: 0, width: 0, height: 0 },
        activationPoint: null,
        children: [],
      },
    });
  }

  geometry(_udid: string): DeviceGeometry | null {
    return null;
  }

  attachStream(_udid: string, _onFrame: DeviceFrameListener): Promise<void> {
    return Promise.resolve();
  }

  detachStream(_udid: string): Promise<void> {
    return Promise.resolve();
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

describe("matchingBootedDevice", () => {
  it("returns the requested device when it is already booted", () => {
    const booted = iphone("aaa", "booted");
    expect(matchingBootedDevice([booted, iphone("bbb", "shutdown")], "aaa")).toEqual(booted);
  });

  it("reuses a booted twin of the same model instead of booting a shutdown copy", () => {
    const booted = iphone("booted", "booted");
    const shutdown = iphone("shutdown", "shutdown");
    expect(matchingBootedDevice([shutdown, booted], "shutdown")).toEqual(booted);
  });

  it("does not match a booted device with a different marketing name", () => {
    expect(
      matchingBootedDevice(
        [iphone("mini", "booted", "iPhone 17"), iphone("pro", "shutdown")],
        "pro",
      ),
    ).toBeNull();
  });
});

describe("DeviceManager boot", () => {
  it("starts helper warmup before listing and does not probe availability", async () => {
    const backend = new FakeBackend([iphone("pro", "shutdown")]);
    const manager = new DeviceManager({ backend });
    await manager.boot("pro");
    expect(backend.events[0]).toBe("warmup:pro");
    expect(backend.events).toContain("boot:pro");
    expect(backend.availabilityCalls).toBe(0);
  });

  it("attaches to an already-booted UDID without calling boot", async () => {
    const backend = new FakeBackend([iphone("pro", "booted")]);
    const manager = new DeviceManager({ backend });
    const result = await manager.boot("pro");
    expect(result).toMatchObject({ kind: "booted", device: { udid: "pro", state: "booted" } });
    expect(backend.events).toEqual(["warmup:pro", "list"]);
  });

  it("short-circuits a shutdown UDID when a matching model is already booted", async () => {
    const backend = new FakeBackend([iphone("shutdown", "shutdown"), iphone("running", "booted")]);
    const manager = new DeviceManager({ backend });
    const result = await manager.boot("shutdown");
    expect(result).toMatchObject({ kind: "booted", device: { udid: "running", state: "booted" } });
    expect(backend.events.filter((event) => event.startsWith("boot:"))).toEqual([]);
  });

  it("keeps other-platform boot slots when listing only the requested runtime", async () => {
    const pixel: DeviceDescriptor = {
      platform: "android-emulator",
      udid: "Pixel_10",
      name: "Pixel 10",
      runtime: "Android 17 (API 37)",
      state: "shutdown",
      bootSource: "user",
      family: "phone",
    };
    const backend = new FakeBackend([pixel, iphone("pro", "shutdown")]);
    backend.listRelatedDevices = async (udid) =>
      backend.devices.filter((device) => device.udid === udid);
    const manager = new DeviceManager({ backend, bootLimit: 1 });
    expect((await manager.boot("Pixel_10")).kind).toBe("booted");
    expect(await manager.boot("pro")).toMatchObject({ kind: "boot-limit-reached", limit: 1 });
    expect(backend.events.filter((event) => event.startsWith("boot:"))).toEqual(["boot:Pixel_10"]);
  });
});
