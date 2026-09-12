// FILE: useThinkingChime.ts
// Purpose: Plays a short chime once when the active thread's turn starts
//          running - "the model is thinking". Entirely separate from
//          useSpeakAssistantReplies: no text-to-speech, no read-aloud text,
//          just a synthesized tone. The seeding/transition decision itself
//          lives in the pure `decideThinkingChime` (thinkingChimeTrigger.ts);
//          this hook only owns the watermark ref and the effect.
// Layer: Chat hook

import { useEffect, useRef } from "react";

import { playThinkingChime } from "../lib/thinkingChime";
import {
  decideThinkingChime,
  INITIAL_THINKING_CHIME_WATERMARK,
  type ThinkingChimeWatermark,
} from "../lib/thinkingChimeTrigger";

export function useThinkingChime(options: {
  readonly enabled: boolean;
  readonly threadId: string | null;
  /** The active thread's currently-running turn id, or null when idle. */
  readonly runningTurnId: string | null;
}): void {
  const { enabled, threadId, runningTurnId } = options;
  const watermarkRef = useRef<ThinkingChimeWatermark>(INITIAL_THINKING_CHIME_WATERMARK);

  useEffect(() => {
    const { shouldChime, nextWatermark } = decideThinkingChime({
      enabled,
      threadId,
      runningTurnId,
      watermark: watermarkRef.current,
    });
    watermarkRef.current = nextWatermark;
    if (shouldChime) {
      playThinkingChime();
    }
  }, [enabled, runningTurnId, threadId]);
}
