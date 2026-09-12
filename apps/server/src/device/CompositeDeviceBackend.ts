/**
 * CompositeDeviceBackend - one DeviceBackend that fans out to iOS and Android.
 *
 * The manager still talks to a single backend. This router lists every runtime,
 * then sends each call to the backend that last advertised that UDID.
 *
 * @module device/CompositeDeviceBackend
 */
import type {
  DeviceAvailability,
  DeviceDescribeUiResult,
  DeviceDescriptor,
  DeviceGeometry,
  DeviceHardwareButton,
  DeviceInstallAppResult,
  DeviceLaunchAppResult,
  DevicePlatform,
  DeviceScreenshotResult,
  DeviceSetupStep,
  DeviceStartRecordingResult,
  DeviceStopRecordingResult,
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

export class CompositeDeviceBackend implements DeviceBackend {
  /**
   * Unused by the manager. Routing is per UDID; this field only satisfies the
   * DeviceBackend shape. Prefer whatever backend can actually boot something.
   */
  readonly platform: DevicePlatform;

  private readonly backends: readonly DeviceBackend[];
  private readonly owners = new Map<string, DeviceBackend>();

  constructor(backends: readonly DeviceBackend[]) {
    if (backends.length === 0) {
      throw new Error("CompositeDeviceBackend requires at least one backend");
    }
    this.backends = backends;
    this.platform = backends[0]!.platform;
  }

  async availability(): Promise<DeviceAvailability> {
    const results = await Promise.all(this.backends.map((backend) => backend.availability()));
    const leftoverSteps: DeviceSetupStep[] = results.flatMap((result) =>
      result.kind === "setup-required" ? [...result.steps] : [],
    );
    // A ready iOS install must not hide Android's checklist (and vice versa).
    // The pane filters these steps by the maker the user picked.
    if (leftoverSteps.length > 0) {
      return { kind: "setup-required", steps: leftoverSteps };
    }
    const ready = results.find((result) => result.kind === "available");
    if (ready) return ready;
    const degraded = results.find((result) => result.kind === "degraded");
    if (degraded) return degraded;
    const helper = results.find((result) => result.kind === "helper-unavailable");
    if (helper) return helper;
    const unsupported = results.find((result) => result.kind === "unsupported-platform");
    return unsupported ?? { kind: "unsupported-platform", platform: "unknown" };
  }

  async listDevices(options?: DeviceListOptions): Promise<readonly DeviceDescriptor[]> {
    const lists = await Promise.all(
      this.backends.map(async (backend) => {
        try {
          const devices = await backend.listDevices(options);
          for (const device of devices) this.owners.set(device.udid, backend);
          return devices;
        } catch {
          return [];
        }
      }),
    );
    return lists.flat();
  }

  /**
   * List only the backend that owns this UDID. An iPhone boot must not wait for
   * Android's emulator binary to start up and dump AVDs.
   */
  async listRelatedDevices(
    udid: string,
    options?: DeviceListOptions,
  ): Promise<readonly DeviceDescriptor[]> {
    const located = await this.locateBackend(udid);
    if (!located) return [];
    return options?.includeShutdown === true
      ? located.devices
      : located.devices.filter((device) => device.state !== "shutdown");
  }

  warmupAttach(udid: string): void {
    const known = this.owners.get(udid);
    if (known) {
      known.warmupAttach?.(udid);
      return;
    }
    // Unknown owner: only the iOS helper is expensive to build, and iOS UDIDs
    // are UUIDs. An AVD name must not kick off a Swift compile.
    if (!looksLikeIosUdid(udid)) return;
    for (const backend of this.backends) {
      if (backend.platform === "ios-simulator") backend.warmupAttach?.(udid);
    }
  }

  async boot(udid: string): Promise<DeviceDescriptor> {
    const backend = await this.backendFor(udid);
    const device = await backend.boot(udid);
    this.owners.set(device.udid, backend);
    return device;
  }

  async shutdown(udid: string): Promise<void> {
    await (await this.backendFor(udid)).shutdown(udid);
  }

  async install(udid: string, appPath: string): Promise<DeviceInstallAppResult> {
    return await (await this.backendFor(udid)).install(udid, appPath);
  }

  async launch(
    udid: string,
    bundleId: string,
    launchArguments?: readonly string[],
  ): Promise<DeviceLaunchAppResult> {
    return await (await this.backendFor(udid)).launch(udid, bundleId, launchArguments);
  }

  async openUrl(udid: string, url: string): Promise<void> {
    await (await this.backendFor(udid)).openUrl(udid, url);
  }

  async tap(udid: string, x: number, y: number): Promise<void> {
    await (await this.backendFor(udid)).tap(udid, x, y);
  }

  async swipe(udid: string, gesture: DeviceSwipeGesture): Promise<void> {
    await (await this.backendFor(udid)).swipe(udid, gesture);
  }

  async typeText(udid: string, text: string): Promise<void> {
    await (await this.backendFor(udid)).typeText(udid, text);
  }

  async keyEvent(udid: string, event: DeviceKeyEvent): Promise<void> {
    await (await this.backendFor(udid)).keyEvent(udid, event);
  }

  async pressButton(udid: string, button: DeviceHardwareButton): Promise<void> {
    await (await this.backendFor(udid)).pressButton(udid, button);
  }

  /**
   * Only forwarded when the owning backend implements it. Declared as a plain
   * method rather than an optional one because the composite cannot know which
   * runtime a UDID belongs to until it resolves it, so the refusal has to come
   * from here rather than from the property being absent.
   */
  async setGravity(udid: string, gravity: DeviceGravity): Promise<void> {
    const backend = await this.backendFor(udid);
    if (!backend.setGravity) {
      throw new DeviceBackendError("This device runtime cannot simulate motion.");
    }
    await backend.setGravity(udid, gravity);
  }

  async screenshot(
    udid: string,
    options?: { readonly save?: boolean },
  ): Promise<DeviceScreenshotResult> {
    return await (await this.backendFor(udid)).screenshot(udid, options);
  }

  async startRecording(udid: string): Promise<DeviceStartRecordingResult> {
    return await (await this.backendFor(udid)).startRecording(udid);
  }

  async stopRecording(udid: string): Promise<DeviceStopRecordingResult> {
    return await (await this.backendFor(udid)).stopRecording(udid);
  }

  async describeUi(udid: string): Promise<DeviceDescribeUiResult> {
    return await (await this.backendFor(udid)).describeUi(udid);
  }

  geometry(udid: string): DeviceGeometry | null {
    return this.owners.get(udid)?.geometry(udid) ?? null;
  }

  async attachStream(udid: string, onFrame: DeviceFrameListener): Promise<void> {
    await (await this.backendFor(udid)).attachStream(udid, onFrame);
  }

  async detachStream(udid: string): Promise<void> {
    const backend = this.owners.get(udid);
    if (!backend) return;
    await backend.detachStream(udid);
  }

  async dispose(): Promise<void> {
    await Promise.all(this.backends.map((backend) => backend.dispose()));
    this.owners.clear();
  }

  private async backendFor(udid: string): Promise<DeviceBackend> {
    const located = await this.locateBackend(udid);
    if (located) return located.backend;
    throw new DeviceBackendError(`No simulator named ${udid}`);
  }

  /**
   * Resolve the owning backend as soon as one listing contains the UDID.
   * Sibling backends keep running in the background so later calls are cached,
   * but an iOS boot does not wait for Android (or vice versa).
   */
  private async locateBackend(udid: string): Promise<{
    readonly backend: DeviceBackend;
    readonly devices: readonly DeviceDescriptor[];
  } | null> {
    const known = this.owners.get(udid);
    if (known) {
      const devices = await known.listDevices({ includeShutdown: true }).catch(() => []);
      for (const device of devices) this.owners.set(device.udid, known);
      return { backend: known, devices };
    }

    // Sequential by likelihood so an iPhone boot never starts `emulator -list-avds`.
    for (const backend of orderBackendsForUdid(this.backends, udid)) {
      const devices = await backend.listDevices({ includeShutdown: true }).catch(() => []);
      for (const device of devices) this.owners.set(device.udid, backend);
      if (devices.some((device) => device.udid === udid)) return { backend, devices };
    }
    return null;
  }
}

/** CoreSimulator UDIDs are RFC-4122; Android AVDs are names like `Pixel_10`. */
export function looksLikeIosUdid(udid: string): boolean {
  return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/u.test(
    udid,
  );
}

function orderBackendsForUdid(
  backends: readonly DeviceBackend[],
  udid: string,
): readonly DeviceBackend[] {
  const iosFirst = looksLikeIosUdid(udid);
  return [...backends].sort((left, right) => {
    const rank = (backend: DeviceBackend): number => {
      if (iosFirst) return backend.platform === "ios-simulator" ? 0 : 1;
      return backend.platform === "android-emulator" ? 0 : 1;
    };
    return rank(left) - rank(right);
  });
}
