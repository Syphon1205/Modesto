// FILE: doubleOption.ts
// Purpose: Pure left+right Option (Alt) press detector used by Appshots.
// Layer: Desktop appshots (testable FSM mirrored by the Swift helper)
//
// Appshots fire when BOTH Option keys are held together. Electron
// globalShortcut cannot express that gesture, so the native helper owns the
// CGEventTap — this module is the shared state machine for unit tests and any
// future in-process simulation.

export type DoubleOptionKey = "leftOption" | "rightOption";

export interface DoubleOptionState {
  readonly leftDown: boolean;
  readonly rightDown: boolean;
  readonly firedWhileBothDown: boolean;
}

export const INITIAL_DOUBLE_OPTION_STATE: DoubleOptionState = {
  leftDown: false,
  rightDown: false,
  firedWhileBothDown: false,
};

export interface DoubleOptionTransition {
  readonly state: DoubleOptionState;
  /** True exactly once per both-Option press gesture. */
  readonly shouldCapture: boolean;
}

export function reduceDoubleOption(
  state: DoubleOptionState,
  key: DoubleOptionKey,
  isDown: boolean,
): DoubleOptionTransition {
  const next: DoubleOptionState = {
    leftDown: key === "leftOption" ? isDown : state.leftDown,
    rightDown: key === "rightOption" ? isDown : state.rightDown,
    firedWhileBothDown: state.firedWhileBothDown,
  };

  if (next.leftDown && next.rightDown) {
    if (next.firedWhileBothDown) {
      return { state: next, shouldCapture: false };
    }
    return {
      state: { ...next, firedWhileBothDown: true },
      shouldCapture: true,
    };
  }

  return {
    state: { ...next, firedWhileBothDown: false },
    shouldCapture: false,
  };
}

/**
 * Apply a full HID snapshot (both keys) the way the Swift helper does after a
 * flagsChanged event for either Option key.
 */
export function syncDoubleOptionFromSnapshot(
  state: DoubleOptionState,
  leftDown: boolean,
  rightDown: boolean,
): DoubleOptionTransition {
  if (leftDown && rightDown) {
    if (state.firedWhileBothDown) {
      return {
        state: { leftDown, rightDown, firedWhileBothDown: true },
        shouldCapture: false,
      };
    }
    return {
      state: { leftDown, rightDown, firedWhileBothDown: true },
      shouldCapture: true,
    };
  }
  return {
    state: { leftDown, rightDown, firedWhileBothDown: false },
    shouldCapture: false,
  };
}
