import { describe, expect, it } from "vite-plus/test";
import { notificationSoundTransition, type SoundThreadState } from "./notificationSoundTransitions";
const running: SoundThreadState = {
  key: "env:thread",
  turnId: "turn-1",
  state: "running",
  attention: false,
};
describe("notification sound transitions", () => {
  it("never plays historical or replayed completion, error or approval snapshots", () => {
    for (const state of ["completed", "error", "interrupted", "running"]) {
      const snapshot = { ...running, state, attention: true };
      expect(notificationSoundTransition(undefined, snapshot)).toBeNull();
      expect(notificationSoundTransition(snapshot, snapshot)).toBeNull();
    }
  });
  it("plays once when the same running turn completes, fails, or is interrupted", () => {
    expect(notificationSoundTransition(running, { ...running, state: "completed" })).toBe(
      "completion",
    );
    expect(notificationSoundTransition(running, { ...running, state: "error" })).toBe("error");
    expect(notificationSoundTransition(running, { ...running, state: "interrupted" })).toBe(
      "interruption",
    );
    expect(
      notificationSoundTransition(running, { ...running, state: "completed", turnId: "another" }),
    ).toBeNull();
  });
  it("plays when a new turn starts without repeating for running snapshots", () => {
    expect(notificationSoundTransition({ ...running, turnId: null, state: null }, running)).toBe(
      "started",
    );
    expect(
      notificationSoundTransition(
        { ...running, state: "completed" },
        { ...running, turnId: "turn-2" },
      ),
    ).toBe("started");
    expect(notificationSoundTransition(running, running)).toBeNull();
  });
  it("alerts for newly requested input and suppresses completion while attention is needed", () => {
    const attention = { ...running, attention: true };
    expect(notificationSoundTransition(running, attention)).toBe("attention");
    expect(notificationSoundTransition(attention, { ...attention, state: "completed" })).toBeNull();
    expect(notificationSoundTransition(attention, running)).toBeNull();
  });
});
