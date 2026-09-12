import * as Context from "effect/Context";

import type { DeviceManager } from "../DeviceManager.ts";

export interface DeviceServiceShape {
  /**
   * True when the pane should be offered. The backends still report
   * setup-required when Xcode or the Android SDK is missing.
   */
  readonly supported: boolean;
  readonly manager: DeviceManager;
}

export class DeviceService extends Context.Service<DeviceService, DeviceServiceShape>()(
  "modesto/device/Services/DeviceService",
) {}
