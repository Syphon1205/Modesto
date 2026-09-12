import { describe, expect, it } from "@effect/vitest";

import { decodeSimulatorDevices } from "./handlers.ts";

describe("iOS Simulator device discovery", () => {
  it("keeps available iOS devices and normalizes their runtime and state", () => {
    expect(
      decodeSimulatorDevices(
        JSON.stringify({
          devices: {
            "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
              {
                udid: "BOOTED-UDID",
                name: "iPhone 17 Pro",
                state: "Booted",
                isAvailable: true,
              },
              {
                udid: "UNAVAILABLE-UDID",
                name: "Old iPhone",
                state: "Shutdown",
                isAvailable: false,
              },
            ],
            "com.apple.CoreSimulator.SimRuntime.watchOS-26-5": [
              {
                udid: "WATCH-UDID",
                name: "Apple Watch",
                state: "Shutdown",
                isAvailable: true,
              },
            ],
          },
        }),
      ),
    ).toEqual([
      {
        udid: "BOOTED-UDID",
        name: "iPhone 17 Pro",
        runtime: "iOS 26.5",
        state: "Booted",
      },
    ]);
  });
});
