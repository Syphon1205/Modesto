// FILE: useSpeakAssistantReplies.ts
// Purpose: When voice.speakReplies is on, read each final assistant reply
//          aloud via system speechSynthesis and publish speaking state.
// Layer: Chat hook
//
// Dictation (SpeechRecognition on the composer mic) is intentionally separate —
// this hook never speaks user/dictation text.
//
// Speaking state is published to `voiceSpeakingStore` (message + thread). Ambient
// bubbles and the assistant timeline consume that store for the waveform.

import { useEffect, useRef } from "react";

import {
  createSpeechSynthesisController,
  findLatestFinalAssistantReply,
  hasUserTurnAfterMessage,
  type SpeakableAssistantMessage,
  type SpeechSynthesisController,
} from "../lib/speechSynthesis";
import { useVoiceSpeakingStore } from "../voiceSpeakingStore";

export function useSpeakAssistantReplies(options: {
  readonly enabled: boolean;
  readonly threadId: string | null;
  readonly messages: ReadonlyArray<SpeakableAssistantMessage>;
}): void {
  const { enabled, threadId, messages } = options;
  const controllerRef = useRef<SpeechSynthesisController | null>(null);
  const seededThreadIdRef = useRef<string | null>(null);
  const pendingSeedRef = useRef(false);
  const spokenMessageIdRef = useRef<string | null>(null);
  const setSpeaking = useVoiceSpeakingStore((state) => state.setSpeaking);
  const clearSpeaking = useVoiceSpeakingStore((state) => state.clearSpeaking);
  const resetSpeaking = useVoiceSpeakingStore((state) => state.reset);

  useEffect(() => {
    if (controllerRef.current === null) {
      controllerRef.current = createSpeechSynthesisController();
    }
    return () => {
      controllerRef.current?.cancel();
      controllerRef.current = null;
      resetSpeaking();
    };
  }, [resetSpeaking]);

  useEffect(() => {
    const controller = controllerRef.current;

    const stop = (messageId?: string) => {
      controller?.cancel();
      clearSpeaking(messageId);
    };

    if (!threadId) {
      seededThreadIdRef.current = null;
      pendingSeedRef.current = false;
      spokenMessageIdRef.current = null;
      stop();
      return;
    }

    // On thread switch, wait until the first non-empty transcript snapshot so
    // we do not speak historical replies that hydrate in a later tick.
    if (seededThreadIdRef.current !== threadId) {
      seededThreadIdRef.current = threadId;
      pendingSeedRef.current = true;
      spokenMessageIdRef.current = null;
      stop();
    }

    if (pendingSeedRef.current) {
      if (messages.length === 0) {
        return;
      }
      spokenMessageIdRef.current = findLatestFinalAssistantReply(messages)?.id ?? null;
      pendingSeedRef.current = false;
      return;
    }

    // Keep the watermark current while TTS is off so enabling later does not
    // read aloud replies that finished while the setting was disabled.
    if (!enabled || !controller) {
      const latestWhileDisabled = findLatestFinalAssistantReply(messages);
      if (latestWhileDisabled) {
        spokenMessageIdRef.current = latestWhileDisabled.id;
      }
      stop();
      return;
    }

    const spokenId = spokenMessageIdRef.current;
    if (spokenId && hasUserTurnAfterMessage(messages, spokenId) && controller.isSpeaking()) {
      stop(spokenId);
    }

    const latest = findLatestFinalAssistantReply(messages);
    if (!latest || latest.id === spokenMessageIdRef.current) {
      return;
    }

    spokenMessageIdRef.current = latest.id;
    const started = controller.speak(latest.text, {
      onStart: () => setSpeaking({ threadId, messageId: latest.id }),
      onEnd: () => clearSpeaking(latest.id),
      onError: () => clearSpeaking(latest.id),
    });
    if (!started) {
      clearSpeaking(latest.id);
    }
  }, [clearSpeaking, enabled, messages, setSpeaking, threadId]);
}
