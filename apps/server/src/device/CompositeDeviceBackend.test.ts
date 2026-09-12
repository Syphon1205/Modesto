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
import { CompositeDeviceBackend } from "./CompositeDeviceBackend.ts";

function descriptor(
  platform: DeviceDescriptor["platform"],
  udid: string,
  name = udid,
): DeviceDescriptor {
  return {
    platform,
    udid,
    name,
    runtime: platform === "ios-simulator" ? "iOS 26.2" : "Android 17 (API 37)",
    state: "shutdown",
    bootSource: "user",
    family: "phone",
  };
}

class FakeBackend implements DeviceBackend {
  readonly boots: string[] = [];
  readonly lists: number[] = [];
  readonly warmups: string[] = [];

  readonly platform: DeviceDescriptor["platform"];
  private readonly devices: readonly DeviceDescriptor[];
  private readonly availabilityResult: DeviceAvailability;

  constructor(
    platform: DeviceDescriptor["platform"],
    devices: readonly DeviceDescriptor[],
    availabilityResult: DeviceAvailability,
  ) {
    this.platform = platform;
    this.devices = devices;
    this.availabilityResult = availabilityResult;
  }

  availability(): Promise<DeviceAvailability> {
    return Promise.resolve(this.availabilityResult);
  }

  listDevices(_options?: DeviceListOptions): Promise<readonly DeviceDescriptor[]> {
    this.lists.push(1);
    return Promise.resolve(this.devices);
  }

  warmupAttach(udid: string): void {
    this.warmups.push(udid);
  }

  boot(udid: string): Promise<DeviceDescriptor> {
    this.boots.push(udid);
    const device = this.devices.find((candidate) => candidate.udid === udid);
    if (!device) throw new Error(`unknown ${udid}`);
    return Promise.resolve({ ...device, state: "booted" });
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

describe("CompositeDeviceBackend", () => {
  it("merges device lists from every backend", async () => {
    const ios = new FakeBackend("ios-simulator", [descriptor("ios-simulator", "iphone")], {
      kind: "available",
    });
    const android = new FakeBackend(
      "android-emulator",
      [descriptor("android-emulator", "Pixel_8")],
      { kind: "available" },
    );
    const composite = new CompositeDeviceBackend([ios, android]);
    const devices = await composite.listDevices({ includeShutdown: true });
    expect(devices.map((device) => device.udid)).toEqual(["iphone", "Pixel_8"]);
  });

  it("routes boot to the backend that advertised the UDID", async () => {
    const ios = new FakeBackend("ios-simulator", [descriptor("ios-simulator", "iphone")], {
      kind: "available",
    });
    const android = new FakeBackend(
      "android-emulator",
      [descriptor("android-emulator", "Pixel_8")],
      { kind: "available" },
    );
    const composite = new CompositeDeviceBackend([ios, android]);
    await composite.boot("Pixel_8");
    expect(android.boots).toEqual(["Pixel_8"]);
    expect(ios.boots).toEqual([]);
  });

  it("keeps leftover setup from the other platform when one backend is ready", async () => {
    const ios = new FakeBackend("ios-simulator", [], {
      kind: "setup-required",
      steps: [{ id: "install-xcode", label: "Xcode installed", done: false }],
    });
    const android = new FakeBackend("android-emulator", [], { kind: "available" });
    const composite = new CompositeDeviceBackend([ios, android]);
    expect(await composite.availability()).toEqual({
      kind: "setup-required",
      steps: [{ id: "install-xcode", label: "Xcode installed", done: false }],
    });
  });

  it("merges setup checklists when nothing is ready", async () => {
    const ios = new FakeBackend("ios-simulator", [], {
      kind: "setup-required",
      steps: [{ id: "install-xcode", label: "Install Xcode", done: false }],
    });
    const android = new FakeBackend("android-emulator", [], {
      kind: "setup-required",
      steps: [{ id: "install-android-sdk", label: "Install the Android SDK", done: false }],
    });
    const composite = new CompositeDeviceBackend([ios, android]);
    const availability = await composite.availability();
    expect(availability).toEqual({
      kind: "setup-required",
      steps: [
        { id: "install-xcode", label: "Install Xcode", done: false },
        { id: "install-android-sdk", label: "Install the Android SDK", done: false },
      ],
    });
  });

  it("boots an iPhone without waiting for Android listing", async () => {
    const udid = "8D819C5C-F423-4061-9431-97A62AF58EAB";
    const ios = new FakeBackend(
      "ios-simulator",
      [descriptor("ios-simulator", udid, "iPhone 17 Pro")],
      {
        kind: "available",
      },
    );
    const android = new FakeBackend(
      "android-emulator",
      [descriptor("android-emulator", "Pixel_8")],
      {
        kind: "available",
      },
    );
    android.listDevices = () =>
      new Promise(() => {
        // Hang: an iOS boot must not wait on emulator -list-avds.
      });
    const composite = new CompositeDeviceBackend([ios, android]);
    const device = await composite.boot(udid);
    expect(device.udid).toBe(udid);
    expect(ios.boots).toEqual([udid]);
    expect(android.boots).toEqual([]);
  });

  it("warms the iOS helper for a simulator UDID without touching Android", () => {
    const udid = "8D819C5C-F423-4061-9431-97A62AF58EAB";
    const ios = new FakeBackend("ios-simulator", [descriptor("ios-simulator", udid)], {
      kind: "available",
    });
    const android = new FakeBackend("android-emulator", [], { kind: "available" });
    const composite = new CompositeDeviceBackend([ios, android]);
    composite.warmupAttach(udid);
    expect(ios.warmups).toEqual([udid]);
    expect(android.warmups).toEqual([]);
  });
});
