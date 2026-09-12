// FILE: thinkingChimeTrigger.ts
// Purpose: The pure decision behind useThinkingChime - given the previous
//          watermark state and the current thread/turn, should the chime
//          fire right now, and what does the watermark become? Kept separate
//          from the hook (which only owns the refs and the effect) so the
//          seeding logic - the part most likely to get subtly wrong - is
//          unit-testable without mounting anything.
// Layer: Chat audio primitive (pure)

export interface ThinkingChimeWatermark {
  readonly seededThreadId: string | null;
  readonly lastRunningTurnId: string | null;
}

export interface ThinkingChimeDecision {
  readonly shouldChime: boolean;
  readonly nextWatermark: ThinkingChimeWatermark;
}

export const INITIAL_THINKING_CHIME_WATERMARK: ThinkingChimeWatermark = {
  seededThreadId: null,
  lastRunningTurnId: null,
};

/**
 * Decide whether a turn just started thinking on the thread being watched.
 *
 * Three cases, in order:
 *  1. No active thread - reset the watermark, never chime.
 *  2. A different thread than last seen - seed to whatever is already
 *     running there without chiming. Arriving on a thread that is already
 *     mid-turn is not "a turn just started"; it mirrors the same distinction
 *     useSpeakAssistantReplies draws for historical replies that hydrate on
 *     switch.
 *  3. Same thread - chime only when a *new*, non-null turn id appears while
 *     enabled. The watermark still advances when disabled, so turning the
 *     setting on later does not chime for a turn that already started while
 *     it was off.
 */
export function decideThinkingChime(input: {
  readonly enabled: boolean;
  readonly threadId: string | null;
  readonly runningTurnId: string | null;
  readonly watermark: ThinkingChimeWatermark;
}): ThinkingChimeDecision {
  const { enabled, threadId, runningTurnId, watermark } = input;

  if (!threadId) {
    return { shouldChime: false, nextWatermark: INITIAL_THINKING_CHIME_WATERMARK };
  }

  if (watermark.seededThreadId !== threadId) {
    return {
      shouldChime: false,
      nextWatermark: { seededThreadId: threadId, lastRunningTurnId: runningTurnId },
    };
  }

  const shouldChime =
    enabled && runningTurnId !== null && runningTurnId !== watermark.lastRunningTurnId;

  return {
    shouldChime,
    nextWatermark: { seededThreadId: threadId, lastRunningTurnId: runningTurnId },
  };
}
