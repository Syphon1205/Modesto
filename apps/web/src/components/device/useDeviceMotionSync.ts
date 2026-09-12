// FILE: useDeviceMotionSync.ts
// Purpose: Forward free-look rotation to a guest's virtual accelerometer.
// Layer: Device pane runtime hook
// Exports: useDeviceMotionSync, UPRIGHT_GRAVITY
// Depends on: the device RPC command surface.
//
// Turning the device in free look is only a change of viewpoint unless the
// guest hears about it. Android emulators expose virtual sensors, so this hook
// keeps the emulator's accelerometer pointing wherever the on-screen body is
// pointing, and an app with parallax, a gyro background, or any other
// motion-driven depth effect reacts as it would in a hand.
//
// iOS has no counterpart: the simulator provides no CoreMotion and `simctl`
// exposes no sensor surface, so `supportsMotion` is false there and this hook
// stays idle rather than sending calls the backend would refuse.
//
// Rate-limited on the way out. A drag produces a vector per animation frame,
// and each one costs an `adb` process spawn on the far side; at video rate that
// is a backlog that keeps moving the guest after the user has let go. Sending
// the newest vector on a fixed tick — never a queue of stale ones — is what
// keeps the guest tracking the hand.

import { useCallback, useEffect, useRef } from "react";

export type DeviceGravity = { readonly x: number; readonly y: number; readonly z: number };

/** Portrait, held upright. Where a device rests when free look is disengaged. */
export const UPRIGHT_GRAVITY: DeviceGravity = { x: 0, y: 9.80665, z: 0 };

/**
 * 20Hz. Fast enough that the guest's own motion smoothing hides the steps,
 * slow enough that a process spawn per update stays comfortably ahead of the
 * next one.
 */
const SEND_INTERVAL_MS = 50;

/** Skip sends below this change, in m/s². Roughly a third of a degree of tilt. */
const MIN_DELTA_MS2 = 0.05;

export function useDeviceMotionSync(input: {
  /** False when free look is off, the device is detached, or the runtime has no sensors. */
  readonly enabled: boolean;
  readonly send: (gravity: DeviceGravity) => void;
}): { readonly push: (gravity: DeviceGravity) => void } {
  const sendRef = useRef(input.send);
  sendRef.current = input.send;

  const pending = useRef<DeviceGravity | null>(null);
  const lastSent = useRef<DeviceGravity | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const enabled = input.enabled;

  useEffect(() => {
    if (!enabled) return;
    timer.current = setInterval(() => {
      const next = pending.current;
      pending.current = null;
      if (!next) return;
      const previous = lastSent.current;
      if (
        previous &&
        Math.abs(next.x - previous.x) < MIN_DELTA_MS2 &&
        Math.abs(next.y - previous.y) < MIN_DELTA_MS2 &&
        Math.abs(next.z - previous.z) < MIN_DELTA_MS2
      ) {
        return;
      }
      lastSent.current = next;
      sendRef.current(next);
    }, SEND_INTERVAL_MS);

    return () => {
      if (timer.current !== null) clearInterval(timer.current);
      timer.current = null;
      pending.current = null;
      // Stand the guest back up. An emulator keeps whatever vector it was last
      // given, so leaving free look without this would strand the device tilted
      // for every later session on that AVD.
      if (lastSent.current) {
        lastSent.current = null;
        sendRef.current(UPRIGHT_GRAVITY);
      }
    };
  }, [enabled]);

  const push = useCallback((gravity: DeviceGravity) => {
    pending.current = gravity;
  }, []);

  return { push };
}
