import { describe, expect, it } from "@effect/vitest";

import {
  initialCodexScanState,
  initialGeminiScanState,
  initialPoolsideScanState,
  parseClaudeLine,
  parseCodexLine,
  parseGeminiLine,
  parseGithubCopilotUsageRow,
  parseOpenCodeMessageRow,
  parsePiLine,
  parsePoolsideLine,
  totalTokens,
} from "./usageTranscripts.ts";

/** Shaped after a real Claude Code assistant record. */
function claudeLine(overrides: {
  messageId: string;
  contentType: string;
  model?: string;
  outputTokens?: number;
}): string {
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-08-07T04:05:13.944Z",
    sessionId: "5a128faa-8253-489e-b935-6c08e8e670c0",
    cwd: "/home/theo/project",
    message: {
      id: overrides.messageId,
      role: "assistant",
      model: overrides.model ?? "claude-fable-5",
      content: [{ type: overrides.contentType }],
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: 66818,
        cache_read_input_tokens: 1000,
        output_tokens: overrides.outputTokens ?? 286,
      },
    },
  });
}

describe("parseClaudeLine", () => {
  it("extracts token totals and a dedupe key", () => {
    const record = parseClaudeLine(claudeLine({ messageId: "msg_1", contentType: "text" }));

    expect(record).not.toBeNull();
    expect(record?.provider).toBe("claude");
    expect(record?.model).toBe("claude-fable-5");
    expect(record?.totals).toEqual({
      uncachedInputTokens: 2,
      cachedInputTokens: 1000,
      cacheCreationTokens: 66818,
      outputTokens: 286,
      reasoningTokens: 0,
    });
    expect(record?.dedupeKey).toBe("msg_1:");
  });

  it("gives every content block of one message the same dedupe key", () => {
    // Modesto writes one record per content block, each repeating the parent
    // message's full usage. Summing them would overcount ~2.4x on real data.
    const text = parseClaudeLine(claudeLine({ messageId: "msg_2", contentType: "text" }));
    const toolUse = parseClaudeLine(claudeLine({ messageId: "msg_2", contentType: "tool_use" }));

    expect(text?.dedupeKey).toBe(toolUse?.dedupeKey);
    expect(text?.totals).toEqual(toolUse?.totals);
  });

  it("ignores records that are not assistant messages", () => {
    expect(parseClaudeLine(JSON.stringify({ type: "user", message: {} }))).toBeNull();
    expect(parseClaudeLine("not json")).toBeNull();
  });
});

describe("parseCodexLine", () => {
  const sessionMeta = JSON.stringify({
    type: "session_meta",
    timestamp: "2026-08-01T05:17:41.289Z",
    payload: { type: "session_meta", id: "019fbbc1-b12c-7360-a685-28c181f0025f" },
  });
  const turnContext = JSON.stringify({
    type: "turn_context",
    timestamp: "2026-08-01T05:17:42.694Z",
    payload: { type: "turn_context", model: "gpt-5.6-sol" },
  });
  const tokenCount = (inputTokens: number, cached: number, output: number, reasoning: number) =>
    JSON.stringify({
      type: "event_msg",
      timestamp: "2026-08-01T05:17:49.919Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: inputTokens,
            cached_input_tokens: cached,
            cache_write_input_tokens: 0,
            output_tokens: output,
            reasoning_output_tokens: reasoning,
          },
        },
      },
    });

  it("attributes usage to the model from the preceding turn context", () => {
    const state = initialCodexScanState();
    parseCodexLine(sessionMeta, state);
    parseCodexLine(turnContext, state);
    const record = parseCodexLine(tokenCount(19239, 11008, 299, 116), state);

    expect(record?.provider).toBe("codex");
    expect(record?.model).toBe("gpt-5.6-sol");
    expect(record?.sessionId).toBe("019fbbc1-b12c-7360-a685-28c181f0025f");
    // Codex reports input_tokens inclusive of the cached portion.
    expect(record?.totals.uncachedInputTokens).toBe(19239 - 11008);
    expect(record?.totals.cachedInputTokens).toBe(11008);
    expect(record?.totals.reasoningTokens).toBe(116);
  });

  it("skips a repeated token_count so deltas are not double counted", () => {
    const state = initialCodexScanState();
    parseCodexLine(turnContext, state);
    const first = parseCodexLine(tokenCount(100, 0, 10, 0), state);
    const repeat = parseCodexLine(tokenCount(100, 0, 10, 0), state);

    expect(first).not.toBeNull();
    expect(repeat).toBeNull();
  });

  it("drops usage that arrives before any model is known", () => {
    const state = initialCodexScanState();
    expect(parseCodexLine(tokenCount(100, 0, 10, 0), state)).toBeNull();
  });

  it("does not let a pre-model event poison the duplicate signature", () => {
    // A token_count before its turn_context is dropped; the identical event
    // re-emitted once the model is known must still be counted.
    const state = initialCodexScanState();
    expect(parseCodexLine(tokenCount(100, 0, 10, 0), state)).toBeNull();
    parseCodexLine(turnContext, state);
    expect(parseCodexLine(tokenCount(100, 0, 10, 0), state)).not.toBeNull();
  });

  // A forked/subagent rollout opens with the parent's history copied in and
  // every line re-stamped to the fork instant, then the ancestors' session
  // metas. Counting those again multiplied usage ~1.85x on real data (#5758).
  describe("forked rollouts", () => {
    const meta = (overrides: {
      id: string;
      timestamp: string;
      forkedFromId?: string;
      spawnParentId?: string;
    }) =>
      JSON.stringify({
        type: "session_meta",
        timestamp: overrides.timestamp,
        payload: {
          type: "session_meta",
          id: overrides.id,
          ...(overrides.forkedFromId === undefined
            ? {}
            : { forked_from_id: overrides.forkedFromId }),
          ...(overrides.spawnParentId === undefined
            ? {}
            : {
                source: {
                  subagent: { thread_spawn: { parent_thread_id: overrides.spawnParentId } },
                },
              }),
        },
      });
    const stamped = (timestamp: string, line: string) => {
      const parsed = JSON.parse(line) as { timestamp: string };
      parsed.timestamp = timestamp;
      return JSON.stringify(parsed);
    };

    it("keeps the child session id over copied ancestor metas", () => {
      const state = initialCodexScanState();
      parseCodexLine(meta({ id: "child", timestamp: "2026-08-01T05:00:00.000Z" }), state);
      parseCodexLine(meta({ id: "parent", timestamp: "2026-08-01T05:00:00.000Z" }), state);
      parseCodexLine(turnContext, state);
      const record = parseCodexLine(tokenCount(100, 0, 10, 0), state);

      expect(record?.sessionId).toBe("child");
    });

    it("drops the re-stamped copied burst and keeps the first real event", () => {
      const state = initialCodexScanState();
      const forkInstant = "2026-08-01T05:00:00.000Z";
      parseCodexLine(meta({ id: "child", timestamp: forkInstant, forkedFromId: "parent" }), state);
      parseCodexLine(meta({ id: "parent", timestamp: forkInstant }), state);
      parseCodexLine(stamped(forkInstant, turnContext), state);

      // Copied history: written in one burst at the fork instant.
      expect(
        parseCodexLine(stamped("2026-08-01T05:00:00.001Z", tokenCount(100, 0, 10, 0)), state),
      ).toBeNull();
      expect(
        parseCodexLine(stamped("2026-08-01T05:00:00.002Z", tokenCount(200, 0, 20, 0)), state),
      ).toBeNull();

      // The child's first genuine turn lands seconds later and must count.
      const real = parseCodexLine(
        stamped("2026-08-01T05:00:06.000Z", tokenCount(300, 0, 30, 0)),
        state,
      );
      expect(real).not.toBeNull();
      expect(real?.totals.outputTokens).toBe(30);

      // Suppression never restarts, even for closely spaced later events.
      const next = parseCodexLine(
        stamped("2026-08-01T05:00:06.100Z", tokenCount(400, 0, 40, 0)),
        state,
      );
      expect(next).not.toBeNull();
    });

    it("recognizes subagent spawns without forked_from_id", () => {
      const state = initialCodexScanState();
      const spawnInstant = "2026-08-01T05:00:00.000Z";
      parseCodexLine(
        meta({ id: "child", timestamp: spawnInstant, spawnParentId: "parent" }),
        state,
      );
      parseCodexLine(stamped(spawnInstant, turnContext), state);
      expect(
        parseCodexLine(stamped("2026-08-01T05:00:00.001Z", tokenCount(100, 0, 10, 0)), state),
      ).toBeNull();
    });

    it("does not suppress anything in a rollout that is not a fork", () => {
      const state = initialCodexScanState();
      parseCodexLine(meta({ id: "root", timestamp: "2026-08-01T05:00:00.000Z" }), state);
      parseCodexLine(stamped("2026-08-01T05:00:00.100Z", turnContext), state);
      const record = parseCodexLine(
        stamped("2026-08-01T05:00:00.200Z", tokenCount(100, 0, 10, 0)),
        state,
      );
      expect(record).not.toBeNull();
    });
  });
});

/** Shaped after a real row from `opencode.db` / `kilo.db`'s `message` table. */
function messageData(overrides: {
  role?: string;
  modelID?: string;
  cost?: number;
  input?: number;
  output?: number;
  reasoning?: number;
  cacheRead?: number;
  cacheWrite?: number;
  createdAt?: number;
}): string {
  return JSON.stringify({
    role: overrides.role ?? "assistant",
    modelID: overrides.modelID ?? "nemotron-3.5-lightning-free",
    providerID: "opencode",
    cost: overrides.cost ?? 0,
    tokens: {
      input: overrides.input ?? 2416,
      output: overrides.output ?? 340,
      reasoning: overrides.reasoning ?? 122,
      cache: { read: overrides.cacheRead ?? 17408, write: overrides.cacheWrite ?? 0 },
    },
    time: { created: overrides.createdAt ?? 1787591878278, completed: 1787591900901 },
  });
}

describe("parseOpenCodeMessageRow", () => {
  it("parses a real assistant row into token totals and cost", () => {
    const record = parseOpenCodeMessageRow(
      "opencode",
      "msg_1",
      "ses_1",
      messageData({ cost: 0.0042 }),
    );
    expect(record).not.toBeNull();
    expect(record?.provider).toBe("opencode");
    expect(record?.sessionId).toBe("ses_1");
    expect(record?.model).toBe("nemotron-3.5-lightning-free");
    expect(record?.timestampMs).toBe(1787591878278);
    expect(record?.totals).toEqual({
      uncachedInputTokens: 2416,
      cachedInputTokens: 17408,
      cacheCreationTokens: 0,
      outputTokens: 340,
      reasoningTokens: 122,
    });
    expect(record?.reportedCostUsd).toBe(0.0042);
    expect(record?.dedupeKey).toBe("msg_1");
  });

  it("tags Kilo rows with the kilo provider despite the identical schema", () => {
    const record = parseOpenCodeMessageRow("kilo", "msg_2", "ses_2", messageData({}));
    expect(record?.provider).toBe("kilo");
  });

  it("treats a genuinely free (cost: 0) row as provider-reported, not unpriced", () => {
    const record = parseOpenCodeMessageRow("opencode", "msg_3", "ses_3", messageData({ cost: 0 }));
    expect(record?.reportedCostUsd).toBe(0);
  });

  it("ignores non-assistant rows (user messages carry no usage)", () => {
    const record = parseOpenCodeMessageRow(
      "opencode",
      "msg_4",
      "ses_4",
      messageData({ role: "user" }),
    );
    expect(record).toBeNull();
  });

  it("ignores rows with no model or no tokens", () => {
    expect(
      parseOpenCodeMessageRow("opencode", "msg_5", "ses_5", messageData({ modelID: "" })),
    ).toBeNull();
    expect(
      parseOpenCodeMessageRow(
        "opencode",
        "msg_6",
        "ses_6",
        messageData({ input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }),
      ),
    ).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseOpenCodeMessageRow("opencode", "msg_7", "ses_7", "{not json")).toBeNull();
  });
});

describe("totalTokens", () => {
  it("does not add reasoning on top of output", () => {
    expect(
      totalTokens({
        uncachedInputTokens: 10,
        cachedInputTokens: 20,
        cacheCreationTokens: 30,
        outputTokens: 40,
        reasoningTokens: 25,
      }),
    ).toBe(100);
  });
});

describe("parseGeminiLine", () => {
  it("extracts tokens with cached subtracted from input", () => {
    const state = initialGeminiScanState();
    parseGeminiLine(
      JSON.stringify({
        type: "session_metadata",
        sessionId: "sess-1",
        startTime: "2026-05-01T18:34:30.869Z",
      }),
      state,
    );
    const record = parseGeminiLine(
      JSON.stringify({
        type: "gemini",
        id: "g1",
        timestamp: "2026-05-01T18:34:40.000Z",
        model: "gemini-2.5-pro",
        tokens: { input: 120, output: 30, cached: 20, thoughts: 5, tool: 2 },
      }),
      state,
    );

    expect(record).toMatchObject({
      provider: "gemini",
      model: "gemini-2.5-pro",
      sessionId: "sess-1",
      totals: {
        uncachedInputTokens: 100,
        cachedInputTokens: 20,
        cacheCreationTokens: 0,
        outputTokens: 37,
        reasoningTokens: 5,
      },
    });
    expect(record?.dedupeKey).toContain("gemini:sess-1:g1:");
  });
});

describe("parsePiLine", () => {
  it("reads assistant usage and provider-reported cost", () => {
    const record = parsePiLine(
      JSON.stringify({
        type: "message",
        id: "entry-1",
        timestamp: "2026-05-01T18:34:40.000Z",
        message: {
          role: "assistant",
          model: "claude-opus-4-5",
          usage: {
            input: 3183,
            output: 104,
            cacheRead: 500,
            cacheWrite: 40,
            cost: { total: 0.0685 },
          },
        },
      }),
    );

    expect(record).toMatchObject({
      provider: "pi",
      model: "claude-opus-4-5",
      reportedCostUsd: 0.0685,
      totals: {
        uncachedInputTokens: 3183,
        cachedInputTokens: 500,
        cacheCreationTokens: 40,
        outputTokens: 104,
        reasoningTokens: 0,
      },
      dedupeKey: "pi:entry-1",
    });
  });
});

describe("parsePoolsideLine", () => {
  it("attributes end tokens to the model from the preceding start", () => {
    const state = initialPoolsideScanState("traj-1");
    expect(
      parsePoolsideLine(
        JSON.stringify({
          type: "tool_call.inference.start",
          tool_call_inference_start: {
            chat_completion_request: { model: "poolside/laguna-s-2.1" },
          },
        }),
        state,
      ),
    ).toBeNull();

    const record = parsePoolsideLine(
      JSON.stringify({
        id: "evt-1",
        timestamp: "2026-07-30T21:25:20.206Z",
        type: "tool_call.inference.end",
        tool_call_inference_end: {
          input_tokens: 8561,
          output_tokens: 392,
          cache_write_input_tokens: 0,
          cache_read_input_tokens: 704,
        },
      }),
      state,
    );

    expect(record).toMatchObject({
      provider: "poolside",
      model: "poolside/laguna-s-2.1",
      sessionId: "traj-1",
      totals: {
        uncachedInputTokens: 7857,
        cachedInputTokens: 704,
        cacheCreationTokens: 0,
        outputTokens: 392,
        reasoningTokens: 0,
      },
      dedupeKey: "poolside:evt-1",
    });
  });
});

describe("parseGithubCopilotUsageRow", () => {
  it("maps assistant_usage_events rows", () => {
    const record = parseGithubCopilotUsageRow({
      id: 42,
      session_id: "s1",
      model: "gpt-4.1",
      input_tokens: 1000,
      output_tokens: 50,
      cache_read_tokens: 200,
      cache_write_tokens: 10,
      reasoning_tokens: 12,
      created_at: "2026-05-01 18:34:40",
    });

    expect(record).toMatchObject({
      provider: "githubCopilot",
      model: "gpt-4.1",
      sessionId: "s1",
      totals: {
        uncachedInputTokens: 790,
        cachedInputTokens: 200,
        cacheCreationTokens: 10,
        outputTokens: 50,
        reasoningTokens: 12,
      },
      dedupeKey: "githubCopilot:42",
    });
  });
});
