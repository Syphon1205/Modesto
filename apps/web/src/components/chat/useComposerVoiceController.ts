// FILE: useComposerVoiceController.ts
// Purpose: Owns the composer dictation lifecycle - start/stop the system
//          speech recognizer and insert the transcript into the prompt.
// Layer: Chat composer hook
//
// Uses the browser SpeechRecognition API (webkitSpeechRecognition in
// Chromium), which is the OS/browser speech service rather than a local
// Whisper model. Final text is inserted once dictation stops.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  collectSpeechTranscript,
  describeSpeechRecognitionError,
  describeSpeechRecognitionErrorName,
  getSpeechRecognitionConstructor,
  type SpeechRecognitionLike,
} from "../../lib/speechRecognition";
import { formatVoiceRecordingDuration } from "../../lib/voiceDuration";
import { toastManager } from "../ui/toast";

export interface ComposerVoiceController {
  readonly isRecording: boolean;
  readonly durationLabel: string;
  /** Starts dictation, or stops it and inserts the transcript. */
  readonly toggle: () => void;
}

function joinedTranscript(committed: string, session: string): string {
  return [committed, session].filter((part) => part.length > 0).join(" ");
}

export function useComposerVoiceController(options: {
  readonly onTranscript: (transcript: string) => void;
}): ComposerVoiceController {
  const { onTranscript } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stopRequestedRef = useRef(false);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const committedRef = useRef("");
  const sessionFinalRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishSession = useCallback(
    (transcript: string) => {
      clearTimer();
      recognitionRef.current = null;
      stopRequestedRef.current = false;
      committedRef.current = "";
      sessionFinalRef.current = "";
      startedAtRef.current = 0;
      setDurationMs(0);
      setIsRecording(false);
      const trimmed = transcript.trim();
      if (trimmed.length > 0) {
        onTranscriptRef.current(trimmed);
      }
    },
    [clearTimer],
  );

  const beginTimer = useCallback(() => {
    clearTimer();
    startedAtRef.current = performance.now();
    setDurationMs(0);
    timerRef.current = window.setInterval(() => {
      setDurationMs(Math.max(0, performance.now() - startedAtRef.current));
    }, 200);
  }, [clearTimer]);

  const stopDictation = useCallback(() => {
    const recognition = recognitionRef.current;
    const transcript = joinedTranscript(committedRef.current, sessionFinalRef.current);
    if (!recognition) {
      finishSession(transcript);
      return;
    }
    stopRequestedRef.current = true;
    try {
      recognition.stop();
    } catch {
      finishSession(transcript);
    }
  }, [finishSession]);

  const startDictation = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      toastManager.add({
        title:
          "Speech dictation is not available in this browser. Use Chrome, Edge, Safari, or the desktop app.",
        type: "error",
      });
      return;
    }

    stopRequestedRef.current = false;
    committedRef.current = "";
    sessionFinalRef.current = "";
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      sessionFinalRef.current = collectSpeechTranscript(event.results).finalText;
    };

    recognition.onerror = (event) => {
      const message = describeSpeechRecognitionErrorName(event.error);
      if (event.error === "no-speech") {
        return;
      }
      if (message.length === 0) {
        return;
      }
      stopRequestedRef.current = true;
      toastManager.add({ title: message, type: "error" });
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) {
        return;
      }
      committedRef.current = joinedTranscript(committedRef.current, sessionFinalRef.current);
      sessionFinalRef.current = "";
      // Chromium ends a "continuous" session after a pause. Keep listening
      // until the user clicks stop so this feels like system dictation.
      if (!stopRequestedRef.current) {
        try {
          recognition.start();
          return;
        } catch (error) {
          toastManager.add({
            title: describeSpeechRecognitionError(error),
            type: "error",
          });
        }
      }
      finishSession(committedRef.current);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      beginTimer();
      setIsRecording(true);
    } catch (error) {
      recognitionRef.current = null;
      toastManager.add({ title: describeSpeechRecognitionError(error), type: "error" });
    }
  }, [beginTimer, finishSession]);

  const toggle = useCallback(() => {
    if (isRecording) {
      stopDictation();
      return;
    }
    startDictation();
  }, [isRecording, startDictation, stopDictation]);

  useEffect(
    () => () => {
      stopRequestedRef.current = true;
      clearTimer();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition?.abort();
      } catch {
        // Already stopped.
      }
    },
    [clearTimer],
  );

  return {
    isRecording,
    durationLabel: formatVoiceRecordingDuration(durationMs),
    toggle,
  };
}
