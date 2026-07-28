import {
  CommandId,
  MessageId,
  PROVIDER_DISPLAY_NAMES,
  type ReviewConfiguration,
  type ReviewFinding,
  type ReviewProvider,
  type ReviewTargetKind,
  type ThreadId,
} from "@modesto/contracts";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppSettings } from "~/appSettings";
import type { ChatFileReference } from "~/lib/chatReferences";
import { summarizeFileDiffStats } from "~/lib/diffRendering";
import { gitStatusQueryOptions } from "~/lib/gitReactQuery";
import { cn } from "~/lib/utils";
import {
  reviewListQueryOptions,
  reviewProvidersQueryOptions,
  useCancelReview,
  useIgnoreReviewFinding,
  useReviewProgress,
  useStartReview,
} from "~/lib/reviewReactQuery";
import { openWorkspaceFileReference, useWorkspaceFileOpener } from "~/lib/workspaceFileOpener";
import { ensureNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  HistoryIcon,
  Loader2Icon,
} from "~/lib/icons";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { ReviewFindingGroups } from "./ReviewFindingGroups";
import { ReviewProgressRail, type ReviewProgressStage } from "./ReviewProgressRail";
import {
  buildReviewTarget,
  describeReviewConfiguration,
  describeReviewTarget,
  FINDING_GROUP_BY_SEVERITY,
  FINDING_GROUP_CLASS,
  FINDING_GROUP_ORDER,
  FINDING_GROUP_RANK,
  type FindingGroup,
  REVIEW_TARGET_LABELS,
  reviewRunOptionLabel,
  reviewStatusLabel,
} from "./reviewPresentation";

export function ReviewFindingsPanel({
  threadId,
  selectedAgent: _selectedAgent,
  enabled,
  onFix,
  onExplain,
  selectedFilePath = null,
  workspaceRoot = null,
  selectedCode = null,
  diffFiles = [],
  pullRequest = null,
  onOpenLocation,
  onCollapse,
  layout = "embedded",
}: {
  readonly threadId: ThreadId;
  readonly selectedAgent: string;
  readonly enabled: boolean;
  readonly onFix?: (finding: ReviewFinding) => void;
  readonly onExplain?: (finding: ReviewFinding) => void;
  readonly selectedFilePath?: string | null;
  readonly workspaceRoot?: string | null;
  readonly selectedCode?: ChatFileReference | null;
  readonly diffFiles?: ReadonlyArray<FileDiffMetadata>;
  readonly pullRequest?: { number: number; baseBranch: string } | null;
  readonly onOpenLocation?: (finding: ReviewFinding) => void;
  readonly onCollapse?: () => void;
  readonly layout?: "embedded" | "sidebar";
}) {
  const { settings, updateSettings } = useAppSettings();
  const provider = settings.reviewProvider;
  const defaultTarget = settings.modestoReviewScope;
  const [targetKind, setTargetKind] = useState<ReviewTargetKind>(defaultTarget);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [findingFilter, setFindingFilter] = useState<FindingGroup | "All">("All");
  const query = useQuery(
    reviewListQueryOptions(threadId, provider, enabled, settings.modestoReviewRuntime),
  );
  const providersQuery = useQuery(reviewProvidersQueryOptions());
  const gitStatusQuery = useQuery({
    ...gitStatusQueryOptions(workspaceRoot),
    enabled: enabled && workspaceRoot !== null,
  });
  const start = useStartReview(threadId, provider);
  const cancel = useCancelReview(threadId, provider);
  const ignore = useIgnoreReviewFinding(threadId, provider);
  const progress = useReviewProgress(threadId, provider);
  const opener = useWorkspaceFileOpener();
  const activeThreadShell = useStore((state) => state.threadShellById?.[threadId]);
  const activeRun = query.data?.runs.find(
    (run) => run.status === "queued" || run.status === "running",
  );
  const latestRun = query.data?.runs[0];
  const selectedRun = selectedRunId
    ? query.data?.runs.find((run) => run.id === selectedRunId)
    : undefined;
  const displayRun = activeRun ?? selectedRun ?? latestRun;
  const availability = query.data?.availability;
  const displayRunId = displayRun?.id;
  const minimumRank = {
    critical: 3,
    warning: 2,
    suggestion: 1,
    informational: 0,
  }[settings.reviewMinimumSeverity];
  const openFindingsForRun = useMemo(
    () =>
      (query.data?.findings ?? []).filter(
        (finding) => finding.status === "open" && finding.runId === displayRunId,
      ),
    [displayRunId, query.data?.findings],
  );
  const eligibleFindings = useMemo(
    () =>
      openFindingsForRun.filter(
        (finding) => FINDING_GROUP_RANK[FINDING_GROUP_BY_SEVERITY[finding.severity]] >= minimumRank,
      ),
    [minimumRank, openFindingsForRun],
  );
  const findingCounts = useMemo(
    () =>
      FINDING_GROUP_ORDER.reduce<Record<FindingGroup, number>>(
        (counts, group) => {
          counts[group] = eligibleFindings.filter(
            (finding) => FINDING_GROUP_BY_SEVERITY[finding.severity] === group,
          ).length;
          return counts;
        },
        { Critical: 0, Warning: 0, Suggestion: 0, Informational: 0 },
      ),
    [eligibleFindings],
  );
  const findings = useMemo(
    () =>
      findingFilter === "All"
        ? eligibleFindings
        : eligibleFindings.filter(
            (finding) => FINDING_GROUP_BY_SEVERITY[finding.severity] === findingFilter,
          ),
    [eligibleFindings, findingFilter],
  );
  const hasHiddenFindings = openFindingsForRun.length > 0 && eligibleFindings.length === 0;
  const groupedFindings = useMemo(
    () =>
      FINDING_GROUP_ORDER.map((group) => ({
        group,
        findings: findings.filter(
          (finding) => FINDING_GROUP_BY_SEVERITY[finding.severity] === group,
        ),
      })).filter((entry) => entry.findings.length > 0),
    [findings],
  );
  const resolvedPullRequest =
    pullRequest ??
    (gitStatusQuery.data?.pr
      ? {
          number: gitStatusQuery.data.pr.number,
          baseBranch: gitStatusQuery.data.pr.baseBranch,
        }
      : null);
  const targetState = useMemo(
    () =>
      buildReviewTarget(targetKind, selectedFilePath, selectedCode, diffFiles, resolvedPullRequest),
    [diffFiles, resolvedPullRequest, selectedCode, selectedFilePath, targetKind],
  );
  const targetSupported = availability?.supportedTargets.includes(targetKind) ?? false;
  const runtimeSupported =
    provider !== "modesto" ||
    (availability?.supportedRuntimes.includes(settings.modestoReviewRuntime) ?? false);
  const unavailableReason =
    availability?.installation === "not-found"
      ? availability.message
      : !runtimeSupported
        ? `${PROVIDER_DISPLAY_NAMES[settings.modestoReviewRuntime]} is not available for Modesto Review.`
        : availability?.authenticated === "no"
          ? (availability.message ?? `Connect ${availability.displayName} in Settings first.`)
          : !targetSupported
            ? `${availability?.displayName ?? "This provider"} does not support ${REVIEW_TARGET_LABELS[targetKind].toLowerCase()} yet.`
            : targetState.reason;
  const diffStats = useMemo(() => summarizeFileDiffStats(diffFiles), [diffFiles]);
  const isRunning = Boolean(activeRun);
  const providerName =
    availability?.displayName ??
    ({ modesto: "Modesto Review", coderabbit: "CodeRabbit", greptile: "Greptile" } as const)[
      provider
    ];
  const configuration = useMemo(
    (): ReviewConfiguration => ({
      runtime: settings.modestoReviewRuntime,
      model: settings.modestoReviewModel,
      depth: settings.modestoReviewDepth,
      includeSecurity: settings.reviewIncludeSecurity,
      includePerformance: settings.reviewIncludePerformance,
      includeArchitecture: settings.reviewIncludeArchitecture,
      includeTestCoverage: settings.reviewIncludeTestCoverage,
      allowFixSuggestions: settings.reviewAllowFixSuggestions,
      instructionFiles: settings.reviewInstructionFiles
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean)
        .slice(0, 32),
    }),
    [
      settings.modestoReviewDepth,
      settings.modestoReviewModel,
      settings.modestoReviewRuntime,
      settings.reviewAllowFixSuggestions,
      settings.reviewIncludeArchitecture,
      settings.reviewIncludePerformance,
      settings.reviewIncludeSecurity,
      settings.reviewIncludeTestCoverage,
      settings.reviewInstructionFiles,
    ],
  );

  useEffect(() => {
    setFindingFilter("All");
    setSelectedFindingId(null);
  }, [displayRunId]);

  useEffect(() => {
    if (findings.length === 0) {
      setSelectedFindingId(null);
      return;
    }
    if (!findings.some((finding) => finding.id === selectedFindingId)) {
      setSelectedFindingId(findings[0]?.id ?? null);
    }
  }, [findings, selectedFindingId]);

  const openFinding = useCallback(
    (finding: ReviewFinding) => {
      setSelectedFindingId(finding.id);
      if (onOpenLocation) {
        onOpenLocation(finding);
        return;
      }
      openWorkspaceFileReference(
        opener,
        finding.startLine ? `${finding.file}:${finding.startLine}` : finding.file,
      );
    },
    [onOpenLocation, opener],
  );
  const selectedFindingIndex = findings.findIndex((finding) => finding.id === selectedFindingId);
  const navigateFinding = useCallback(
    (offset: number) => {
      if (findings.length === 0) return;
      const currentIndex = selectedFindingIndex < 0 ? 0 : selectedFindingIndex;
      const nextIndex = Math.min(findings.length - 1, Math.max(0, currentIndex + offset));
      const finding = findings[nextIndex];
      if (finding) openFinding(finding);
    },
    [findings, openFinding, selectedFindingIndex],
  );
  const progressStage = useMemo((): ReviewProgressStage | null => {
    if (progress && progress.runId === activeRun?.id) return progress.stage;
    if (displayRun?.status === "queued") return "preparing_context";
    if (displayRun?.status === "running") return "analyzing_changes";
    if (displayRun?.status === "completed" || displayRun?.status === "skipped") {
      return "review_complete";
    }
    return null;
  }, [activeRun?.id, displayRun?.status, progress]);
  const statusMessage = reviewStatusLabel(
    displayRun?.status,
    progress && progress.runId === activeRun?.id ? progress.message : null,
  );

  const dispatchFinding = useCallback(
    (finding: ReviewFinding, intent: "fix" | "ask") => {
      if (intent === "fix" && onFix) return onFix(finding);
      if (intent === "ask" && onExplain) return onExplain(finding);
      if (!activeThreadShell) return;
      const location = finding.startLine
        ? `${finding.file}:${finding.startLine}${finding.endLine && finding.endLine !== finding.startLine ? `-${finding.endLine}` : ""}`
        : finding.file;
      const prompt = [
        intent === "fix"
          ? `Apply the safest fix for this ${providerName} finding in ${location}.`
          : `Review and explain this ${providerName} finding in ${location}.`,
        `Title: ${finding.title}`,
        finding.explanation,
        finding.suggestedFix ? `Suggested fix:\n${finding.suggestedFix}` : "",
        intent === "fix"
          ? "Inspect the current code and diff first. Make the smallest correct change and preserve unrelated work."
          : "Explain whether the finding is valid in this repository, the concrete risk, and the safest resolution. Do not edit files unless I ask.",
      ]
        .filter(Boolean)
        .join("\n\n");
      const token = crypto.randomUUID();
      void ensureNativeApi().orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId: CommandId.makeUnsafe(`review-action:${token}`),
        threadId,
        message: {
          messageId: MessageId.makeUnsafe(`review-action:${token}:message`),
          role: "user",
          text: prompt,
          attachments: [],
        },
        modelSelection: activeThreadShell.modelSelection,
        dispatchMode: "queue",
        runtimeMode: activeThreadShell.runtimeMode,
        interactionMode: activeThreadShell.interactionMode,
        createdAt: new Date().toISOString(),
      });
    },
    [activeThreadShell, onExplain, onFix, providerName, threadId],
  );

  return (
    <section
      className={cn(
        "flex shrink-0 flex-col bg-[var(--color-background-surface)]",
        layout === "sidebar"
          ? "h-full min-h-0 w-80 border-r border-border/70"
          : "max-h-[min(30rem,52vh)] border-b border-border/70",
      )}
      onKeyDown={(event) => {
        if (!event.altKey || findings.length === 0) return;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          navigateFinding(-1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          navigateFinding(1);
        }
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <div className="min-w-36 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Review</span>
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full bg-muted-foreground/45",
                isRunning && "animate-pulse bg-[var(--color-text-accent)]",
                (displayRun?.status === "completed" || displayRun?.status === "skipped") &&
                  "bg-emerald-500",
                displayRun?.status === "failed" && "bg-destructive",
              )}
              aria-hidden="true"
            />
            <span className="truncate text-[11px] text-muted-foreground">{statusMessage}</span>
          </div>
        </div>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
          {findings.length > 0 ? (
            <div className="hidden items-center sm:flex" aria-label="Finding navigation">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Previous finding"
                title="Previous finding (⌥↑)"
                disabled={selectedFindingIndex <= 0}
                onClick={() => navigateFinding(-1)}
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <span className="min-w-10 text-center text-[10px] tabular-nums text-muted-foreground">
                {Math.max(0, selectedFindingIndex) + 1}/{findings.length}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Next finding"
                title="Next finding (⌥↓)"
                disabled={selectedFindingIndex >= findings.length - 1}
                onClick={() => navigateFinding(1)}
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          ) : null}
          {(query.data?.runs.length ?? 0) > 1 && displayRun ? (
            <Select
              value={displayRun.id}
              onValueChange={(value) => {
                if (!value) return;
                setSelectedRunId(value);
                setSelectedFindingId(null);
              }}
            >
              <SelectTrigger
                className="hidden h-7 w-36 text-xs md:flex"
                aria-label="Review history"
              >
                <HistoryIcon className="mr-1 size-3.5 shrink-0" />
                <SelectValue>{reviewRunOptionLabel(displayRun)}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end">
                {query.data?.runs.slice(0, 20).map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {reviewRunOptionLabel(run)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : null}
          <Select
            value={targetKind}
            onValueChange={(value) => value && setTargetKind(value as ReviewTargetKind)}
          >
            <SelectTrigger className="h-7 w-40 text-xs" aria-label="Review target">
              <SelectValue>{REVIEW_TARGET_LABELS[targetKind]}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end">
              {Object.entries(REVIEW_TARGET_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          {isRunning ? (
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => activeRun && cancel.mutate(activeRun.id)}
            >
              Cancel
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={Boolean(unavailableReason) || !targetState.target || start.isPending}
              onClick={() => {
                if (!targetState.target) return;
                setSelectedRunId(null);
                setSelectedFindingId(null);
                start.mutate({ target: targetState.target, configuration });
              }}
            >
              {latestRun ? "Review again" : "Run review"}
            </Button>
          )}
          {onCollapse ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Collapse review"
              onClick={onCollapse}
            >
              <ChevronUpIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/45 px-3 py-2">
        <Select
          value={provider}
          onValueChange={(value) => {
            if (!value) return;
            updateSettings({ reviewProvider: value as ReviewProvider });
            setSelectedRunId(null);
            setSelectedFindingId(null);
          }}
        >
          <SelectTrigger className="h-7 min-w-0 flex-1 text-xs" aria-label="Review platform">
            <SelectValue>{providerName}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="start">
            {(providersQuery.data?.providers ?? []).map((candidate) => (
              <SelectItem key={candidate.provider} value={candidate.provider}>
                {candidate.displayName}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <span className="text-[10px] text-muted-foreground">
          {availability?.installation === "detected" ? "Ready" : "Setup required"}
        </span>
      </div>

      {progressStage ? <ReviewProgressRail stage={progressStage} message={statusMessage} /> : null}

      <div className="flex min-h-8 shrink-0 items-center gap-2 border-t border-border/45 px-3">
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
          {displayRun?.target
            ? describeReviewTarget(displayRun.target)
            : diffFiles.length > 0
              ? `${diffFiles.length} changed file${diffFiles.length === 1 ? "" : "s"} · +${diffStats.additions} −${diffStats.deletions}`
              : REVIEW_TARGET_LABELS[targetKind]}
          <span className="mx-1.5 text-border">·</span>
          {describeReviewConfiguration(displayRun?.configuration ?? configuration)}
        </span>
        {eligibleFindings.length > 0 ? (
          <div className="flex items-center gap-0.5" aria-label="Filter review findings">
            {(["All", ...FINDING_GROUP_ORDER] as const).map((group) => {
              const count = group === "All" ? eligibleFindings.length : findingCounts[group];
              if (group !== "All" && count === 0) return null;
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={findingFilter === group}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    findingFilter === group && "bg-muted text-foreground",
                    group !== "All" && FINDING_GROUP_CLASS[group],
                  )}
                  onClick={() => setFindingFilter(group)}
                >
                  {group} {count}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 overflow-y-auto border-t border-border/55">
        {query.isPending ? (
          <div className="flex items-center gap-2 px-3 py-5 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" /> Checking review provider…
          </div>
        ) : unavailableReason && !isRunning ? (
          <div className="px-3 py-4">
            <p className="text-xs font-medium text-foreground">Review unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {unavailableReason}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Configure the runtime in Settings → Code Review.
            </p>
          </div>
        ) : groupedFindings.length > 0 ? (
          <>
            {displayRun?.error ? (
              <p className="px-3 pt-3 text-xs text-destructive">{displayRun.error}</p>
            ) : null}
            <ReviewFindingGroups
              groups={groupedFindings}
              summary={displayRun?.summary ?? null}
              selectedFindingId={selectedFindingId}
              onApplyFix={(finding) => dispatchFinding(finding, "fix")}
              onAsk={(finding) => dispatchFinding(finding, "ask")}
              onDismiss={(finding) => ignore.mutate({ findingId: finding.id, ignored: true })}
              onOpen={openFinding}
            />
          </>
        ) : displayRun?.error ? (
          <div className="px-3 py-3">
            <p className="text-xs text-destructive">{displayRun.error}</p>
            {hasHiddenFindings ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Findings are hidden by the minimum severity setting.
              </p>
            ) : null}
          </div>
        ) : hasHiddenFindings ? (
          <div className="px-3 py-5 text-center">
            <p className="text-xs font-medium text-foreground">Findings are hidden</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Lower the minimum severity in Settings → Code Review to show this run’s findings.
            </p>
          </div>
        ) : isRunning ? (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            Findings will appear here as soon as the review finishes.
          </div>
        ) : displayRun?.status === "cancelled" ? (
          <div className="px-3 py-4">
            <p className="text-xs font-medium text-foreground">Review cancelled</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              No results were recorded. You can run the same target again at any time.
            </p>
          </div>
        ) : displayRun && (displayRun.status === "completed" || displayRun.status === "skipped") ? (
          <div className="px-3 py-5 text-center">
            <p className="text-xs font-medium text-foreground">No issues found</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {displayRun.summary ??
                `${providerName} completed the review without reportable findings.`}
            </p>
          </div>
        ) : (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Choose a real review target and run {providerName}.
          </div>
        )}
      </div>
    </section>
  );
}
