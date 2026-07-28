import type { ReviewSeverity } from "@modesto/contracts";

export interface ParsedModestoReviewFinding {
  readonly severity: ReviewSeverity;
  readonly file: string;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly title: string;
  readonly explanation: string;
  readonly suggestedFix: string | null;
}

export interface ParsedModestoReviewResult {
  readonly summary: string;
  readonly findings: ReadonlyArray<ParsedModestoReviewFinding>;
}

export type ModestoReviewOutputMode = "codex-jsonl" | "cursor-jsonl" | "coderabbit-jsonl";

export type ModestoReviewStreamEvent =
  | { readonly type: "progress"; readonly message: string }
  | { readonly type: "result"; readonly result: ParsedModestoReviewResult }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "unknown"; readonly raw: unknown };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function positiveLine(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) return value;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeSeverity(value: unknown): ReviewSeverity {
  return value === "critical" ||
    value === "major" ||
    value === "minor" ||
    value === "trivial" ||
    value === "info"
    ? value
    : "info";
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseStructuredResult(value: unknown): ParsedModestoReviewResult | null {
  const root = record(value);
  if (!root || !Array.isArray(root.findings)) return null;

  const findings = root.findings.flatMap((entry): ParsedModestoReviewFinding[] => {
    const finding = record(entry);
    if (!finding) return [];
    const file = text(finding.file, 4_096);
    const title = text(finding.title, 500);
    const explanation = text(finding.explanation, 16_000);
    if (!file || !title || !explanation) return [];
    const startLine = positiveLine(finding.startLine);
    const endLine = positiveLine(finding.endLine) ?? startLine;
    return [
      {
        severity: normalizeSeverity(finding.severity),
        file,
        startLine,
        endLine,
        title,
        explanation,
        suggestedFix: text(finding.suggestedFix, 16_000),
      },
    ];
  });
  if (findings.length !== root.findings.length) return null;

  return {
    summary:
      text(root.summary, 4_000) ??
      (findings.length === 0
        ? "No reportable issues were found."
        : `Found ${findings.length} reportable issue${findings.length === 1 ? "" : "s"}.`),
    findings,
  };
}

export function parseModestoReviewResultText(raw: string): ParsedModestoReviewResult | null {
  const stripped = stripMarkdownFence(raw);
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  const candidates = [
    stripped,
    ...(firstBrace >= 0 && lastBrace > firstBrace
      ? [stripped.slice(firstBrace, lastBrace + 1)]
      : []),
  ];
  for (const candidate of candidates) {
    try {
      const result = parseStructuredResult(JSON.parse(candidate));
      if (result) return result;
    } catch {
      // Try the next candidate; runtimes sometimes wrap otherwise valid JSON in prose.
    }
  }
  return null;
}

function resultTextFromCodexItem(item: Record<string, unknown>): string | null {
  return item.type === "agent_message" ? text(item.text, 1_000_000) : null;
}

export function parseModestoReviewStreamLine(
  mode: ModestoReviewOutputMode,
  line: string,
): ModestoReviewStreamEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { type: "unknown", raw: line };
  }

  const value = record(parsed);
  if (!value) return { type: "unknown", raw: parsed };

  if (mode === "coderabbit-jsonl") {
    if (value.type === "status" || value.type === "review_context") {
      return {
        type: "progress",
        message: text(value.message, 500) ?? "CodeRabbit is analyzing changes",
      };
    }
    if (value.type === "finding") {
      const file = text(value.fileName, 4_096) ?? text(value.file, 4_096);
      const title =
        text(value.title, 500) ?? text(value.message, 500) ?? text(value.codegenInstructions, 500);
      const explanation =
        text(value.description, 16_000) ??
        text(value.message, 16_000) ??
        text(value.codegenInstructions, 16_000);
      if (!file || !title || !explanation) return { type: "unknown", raw: parsed };
      const startLine =
        positiveLine(value.startLine) ?? positiveLine(record(value.location)?.startLine);
      const endLine =
        positiveLine(value.endLine) ?? positiveLine(record(value.location)?.endLine) ?? startLine;
      const suggestions = Array.isArray(value.suggestions)
        ? value.suggestions
            .map((suggestion) =>
              typeof suggestion === "string"
                ? suggestion
                : (text(record(suggestion)?.description, 8_000) ??
                  text(record(suggestion)?.code, 8_000)),
            )
            .filter((suggestion): suggestion is string => Boolean(suggestion))
            .join("\n\n")
        : null;
      return {
        type: "result",
        result: {
          summary: "CodeRabbit reported a review finding.",
          findings: [
            {
              severity: normalizeSeverity(value.severity),
              file,
              startLine,
              endLine,
              title,
              explanation,
              suggestedFix:
                text(value.codegenInstructions, 16_000) ??
                text(value.suggestedFix, 16_000) ??
                suggestions,
            },
          ],
        },
      };
    }
    if (value.type === "complete") {
      return {
        type: "progress",
        message: text(value.message, 500) ?? "CodeRabbit review complete",
      };
    }
    if (value.type === "error") {
      return {
        type: "error",
        message: text(value.message, 4_000) ?? "CodeRabbit review failed.",
      };
    }
    return { type: "unknown", raw: parsed };
  }

  if (mode === "codex-jsonl") {
    if (value.type === "item.started") {
      const item = record(value.item);
      if (item?.type === "command_execution") {
        return { type: "progress", message: "Inspecting repository context" };
      }
    }
    if (value.type === "item.completed") {
      const item = record(value.item);
      if (item) {
        const resultText = resultTextFromCodexItem(item);
        if (resultText) {
          const result = parseModestoReviewResultText(resultText);
          return result ? { type: "result", result } : { type: "unknown", raw: parsed };
        }
        if (item.type === "command_execution") {
          return { type: "progress", message: "Checking changed code" };
        }
      }
    }
    if (value.type === "error") {
      return {
        type: "error",
        message: text(value.message, 4_000) ?? "Codex review failed.",
      };
    }
    return { type: "unknown", raw: parsed };
  }

  if (value.type === "assistant" || value.type === "tool") {
    return { type: "progress", message: "Analyzing repository context" };
  }
  if (value.type === "result") {
    if (value.is_error === true) {
      return {
        type: "error",
        message: text(value.result, 4_000) ?? "Cursor review failed.",
      };
    }
    const resultText = text(value.result, 1_000_000);
    const result = resultText ? parseModestoReviewResultText(resultText) : null;
    return result
      ? { type: "result", result }
      : {
          type: "error",
          message: `Cursor returned an invalid review result${resultText ? `: ${resultText.slice(0, 500)}` : "."}`,
        };
  }
  return { type: "unknown", raw: parsed };
}

export const MODESTO_REVIEW_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "severity",
          "file",
          "startLine",
          "endLine",
          "title",
          "explanation",
          "suggestedFix",
        ],
        properties: {
          severity: {
            type: "string",
            enum: ["critical", "major", "minor", "trivial", "info"],
          },
          file: { type: "string" },
          startLine: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
          endLine: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
          title: { type: "string" },
          explanation: { type: "string" },
          suggestedFix: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      },
    },
  },
} as const;
