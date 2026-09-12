// FILE: AcpElicitation.ts
// Purpose: Projects an ACP elicitation form onto Modesto's user-input
//          questions, and the user's answers back onto an ACP response.
// Layer: ACP provider support (shared by every ACP-backed adapter)
//
// ACP elicitation is how an ACP agent asks the user something mid-turn. Every
// ACP adapter previously ignored it - none declared the client capability and
// none registered a handler - so agents on Droid, Custom ACP, GitHub Copilot,
// and Gemini simply could not ask a question. This is the shared translation
// that routes them into the same picker Claude's and Codex's questions use.
//
// The mapping is deliberately narrow. ACP's `requestedSchema` is a JSON-Schema
// subset that can express far more than a question with options (numbers,
// patterns, lengths). Only what the picker can faithfully represent is
// translated; see `acpElicitationQuestions` for what happens to the rest.

import * as Effect from "effect/Effect";
import type * as EffectAcpSchema from "effect-acp/schema";
import type { UserInputQuestion, UserInputQuestionOption } from "@modesto/contracts";

/** A form property paired with the key it is stored under. */
type NamedProperty = readonly [string, EffectAcpSchema.ElicitationPropertySchema];

function optionsForProperty(
  property: EffectAcpSchema.ElicitationPropertySchema,
): ReadonlyArray<UserInputQuestionOption> {
  if (property.type !== "string") {
    return [];
  }
  // `oneOf` carries labels of its own and so is richer than a bare `enum`;
  // prefer it when an agent sends both.
  if (property.oneOf && property.oneOf.length > 0) {
    return property.oneOf.map((option) => ({
      label: option.title.trim() || option.const,
      // EnumOption carries no separate description; the underlying constant is
      // the most useful secondary line, and the picker requires a non-empty one.
      description: option.const,
    }));
  }
  if (property.enum && property.enum.length > 0) {
    return property.enum.map((value) => ({ label: value, description: value }));
  }
  return [];
}

function questionText(
  property: EffectAcpSchema.ElicitationPropertySchema,
  fallback: string,
): string {
  return property.title?.trim() || property.description?.trim() || fallback;
}

/**
 * Turns an ACP form request into the questions the composer renders.
 *
 * One property becomes one question. A property with `enum`/`oneOf` becomes a
 * pick-one question; anything else becomes a question with no options, which
 * the composer renders as free text - that is the honest fallback for a
 * property whose constraints (numeric ranges, regex patterns) the picker
 * cannot enforce, rather than dropping the field and silently answering the
 * agent with nothing.
 */
export function acpElicitationQuestions(
  request: Extract<EffectAcpSchema.ElicitationRequest, { mode: "form" }>,
): ReadonlyArray<UserInputQuestion> {
  const properties = Object.entries(request.requestedSchema.properties ?? {}) as NamedProperty[];
  const header = request.requestedSchema.title?.trim() || "Question";

  if (properties.length === 0) {
    // A form with no fields is still a question worth surfacing - the agent's
    // message carries the ask, and answering it unblocks the turn.
    return [
      {
        id: "message",
        header,
        question: request.message,
        options: [],
        multiSelect: false,
      },
    ];
  }

  return properties.map(([name, property]) => ({
    id: name,
    header,
    // The form's `message` is the real prompt when there is only one field;
    // with several, each property's own title keeps them distinguishable.
    question: properties.length === 1 ? request.message : questionText(property, name),
    options: optionsForProperty(property),
    multiSelect: false,
  }));
}

/**
 * Builds the ACP response from the answers the user gave.
 *
 * An empty answer set means the user dismissed the request rather than
 * answering it, which ACP spells `decline` - responding `accept` with no
 * content would tell the agent its question was answered with silence.
 */
export function acpElicitationResponse(
  answers: Readonly<Record<string, unknown>>,
): EffectAcpSchema.ElicitationResponse {
  const content: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string" && value.trim().length > 0) {
      content[key] = value;
    }
  }
  return Object.keys(content).length === 0
    ? { action: { action: "decline" } }
    : { action: { action: "accept", content } };
}

/**
 * Bridges one ACP elicitation request to the composer and back.
 *
 * The agent's request blocks on `awaitResolution` until the user answers,
 * which is what makes the question part of the turn rather than a
 * notification beside it. Every ACP adapter registers this same bridge, so an
 * ACP question cannot behave differently from one provider to the next.
 *
 * A `url`-mode elicitation is declined without asking the user: it directs the
 * client to open a browser so the user can complete something out of band,
 * which the picker cannot represent. Declining is ACP's own answer for "this
 * client will not do that", and is far better than leaving the turn hung.
 */
export function acpElicitationExchange<
  Resolution extends AcpElicitationResolution,
  E = never,
>(input: {
  readonly request: EffectAcpSchema.ElicitationRequest;
  /** Emits `user-input.requested` with the projected questions. */
  readonly emitRequested: (
    questions: ReadonlyArray<UserInputQuestion>,
  ) => Effect.Effect<void, E, never>;
  /** Emits `user-input.resolved`; runs whether the user answered or cancelled. */
  readonly emitResolved: (
    answers: Readonly<Record<string, unknown>>,
  ) => Effect.Effect<void, E, never>;
  /** Resolves once the composer reports the user's decision. */
  readonly awaitResolution: Effect.Effect<Resolution, E, never>;
}): Effect.Effect<EffectAcpSchema.ElicitationResponse, E, never> {
  const { request } = input;
  if (request.mode !== "form") {
    return Effect.succeed({ action: { action: "decline" } });
  }
  return Effect.gen(function* () {
    yield* input.emitRequested(acpElicitationQuestions(request));
    const resolved = yield* input.awaitResolution;
    const answers = resolved._tag === "answered" ? resolved.answers : {};
    // Emitted before returning so the composer clears the question card even
    // when the user cancelled and the agent gets a decline.
    yield* input.emitResolved(answers);
    return resolved._tag === "answered"
      ? acpElicitationResponse(answers)
      : ({ action: { action: "cancel" } } satisfies EffectAcpSchema.ElicitationResponse);
  });
}

/** The composer's verdict on a pending question, as every ACP adapter models it. */
export type AcpElicitationResolution =
  | { readonly _tag: "answered"; readonly answers: Readonly<Record<string, unknown>> }
  | { readonly _tag: "cancelled" };
