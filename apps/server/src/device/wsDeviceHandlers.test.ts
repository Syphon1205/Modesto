import {
  DEVICE_WS_METHODS,
  ThreadDeviceState,
  ThreadId,
  type DeviceDescriptor,
} from "@modesto/contracts";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";

import type { DeviceManager } from "./DeviceManager.ts";
import { makeWsDeviceHandlers } from "./wsDeviceHandlers.ts";

function iphone(name: string, udid: string): DeviceDescriptor {
  return {
    platform: "ios-simulator",
    udid,
    name,
    runtime: "iOS 27.0",
    state: "shutdown",
    bootSource: "user",
    family: "phone",
  };
}

describe("makeWsDeviceHandlers getThreadState", () => {
  it("brands the snapshot thread id without throwing", async () => {
    const handlers = makeWsDeviceHandlers({
      supported: true,
      manager: {
        getThreadState: async (threadId: string) => ({
          threadId,
          version: 0,
          attachedDeviceUdid: null,
          devices: [iphone("iPhone 17 Pro", "8D819C5C-F423-4061-9431-97A62AF58EAB")],
          agentActive: false,
          availability: {
            kind: "setup-required",
            steps: [
              { id: "install-xcode", label: "Xcode installed", done: true, detail: "Version 26.6" },
              { id: "build-device-helper", label: "Build the Modesto device helper", done: false },
              {
                id: "install-android-sdk",
                label: "Install the Android SDK command-line tools",
                done: false,
              },
            ],
          },
          lastError: null,
          attachPhase: null,
        }),
      } as unknown as DeviceManager,
    });

    const state = await Effect.runPromise(
      handlers[DEVICE_WS_METHODS.getThreadState]({ threadId: ThreadId.make("thread-1") }),
    );
    expect(state.threadId).toBe("thread-1");
    expect(state.devices.map((device) => device.name)).toEqual(["iPhone 17 Pro"]);
    expect(Schema.encodeUnknownExit(ThreadDeviceState)(state)._tag).toBe("Success");
  });

  it("encodes a listing larger than the old 64-device cap", async () => {
    const devices = Array.from({ length: 80 }, (_, index) =>
      iphone(`iPhone ${index + 1}`, `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`),
    );
    const handlers = makeWsDeviceHandlers({
      supported: true,
      manager: {
        getThreadState: async (threadId: string) => ({
          threadId,
          version: 0,
          attachedDeviceUdid: null,
          devices,
          agentActive: false,
          availability: { kind: "available" },
          lastError: null,
          attachPhase: null,
        }),
      } as unknown as DeviceManager,
    });

    const state = await Effect.runPromise(
      handlers[DEVICE_WS_METHODS.getThreadState]({ threadId: ThreadId.make("thread-1") }),
    );
    expect(state.devices).toHaveLength(80);
    expect(Schema.encodeUnknownExit(ThreadDeviceState)(state)._tag).toBe("Success");
  });
});
