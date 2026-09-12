import { describe, expect, it } from "vite-plus/test";

import {
  decideThinkingChime,
  INITIAL_THINKING_CHIME_WATERMARK,
  type ThinkingChimeWatermark,
} from "./thinkingChimeTrigger";

describe("decideThinkingChime", () => {
  it("never chimes with no active thread, and resets the watermark", () => {
    const decision = decideThinkingChime({
      enabled: true,
      threadId: null,
      runningTurnId: "turn-1",
      watermark: { seededThreadId: "thread-a", lastRunningTurnId: "turn-0" },
    });
    expect(decision.shouldChime).toBe(false);
    expect(decision.nextWatermark).toEqual(INITIAL_THINKING_CHIME_WATERMARK);
  });

  it("does not chime for a turn already running when arriving on a new thread", () => {
    // Walking into a thread that is already mid-turn is not "a turn just
    // started" - it just seeds the watermark to what is already there.
    const decision = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: "turn-1",
      watermark: INITIAL_THINKING_CHIME_WATERMARK,
    });
    expect(decision.shouldChime).toBe(false);
    expect(decision.nextWatermark).toEqual({
      seededThreadId: "thread-a",
      lastRunningTurnId: "turn-1",
    });
  });

  it("does not chime when arriving on an idle thread", () => {
    const decision = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: null,
      watermark: INITIAL_THINKING_CHIME_WATERMARK,
    });
    expect(decision.shouldChime).toBe(false);
    expect(decision.nextWatermark).toEqual({
      seededThreadId: "thread-a",
      lastRunningTurnId: null,
    });
  });

  it("chimes when a new turn starts on the seeded thread", () => {
    const seeded: ThinkingChimeWatermark = { seededThreadId: "thread-a", lastRunningTurnId: null };
    const decision = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: "turn-1",
      watermark: seeded,
    });
    expect(decision.shouldChime).toBe(true);
    expect(decision.nextWatermark).toEqual({
      seededThreadId: "thread-a",
      lastRunningTurnId: "turn-1",
    });
  });

  it("does not chime again while the same turn keeps running", () => {
    const midTurn: ThinkingChimeWatermark = {
      seededThreadId: "thread-a",
      lastRunningTurnId: "turn-1",
    };
    const decision = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: "turn-1",
      watermark: midTurn,
    });
    expect(decision.shouldChime).toBe(false);
  });

  it("chimes again for a second, later turn on the same thread", () => {
    const afterFirstTurn: ThinkingChimeWatermark = {
      seededThreadId: "thread-a",
      lastRunningTurnId: null,
    };
    const decision = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: "turn-2",
      watermark: afterFirstTurn,
    });
    expect(decision.shouldChime).toBe(true);
  });

  it("stays silent while disabled but keeps the watermark current", () => {
    const seeded: ThinkingChimeWatermark = { seededThreadId: "thread-a", lastRunningTurnId: null };
    const decision = decideThinkingChime({
      enabled: false,
      threadId: "thread-a",
      runningTurnId: "turn-1",
      watermark: seeded,
    });
    // Silent now...
    expect(decision.shouldChime).toBe(false);
    // ...but the watermark still moved past turn-1, so enabling the setting
    // later does not retroactively chime for a turn that already started.
    expect(decision.nextWatermark.lastRunningTurnId).toBe("turn-1");

    const afterEnabling = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: "turn-1",
      watermark: decision.nextWatermark,
    });
    expect(afterEnabling.shouldChime).toBe(false);
  });

  it("does not chime again when switching back to a thread whose turn is still running", () => {
    // Leave thread-a mid-turn, visit thread-b, come back - the turn on
    // thread-a never stopped, so returning to it must not chime a second
    // time for the same turn.
    const leftMidTurn = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: "turn-1",
      watermark: { seededThreadId: "thread-a", lastRunningTurnId: null },
    });
    expect(leftMidTurn.shouldChime).toBe(true);

    const onThreadB = decideThinkingChime({
      enabled: true,
      threadId: "thread-b",
      runningTurnId: null,
      watermark: leftMidTurn.nextWatermark,
    });
    expect(onThreadB.shouldChime).toBe(false);

    const backOnA = decideThinkingChime({
      enabled: true,
      threadId: "thread-a",
      runningTurnId: "turn-1",
      watermark: onThreadB.nextWatermark,
    });
    expect(backOnA.shouldChime).toBe(false);
  });
});
