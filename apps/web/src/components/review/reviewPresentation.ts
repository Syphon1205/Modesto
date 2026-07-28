import type {
  ReviewConfiguration,
  ReviewFinding,
  ReviewRun,
  ReviewTarget,
  ReviewTargetKind,
} from "@modesto/contracts";
import type { FileDiffMetadata } from "@pierre/diffs/react";

import type { ChatFileReference } from "~/lib/chatReferences";
import { resolveFileDiffPath } from "~/lib/diffRendering";

export type FindingGroup = "Critical" | "Warning" | "Suggestion" | "Informational";

export const FINDING_GROUP_BY_SEVERITY: Record<ReviewFinding["severity"], FindingGroup> = {
  critical: "Critical",
  major: "Warning",
  minor: "Suggestion",
  trivial: "Suggestion",
  info: "Informational",
};

export const FINDING_GROUP_ORDER: readonly FindingGroup[] = [
  "Critical",
  "Warning",
  "Suggestion",
  "Informational",
];

export const FINDING_GROUP_RANK: Record<FindingGroup, number> = {
  Critical: 3,
  Warning: 2,
  Suggestion: 1,
  Informational: 0,
};

export const FINDING_GROUP_CLASS: Record<FindingGroup, string> = {
  Critical: "text-red-600 dark:text-red-400",
  Warning: "text-orange-600 dark:text-orange-400",
  Suggestion: "text-amber-600 dark:text-amber-400",
  Informational: "text-blue-600 dark:text-blue-400",
};

export const REVIEW_TARGET_LABELS: Record<ReviewTargetKind, string> = {
  currentFile: "Current file",
  selectedCode: "Selected code",
  uncommittedChanges: "Uncommitted changes",
  stagedChanges: "Staged changes",
  selectedFiles: "Selected files",
  repository: "Repository",
  pullRequest: "Pull request",
};

export function buildReviewTarget(
  kind: ReviewTargetKind,
  selectedFilePath: string | null,
  selectedCode: ChatFileReference | null,
  diffFiles: ReadonlyArray<FileDiffMetadata>,
  pullRequest: { number: number; baseBranch: string } | null,
): { target: ReviewTarget | null; reason: string | null } {
  switch (kind) {
    case "currentFile":
      return selectedFilePath
        ? { target: { type: "currentFile", file: selectedFilePath }, reason: null }
        : { target: null, reason: "Open a file first." };
    case "selectedCode":
      return selectedCode
        ? {
            target: {
              type: "selectedCode",
              file: selectedCode.path,
              startLine: selectedCode.startLine ?? 1,
              endLine: selectedCode.endLine ?? selectedCode.startLine ?? 1,
            },
            reason: null,
          }
        : { target: null, reason: "Select code in the current file first." };
    case "selectedFiles": {
      const files = [...new Set(diffFiles.map(resolveFileDiffPath).filter(Boolean))];
      return files.length > 0
        ? { target: { type: "selectedFiles", files }, reason: null }
        : { target: null, reason: "No changed files are selected." };
    }
    case "pullRequest":
      return pullRequest
        ? {
            target: {
              type: "pullRequest",
              number: pullRequest.number,
              baseBranch: pullRequest.baseBranch,
            },
            reason: null,
          }
        : { target: null, reason: "No pull request is available for this branch." };
    case "uncommittedChanges":
    case "stagedChanges":
    case "repository":
      return { target: { type: kind }, reason: null };
  }
}

export function describeReviewTarget(target: ReviewTarget | null): string {
  if (!target) return "Legacy review";
  if (target.type === "currentFile") return target.file;
  if (target.type === "selectedCode") {
    return `${target.file}:${target.startLine}-${target.endLine}`;
  }
  if (target.type === "selectedFiles") {
    return `${target.files.length} selected file${target.files.length === 1 ? "" : "s"}`;
  }
  if (target.type === "pullRequest") return `Pull request #${target.number}`;
  return REVIEW_TARGET_LABELS[target.type];
}

export function describeReviewConfiguration(configuration: ReviewConfiguration | null): string {
  if (!configuration) return "Legacy";
  const runtime = configuration.runtime === "codex" ? "Codex" : "Cursor";
  const depth = configuration.depth.slice(0, 1).toUpperCase() + configuration.depth.slice(1);
  return `${runtime} · ${depth}`;
}

export function reviewRunOptionLabel(run: ReviewRun): string {
  const time = new Date(run.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${describeReviewTarget(run.target)} · ${time}`;
}

export function reviewStatusLabel(
  status: ReviewRun["status"] | undefined,
  progressMessage: string | null,
): string {
  if (progressMessage) return progressMessage;
  if (status === "queued") return "Preparing context";
  if (status === "running") return "Analyzing changes";
  if (status === "completed" || status === "skipped") return "Review complete";
  if (status === "failed") return "Review failed";
  if (status === "cancelled") return "Review cancelled";
  return "Ready to review";
}
