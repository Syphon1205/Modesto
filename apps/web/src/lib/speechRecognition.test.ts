import { describe, expect, it } from "vite-plus/test";

import {
  collectSpeechTranscript,
  describeSpeechRecognitionError,
  describeSpeechRecognitionErrorName,
  getSpeechRecognitionConstructor,
  type SpeechRecognitionResultListLike,
} from "./speechRecognition";

function resultsOf(
  entries: ReadonlyArray<{ isFinal: boolean; transcript: string }>,
): SpeechRecognitionResultListLike {
  return {
    length: entries.length,
    item: (index) => {
      const entry = entries[index];
      if (!entry) return undefined as never;
      return {
        isFinal: entry.isFinal,
        length: 1,
        0: { transcript: entry.transcript },
        item: () => ({ transcript: entry.transcript }),
      };
    },
  };
}

describe("collectSpeechTranscript", () => {
  it("joins final pieces and appends the latest interim", () => {
    const collected = collectSpeechTranscript(
      resultsOf([
        { isFinal: true, transcript: "open " },
        { isFinal: true, transcript: " settings" },
        { isFinal: false, transcript: " panel" },
      ]),
    );
    expect(collected.finalText).toBe("open settings");
    expect(collected.previewText).toBe("open settings panel");
  });

  it("ignores empty alternatives", () => {
    const collected = collectSpeechTranscript(
      resultsOf([
        { isFinal: true, transcript: "  " },
        { isFinal: false, transcript: "" },
      ]),
    );
    expect(collected.finalText).toBe("");
    expect(collected.previewText).toBe("");
  });
});

describe("describeSpeechRecognitionError", () => {
  it("maps permission denials to an actionable message", () => {
    expect(describeSpeechRecognitionErrorName("not-allowed")).toMatch(
      /Microphone access was denied/,
    );
    expect(
      describeSpeechRecognitionError(
        Object.assign(new Error("denied"), { name: "NotAllowedError" }),
      ),
    ).toMatch(/Microphone access was denied/);
  });

  it("swallows aborted so a stop click is not an error", () => {
    expect(describeSpeechRecognitionErrorName("aborted")).toBe("");
  });

  it("returns the constructor when the browser exposes one", () => {
    const host = globalThis as typeof globalThis & { SpeechRecognition?: new () => unknown };
    const previous = host.SpeechRecognition;
    class FakeRecognition {}
    host.SpeechRecognition = FakeRecognition;
    try {
      expect(getSpeechRecognitionConstructor()).toBe(FakeRecognition);
    } finally {
      if (previous === undefined) {
        delete host.SpeechRecognition;
      } else {
        host.SpeechRecognition = previous;
      }
    }
  });
});
