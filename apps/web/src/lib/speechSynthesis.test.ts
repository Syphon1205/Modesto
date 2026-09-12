import { describe, expect, it } from "vite-plus/test";

import {
  findLatestFinalAssistantReply,
  hasUserTurnAfterMessage,
  isSpeechSynthesisSupported,
  prepareSpeechText,
  selectNaturalSpeechVoice,
  type SpeakableAssistantMessage,
} from "./speechSynthesis";

describe("prepareSpeechText", () => {
  it("strips fenced code and collapses whitespace", () => {
    const prepared = prepareSpeechText("Here is a fix:\n\n```ts\nconst x = 1;\n```\n\nDone.");
    expect(prepared).toBe("Here is a fix: Done.");
  });

  it("unwraps inline code, links, and emphasis", () => {
    const prepared = prepareSpeechText(
      "Call `speak()` then open [Settings](https://example.com) for **voice**.",
    );
    expect(prepared).toBe("Call speak() then open Settings for voice.");
  });

  it("drops list markers and heading hashes", () => {
    const prepared = prepareSpeechText("# Summary\n- one\n- two\n3. three");
    expect(prepared).toBe("Summary. one. two. three");
  });

  it("returns empty for whitespace-only or code-only input", () => {
    expect(prepareSpeechText("   \n\t  ")).toBe("");
    expect(prepareSpeechText("```\nonly code\n```")).toBe("");
  });
});

describe("selectNaturalSpeechVoice", () => {
  const voice = (
    name: string,
    lang = "en-US",
    options: Partial<SpeechSynthesisVoice> = {},
  ): SpeechSynthesisVoice =>
    ({
      name,
      lang,
      voiceURI: name,
      default: false,
      localService: true,
      ...options,
    }) as SpeechSynthesisVoice;

  it("prefers an installed premium voice over the browser default", () => {
    const selected = selectNaturalSpeechVoice(
      [voice("Samantha", "en-US", { default: true }), voice("Ava (Premium)")],
      "en-US",
    );
    expect(selected?.name).toBe("Ava (Premium)");
  });

  it("prefers modern conversational voices and rejects novelty voices", () => {
    const selected = selectNaturalSpeechVoice(
      [voice("Whisper", "en-US", { default: true }), voice("Flo (English (US))")],
      "en-US",
    );
    expect(selected?.name).toBe("Flo (English (US))");
  });

  it("stays within the requested language", () => {
    const selected = selectNaturalSpeechVoice(
      [voice("Ava (Premium)", "en-US"), voice("Daniel", "en-GB")],
      "en-GB",
    );
    expect(selected?.name).toBe("Daniel");
  });
});

describe("findLatestFinalAssistantReply", () => {
  const messages: SpeakableAssistantMessage[] = [
    { id: "u1", role: "user", text: "hi", streaming: false },
    { id: "a1", role: "assistant", text: "hello", streaming: false },
    { id: "u2", role: "user", text: "again", streaming: false },
    { id: "a2", role: "assistant", text: "streaming…", streaming: true },
  ];

  it("skips streaming assistants and picks the latest final one", () => {
    expect(findLatestFinalAssistantReply(messages)?.id).toBe("a1");
  });

  it("returns null when only streaming or empty assistants remain", () => {
    expect(
      findLatestFinalAssistantReply([
        { id: "a", role: "assistant", text: "```\nx\n```", streaming: false },
      ]),
    ).toBeNull();
    expect(
      findLatestFinalAssistantReply([{ id: "a", role: "assistant", text: "hi", streaming: true }]),
    ).toBeNull();
  });
});

describe("hasUserTurnAfterMessage", () => {
  it("detects a user message after the spoken assistant reply", () => {
    const messages: SpeakableAssistantMessage[] = [
      { id: "a1", role: "assistant", text: "done", streaming: false },
      { id: "u2", role: "user", text: "next", streaming: false },
    ];
    expect(hasUserTurnAfterMessage(messages, "a1")).toBe(true);
    expect(hasUserTurnAfterMessage(messages, "u2")).toBe(false);
  });
});

describe("isSpeechSynthesisSupported", () => {
  it("is false when the host lacks the API", () => {
    expect(isSpeechSynthesisSupported({} as typeof globalThis)).toBe(false);
  });
});
