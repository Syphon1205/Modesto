import { describe, expect, it } from "vitest";

import {
  INITIAL_DOUBLE_OPTION_STATE,
  reduceDoubleOption,
  syncDoubleOptionFromSnapshot,
} from "./doubleOption.ts";

describe("reduceDoubleOption", () => {
  it("fires once when both Option keys become down", () => {
    const left = reduceDoubleOption(INITIAL_DOUBLE_OPTION_STATE, "leftOption", true);
    expect(left.shouldCapture).toBe(false);
    const both = reduceDoubleOption(left.state, "rightOption", true);
    expect(both.shouldCapture).toBe(true);
    expect(both.state.firedWhileBothDown).toBe(true);
  });

  it("does not re-fire while both keys stay down", () => {
    let state = INITIAL_DOUBLE_OPTION_STATE;
    state = reduceDoubleOption(state, "leftOption", true).state;
    const first = reduceDoubleOption(state, "rightOption", true);
    expect(first.shouldCapture).toBe(true);
    const second = reduceDoubleOption(first.state, "leftOption", true);
    expect(second.shouldCapture).toBe(false);
  });

  it("allows another capture after a full release", () => {
    let transition = reduceDoubleOption(INITIAL_DOUBLE_OPTION_STATE, "leftOption", true);
    transition = reduceDoubleOption(transition.state, "rightOption", true);
    expect(transition.shouldCapture).toBe(true);
    transition = reduceDoubleOption(transition.state, "leftOption", false);
    transition = reduceDoubleOption(transition.state, "rightOption", false);
    expect(transition.state.firedWhileBothDown).toBe(false);
    transition = reduceDoubleOption(transition.state, "leftOption", true);
    transition = reduceDoubleOption(transition.state, "rightOption", true);
    expect(transition.shouldCapture).toBe(true);
  });
});

describe("syncDoubleOptionFromSnapshot", () => {
  it("fires when both keys are reported down", () => {
    const first = syncDoubleOptionFromSnapshot(INITIAL_DOUBLE_OPTION_STATE, true, true);
    expect(first.shouldCapture).toBe(true);
    const second = syncDoubleOptionFromSnapshot(first.state, true, true);
    expect(second.shouldCapture).toBe(false);
  });

  it("clears the fired latch when either key lifts", () => {
    const both = syncDoubleOptionFromSnapshot(INITIAL_DOUBLE_OPTION_STATE, true, true);
    const released = syncDoubleOptionFromSnapshot(both.state, true, false);
    expect(released.state.firedWhileBothDown).toBe(false);
    const again = syncDoubleOptionFromSnapshot(released.state, true, true);
    expect(again.shouldCapture).toBe(true);
  });
});
