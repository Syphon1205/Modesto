// FILE: voiceSpeakingStore.ts
// Purpose: Tiny shared speaking state so TTS and ambient bubbles stay in sync
//          without prop-drilling through ChatView.
// Layer: Client store
// Exports: useVoiceSpeakingStore, selectIsThreadSpeaking

import { create } from "zustand";

export interface VoiceSpeakingState {
  readonly speaking: boolean;
  readonly threadId: string | null;
  readonly messageId: string | null;
  readonly setSpeaking: (next: { readonly threadId: string; readonly messageId: string }) => void;
  readonly clearSpeaking: (messageId?: string) => void;
  readonly reset: () => void;
}

export const useVoiceSpeakingStore = create<VoiceSpeakingState>()((set, get) => ({
  speaking: false,
  threadId: null,
  messageId: null,
  setSpeaking: ({ threadId, messageId }) =>
    set({
      speaking: true,
      threadId,
      messageId,
    }),
  clearSpeaking: (messageId) => {
    const current = get();
    if (!current.speaking) return;
    if (messageId !== undefined && current.messageId !== messageId) return;
    set({ speaking: false, threadId: null, messageId: null });
  },
  reset: () => set({ speaking: false, threadId: null, messageId: null }),
}));

export function selectIsThreadSpeaking(
  state: Pick<VoiceSpeakingState, "speaking" | "threadId">,
  threadId: string | null | undefined,
): boolean {
  return Boolean(state.speaking && threadId && state.threadId === threadId);
}

export function selectIsMessageSpeaking(
  state: Pick<VoiceSpeakingState, "speaking" | "messageId">,
  messageId: string | null | undefined,
): boolean {
  return Boolean(state.speaking && messageId && state.messageId === messageId);
}
