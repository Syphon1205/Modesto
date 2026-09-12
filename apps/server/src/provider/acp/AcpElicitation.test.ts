import { describe, expect, it } from "vite-plus/test";

import { acpElicitationQuestions, acpElicitationResponse } from "./AcpElicitation.ts";

const form = (
  properties: Record<string, unknown>,
  extra: { message?: string; title?: string } = {},
) =>
  ({
    mode: "form",
    sessionId: "session-1",
    message: extra.message ?? "Which one?",
    requestedSchema: {
      type: "object",
      ...(extra.title ? { title: extra.title } : {}),
      properties,
    },
  }) as never;

describe("acpElicitationQuestions", () => {
  it("turns an enum property into pickable options", () => {
    const [question] = acpElicitationQuestions(
      form({ target: { type: "string", enum: ["staging", "production"] } }),
    );

    expect(question?.id).toBe("target");
    expect(question?.question).toBe("Which one?");
    expect(question?.options).toEqual([
      { label: "staging", description: "staging" },
      { label: "production", description: "production" },
    ]);
  });

  it("prefers oneOf labels over a bare enum", () => {
    // oneOf carries human-readable titles, so it is strictly more informative.
    const [question] = acpElicitationQuestions(
      form({
        target: {
          type: "string",
          enum: ["prod"],
          oneOf: [{ const: "prod", title: "Production" }],
        },
      }),
    );

    expect(question?.options).toEqual([{ label: "Production", description: "prod" }]);
  });

  it("falls back to the constant when oneOf has a blank title", () => {
    const [question] = acpElicitationQuestions(
      form({ target: { type: "string", oneOf: [{ const: "prod", title: "  " }] } }),
    );

    expect(question?.options[0]?.label).toBe("prod");
  });

  it("keeps a property with no options as a free-text question", () => {
    // Dropping it would answer the agent with nothing; free text is honest
    // about what the picker can and cannot enforce.
    const [question] = acpElicitationQuestions(form({ note: { type: "string" } }));

    expect(question?.id).toBe("note");
    expect(question?.options).toEqual([]);
  });

  it("uses each property's own title when there are several", () => {
    const questions = acpElicitationQuestions(
      form({
        env: { type: "string", title: "Environment", enum: ["a"] },
        note: { type: "string", description: "Extra detail" },
      }),
    );

    expect(questions.map((entry) => entry.question)).toEqual(["Environment", "Extra detail"]);
  });

  it("uses the request message when there is exactly one property", () => {
    const questions = acpElicitationQuestions(
      form(
        { env: { type: "string", title: "Environment" } },
        { message: "Where should I deploy?" },
      ),
    );

    expect(questions[0]?.question).toBe("Where should I deploy?");
  });

  it("still surfaces a form that declares no fields", () => {
    // The message carries the ask; answering it is what unblocks the turn.
    const questions = acpElicitationQuestions(form({}, { message: "Proceed?" }));

    expect(questions).toHaveLength(1);
    expect(questions[0]?.question).toBe("Proceed?");
  });

  it("uses the schema title as the card header", () => {
    const questions = acpElicitationQuestions(
      form({ env: { type: "string" } }, { title: "Deployment" }),
    );

    expect(questions[0]?.header).toBe("Deployment");
  });

  it("carries non-string properties through as free text", () => {
    // Two properties so the per-property title is used; with one, the
    // request message is the prompt (covered separately above).
    const questions = acpElicitationQuestions(
      form({
        count: { type: "number", title: "How many" },
        env: { type: "string", enum: ["a"], title: "Environment" },
      }),
    );

    expect(questions[0]?.options).toEqual([]);
    expect(questions[0]?.question).toBe("How many");
    expect(questions[1]?.options).toHaveLength(1);
  });
});

describe("acpElicitationResponse", () => {
  it("accepts with the answers the user gave", () => {
    expect(acpElicitationResponse({ target: "production" })).toEqual({
      action: { action: "accept", content: { target: "production" } },
    });
  });

  it("declines when nothing was answered", () => {
    // Accepting with empty content would tell the agent its question was
    // answered with silence.
    expect(acpElicitationResponse({})).toEqual({ action: { action: "decline" } });
  });

  it("declines when every answer is blank", () => {
    expect(acpElicitationResponse({ target: "   ", note: "" })).toEqual({
      action: { action: "decline" },
    });
  });

  it("drops non-string and blank answers but keeps the rest", () => {
    expect(acpElicitationResponse({ target: "prod", count: 3, note: "  " })).toEqual({
      action: { action: "accept", content: { target: "prod" } },
    });
  });
});
