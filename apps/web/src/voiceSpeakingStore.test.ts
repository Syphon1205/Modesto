import { describe, expect, it } from "vite-plus/test";

import {
  selectIsMessageSpeaking,
  selectIsThreadSpeaking,
  useVoiceSpeakingStore,
} from "./voiceSpeakingStore";

describe("voiceSpeakingStore", () => {
  it("tracks speaking thread/message and clears only the matching utterance", () => {
    useVoiceSpeakingStore.getState().reset();
    useVoiceSpeakingStore.getState().setSpeaking({ threadId: "t1", messageId: "m1" });

    const state = useVoiceSpeakingStore.getState();
    expect(selectIsThreadSpeaking(state, "t1")).toBe(true);
    expect(selectIsMessageSpeaking(state, "m1")).toBe(true);

    useVoiceSpeakingStore.getState().clearSpeaking("m-other");
    expect(useVoiceSpeakingStore.getState().speaking).toBe(true);

    useVoiceSpeakingStore.getState().clearSpeaking("m1");
    expect(useVoiceSpeakingStore.getState().speaking).toBe(false);
    expect(useVoiceSpeakingStore.getState().messageId).toBeNull();
  });
});
