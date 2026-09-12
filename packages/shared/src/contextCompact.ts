export const CONTEXT_COMPACT_TRANSCRIPT_CHAR_BUDGET = 40_000;

/** @deprecated Use CONTEXT_COMPACT_TRANSCRIPT_CHAR_BUDGET. */
export const PROVIDER_HANDOFF_TRANSCRIPT_CHAR_BUDGET = CONTEXT_COMPACT_TRANSCRIPT_CHAR_BUDGET;

export type CompactableMessage = {
  readonly role: string;
  readonly text: string;
};

export type ContextCompactReason = "provider" | "model-switch";

export function hasContextWindowModelChanged(input: {
  readonly selected: { readonly instanceId: string; readonly model: string } | null | undefined;
  readonly persisted: { readonly instanceId: string; readonly model: string } | null | undefined;
}): boolean {
  if (!input.selected || !input.persisted) {
    return false;
  }
  return (
    input.selected.instanceId !== input.persisted.instanceId ||
    input.selected.model !== input.persisted.model
  );
}

export interface CompactedContextPreambleInput {
  readonly messages: ReadonlyArray<CompactableMessage>;
  readonly fromLabel: string;
  readonly toLabel: string;
  /**
   * Provider switches cannot resume native session state. Model switches start
   * a fresh context window and need the same compacted transcript so the
   * conversation is not dropped.
   */
  readonly reason?: ContextCompactReason;
  /**
   * The message text about to be sent as this turn's own input. By the time a
   * turn-start command reaches the handoff handler, the read model has usually
   * already recorded the user's message that triggered it — so without this,
   * the outgoing message would appear twice. Only the single trailing
   * occurrence is dropped, not every occurrence of the text.
   */
  readonly excludeTrailingText?: string;
  readonly charBudget?: number;
  /**
   * Structured core context for the receiving model. Rendered above the
   * compacted transcript so a handoff keeps intent, files, and the next step
   * even when older messages are dropped.
   */
  readonly coreContext?: string;
}

/**
 * Builds a plain-text compacted transcript from the most recent user/assistant
 * messages, working backwards so the budget favors recent context. Returns ""
 * when there is nothing worth replaying.
 */
export function buildCompactedContextPreamble(input: CompactedContextPreambleInput): string {
  const budget = input.charBudget ?? CONTEXT_COMPACT_TRANSCRIPT_CHAR_BUDGET;
  const coreContext = input.coreContext?.trim() ?? "";
  let relevant = input.messages.filter(
    (message) => (message.role === "user" || message.role === "assistant") && message.text.trim(),
  );
  const trailing = relevant.at(-1);
  if (
    trailing !== undefined &&
    input.excludeTrailingText !== undefined &&
    trailing.role === "user" &&
    trailing.text.trim() === input.excludeTrailingText.trim()
  ) {
    relevant = relevant.slice(0, -1);
  }

  const rows: Array<string> = [];
  let usedChars = 0;
  let truncated = false;
  for (let index = relevant.length - 1; index >= 0; index -= 1) {
    const message = relevant[index];
    if (!message) continue;
    const speaker = message.role === "user" ? "User" : "Assistant";
    const row = `${speaker}: ${message.text.trim()}`;
    if (usedChars + row.length > budget) {
      truncated = index > 0;
      break;
    }
    rows.unshift(row);
    usedChars += row.length + 1;
  }
  if (rows.length === 0 && coreContext.length === 0) {
    return "";
  }

  const omitted = truncated ? " Earlier messages were omitted to fit the context budget." : "";
  const coreHint = coreContext.length > 0 ? " Core context for this handoff is below." : "";
  const follows = rows.length > 0 ? " Prior conversation follows:" : "";
  const header =
    input.reason === "model-switch"
      ? `[Context compacted after switching from ${input.fromLabel} to ${input.toLabel}: this conversation is continuing in a new session.${omitted}${coreHint}${follows}]`
      : `[Handoff from ${input.fromLabel} to ${input.toLabel}: this conversation is continuing in a new session with you.${omitted}${coreHint}${follows}]`;

  return [
    header,
    "",
    ...(coreContext.length > 0 ? [coreContext, ""] : []),
    ...(rows.length > 0 ? ["## Prior conversation", ...rows, ""] : []),
    "[End of prior conversation - continue naturally from here.]",
  ].join("\n");
}

/** @deprecated Use buildCompactedContextPreamble. */
export const buildProviderHandoffPreamble = buildCompactedContextPreamble;
