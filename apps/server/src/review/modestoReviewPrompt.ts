import type { ReviewConfiguration, ReviewDepth, ReviewTarget } from "@modesto/contracts";

import { MODESTO_REVIEW_OUTPUT_JSON_SCHEMA } from "./modestoReviewOutput.ts";

export const DEFAULT_MODESTO_REVIEW_CONFIGURATION: ReviewConfiguration = {
  runtime: "codex",
  model: "",
  depth: "standard",
  includeSecurity: true,
  includePerformance: true,
  includeArchitecture: true,
  includeTestCoverage: true,
  allowFixSuggestions: true,
  instructionFiles: ["AGENTS.md", "CONTRIBUTING.md"],
};

export function reviewEffortForDepth(depth: ReviewDepth): "medium" | "high" | "xhigh" {
  if (depth === "quick") return "medium";
  if (depth === "deep") return "xhigh";
  return "high";
}

export function reviewTimeoutForDepth(depth: ReviewDepth): number {
  if (depth === "quick") return 10 * 60_000;
  if (depth === "deep") return 45 * 60_000;
  return 20 * 60_000;
}

function targetInstructions(target: ReviewTarget): string {
  switch (target.type) {
    case "currentFile":
      return `Review the current contents of ${JSON.stringify(target.file)}.`;
    case "selectedCode":
      return `Review lines ${target.startLine}-${target.endLine} of ${JSON.stringify(target.file)}. Read enough surrounding code to validate each finding.`;
    case "uncommittedChanges":
      return "Review all staged, unstaged, and untracked changes in the working tree.";
    case "stagedChanges":
      return "Review only changes currently staged in Git.";
    case "selectedFiles":
      return `Review these files in their current repository context:\n${target.files.map((file) => `- ${JSON.stringify(file)}`).join("\n")}`;
    case "repository":
      return "Review the repository holistically. Prioritize concrete, high-confidence defects over style preferences.";
    case "pullRequest":
      return `Review the changes for pull request #${target.number} against base branch ${JSON.stringify(target.baseBranch)} using the Git information already available locally.`;
  }
}

function depthInstructions(depth: ReviewDepth): string {
  if (depth === "quick") {
    return "Use a focused pass. Report only high-confidence defects; skip speculative or stylistic concerns.";
  }
  if (depth === "deep") {
    return "Use a deep pass. Trace affected call paths, failure modes, concurrency, and persistence before deciding whether to report an issue.";
  }
  return "Use a standard pass. Validate changed behavior and its immediate callers and failure paths.";
}

export function buildModestoReviewPrompt(
  target: ReviewTarget,
  configuration: ReviewConfiguration,
): string {
  const checks = [
    "correctness and reliability",
    configuration.includeSecurity ? "security" : null,
    configuration.includePerformance ? "performance regressions" : null,
    configuration.includeArchitecture ? "architecture and cross-module contracts" : null,
    configuration.includeTestCoverage ? "missing or inadequate test coverage" : null,
  ].filter(Boolean);
  const instructionFiles = configuration.instructionFiles.length
    ? configuration.instructionFiles.map((file) => `- ${JSON.stringify(file)}`).join("\n")
    : "- None explicitly configured";

  return [
    "You are the Modesto Review runtime. Perform a read-only code review. Do not edit files, create files, change Git state, install dependencies, or run commands that mutate the workspace.",
    targetInstructions(target),
    depthInstructions(configuration.depth),
    `Check for: ${checks.join(", ")}.`,
    configuration.allowFixSuggestions
      ? "When a concrete safe fix is available, include concise suggested fix code or instructions."
      : "Set suggestedFix to null for every finding.",
    `Read and follow these repository instruction files when they exist:\n${instructionFiles}`,
    "Report only actionable findings introduced by or directly relevant to the selected target. Every finding must name a repository-relative file and the narrowest valid line range. Explain the concrete failure mode; omit praise, summaries of unaffected code, and speculative concerns.",
    "Return only JSON matching this schema, with no Markdown fence or surrounding prose:",
    JSON.stringify(MODESTO_REVIEW_OUTPUT_JSON_SCHEMA),
  ].join("\n\n");
}
