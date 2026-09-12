import { DEVICE_WS_METHODS } from "@modesto/contracts";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createAtomCommandScheduler,
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";

export function createDeviceEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  const lifecycleScheduler = createAtomCommandScheduler();
  const inputScheduler = createAtomCommandScheduler();
  // Motion gets its own lane. A free-look drag emits a vector per frame, and
  // sharing the input scheduler would let that stream sit in front of the tap
  // the user is trying to land.
  const motionScheduler = createAtomCommandScheduler();

  return {
    state: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:device:state",
      tag: DEVICE_WS_METHODS.getThreadState,
      staleTimeMs: 1_000,
    }),
    list: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:device:list",
      tag: DEVICE_WS_METHODS.list,
      staleTimeMs: 2_000,
    }),
    events: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:device:events",
      tag: DEVICE_WS_METHODS.subscribeEvents,
      idleTtlMs: 0,
    }),
    boot: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:boot",
      tag: DEVICE_WS_METHODS.boot,
      scheduler: lifecycleScheduler,
    }),
    shutdown: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:shutdown",
      tag: DEVICE_WS_METHODS.shutdown,
      scheduler: lifecycleScheduler,
    }),
    attach: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:attach",
      tag: DEVICE_WS_METHODS.attach,
      scheduler: lifecycleScheduler,
    }),
    detach: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:detach",
      tag: DEVICE_WS_METHODS.detach,
      scheduler: lifecycleScheduler,
    }),
    tap: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:tap",
      tag: DEVICE_WS_METHODS.tap,
      scheduler: inputScheduler,
    }),
    swipe: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:swipe",
      tag: DEVICE_WS_METHODS.swipe,
      scheduler: inputScheduler,
    }),
    typeText: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:type",
      tag: DEVICE_WS_METHODS.typeText,
      scheduler: inputScheduler,
    }),
    keyEvent: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:key",
      tag: DEVICE_WS_METHODS.keyEvent,
      scheduler: inputScheduler,
    }),
    pressButton: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:button",
      tag: DEVICE_WS_METHODS.pressButton,
      scheduler: inputScheduler,
    }),
    setGravity: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:gravity",
      tag: DEVICE_WS_METHODS.setGravity,
      scheduler: motionScheduler,
    }),
    screenshot: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:screenshot",
      tag: DEVICE_WS_METHODS.screenshot,
      scheduler: lifecycleScheduler,
    }),
    startRecording: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:recording-start",
      tag: DEVICE_WS_METHODS.startRecording,
      scheduler: lifecycleScheduler,
    }),
    stopRecording: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:device:recording-stop",
      tag: DEVICE_WS_METHODS.stopRecording,
      scheduler: lifecycleScheduler,
    }),
  };
}
