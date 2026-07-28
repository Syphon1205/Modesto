import { describe, expect, it } from "vitest";

import {
  parseModestoReviewResultText,
  parseModestoReviewStreamLine,
} from "./modestoReviewOutput.ts";

const result = {
  summary: "One issue found.",
  findings: [
    {
      severity: "major",
      file: "src/auth.ts",
      startLine: 12,
      endLine: 14,
      title: "Token comparison leaks timing",
      explanation: "Credential bytes are compared with a regular equality check.",
      suggestedFix: "Use timingSafeEqual after validating the byte lengths.",
    },
  ],
};

describe("modestoReviewOutput", () => {
  it("normalizes a structured review result", () => {
    expect(parseModestoReviewResultText(JSON.stringify(result))).toEqual(result);
  });

  it("accepts a fenced JSON response", () => {
    expect(parseModestoReviewResultText(`\`\`\`json\n${JSON.stringify(result)}\n\`\`\``)).toEqual(
      result,
    );
  });

  it("extracts structured JSON wrapped in runtime prose", () => {
    expect(
      parseModestoReviewResultText(
        `Here is the requested result:\n${JSON.stringify(result)}\nReview complete.`,
      ),
    ).toEqual(result);
  });

  it("extracts Codex agent results from JSONL events", () => {
    expect(
      parseModestoReviewStreamLine(
        "codex-jsonl",
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: JSON.stringify(result) },
        }),
      ),
    ).toEqual({ type: "result", result });
  });

  it("ignores non-final Codex agent chatter", () => {
    expect(
      parseModestoReviewStreamLine(
        "codex-jsonl",
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "I am still inspecting the diff." },
        }),
      ).type,
    ).toBe("unknown");
  });

  it("extracts Cursor results from JSONL events", () => {
    expect(
      parseModestoReviewStreamLine(
        "cursor-jsonl",
        JSON.stringify({ type: "result", is_error: false, result: JSON.stringify(result) }),
      ),
    ).toEqual({ type: "result", result });
  });

  it("normalizes CodeRabbit agent findings from JSONL events", () => {
    expect(
      parseModestoReviewStreamLine(
        "coderabbit-jsonl",
        JSON.stringify({
          type: "finding",
          severity: "major",
          fileName: "src/auth.ts",
          startLine: 12,
          endLine: 14,
          title: "Token comparison leaks timing",
          message: "Credential bytes are compared with a regular equality check.",
          codegenInstructions: "Use timingSafeEqual after validating the byte lengths.",
        }),
      ),
    ).toEqual({
      type: "result",
      result: {
        summary: "CodeRabbit reported a review finding.",
        findings: result.findings,
      },
    });
  });

  it("rejects prose that only resembles a review", () => {
    expect(parseModestoReviewResultText("No issues found.")).toBeNull();
  });

  it("rejects a result that would silently drop malformed findings", () => {
    expect(
      parseModestoReviewResultText(
        JSON.stringify({ summary: "One issue.", findings: [{ severity: "major" }] }),
      ),
    ).toBeNull();
  });

  it("normalizes line numbers emitted as decimal strings", () => {
    expect(
      parseModestoReviewResultText(
        JSON.stringify({
          ...result,
          findings: [{ ...result.findings[0], startLine: "12", endLine: "14" }],
        }),
      )?.findings[0],
    ).toMatchObject({ startLine: 12, endLine: 14 });
  });
});
