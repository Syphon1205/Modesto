import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import {
  CommandId,
  EventId,
  ReviewFindingId,
  ReviewRunId,
  type ReviewFinding,
  type ReviewRun,
  type ReviewStreamEvent,
} from "@modesto/contracts";
import { Effect, Layer, Option, PubSub, Stream } from "effect";

import { resolveThreadWorkspaceCwd } from "../../checkpointing/Utils.ts";
import { OrchestrationEngineService } from "../../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../../orchestration/Services/ProjectionSnapshotQuery.ts";
import { ReviewRepository } from "../../persistence/Services/ReviewRepository.ts";
import { ReviewServiceError } from "../Errors.ts";
import {
  parseModestoReviewStreamLine,
  type ParsedModestoReviewResult,
} from "../modestoReviewOutput.ts";
import { DEFAULT_MODESTO_REVIEW_CONFIGURATION } from "../modestoReviewPrompt.ts";
import { startReviewProcess, type ReviewProcessResult } from "../reviewProcess.ts";
import { getReviewProviderAdapter, listReviewProviderAdapters } from "./ReviewProviderAdapters.ts";
import type { ReviewProviderCommand } from "../Services/ReviewProviderAdapter.ts";
import { ReviewService, type ReviewServiceShape } from "../Services/ReviewService.ts";

const toError =
  (message: string) =>
  (cause: unknown): ReviewServiceError =>
    cause instanceof ReviewServiceError ? cause : new ReviewServiceError({ message, cause });

const execFileAsync = promisify(execFile);

function progressStage(
  message: string,
): "preparing_context" | "analyzing_changes" | "checking_issues" {
  const normalized = message.toLowerCase();
  if (/check|finding|issue|security|performance|test/.test(normalized)) return "checking_issues";
  if (/context|prepar|collect|repository|file/.test(normalized)) return "preparing_context";
  return "analyzing_changes";
}

export function reviewFailureMessage(input: {
  readonly result: ReviewProcessResult;
  readonly reportedError: string | null;
  readonly interruptedByShutdown: boolean;
}): string {
  return (
    (input.interruptedByShutdown ? "Review interrupted by Modesto shutdown." : "") ||
    input.reportedError ||
    (input.result.outputLimitExceeded
      ? "The review produced more output than Modesto can safely process."
      : "") ||
    (input.result.timedOut ? "The review exceeded the configured time limit." : "") ||
    input.result.stderr.trim() ||
    "The review provider exited before completing the review."
  ).slice(0, 4_000);
}

export const makeReviewService = Effect.gen(function* () {
  const repository = yield* ReviewRepository;
  const snapshots = yield* ProjectionSnapshotQuery;
  const orchestration = yield* OrchestrationEngineService;
  const serviceScope = yield* Effect.scope;
  const events = yield* PubSub.unbounded<ReviewStreamEvent>();
  const activeProcesses = new Map<ReviewRunId, ChildProcess>();
  const cancelledRuns = new Set<ReviewRunId>();
  const shuttingDownRuns = new Set<ReviewRunId>();
  let shuttingDown = false;
  yield* repository.failStaleActiveRuns(new Date().toISOString());
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      shuttingDown = true;
      for (const [runId, child] of activeProcesses) {
        shuttingDownRuns.add(runId);
        child.kill("SIGTERM");
      }
      activeProcesses.clear();
    }),
  );

  const publishRun = (run: ReviewRun) => PubSub.publish(events, { type: "run", run });
  const publishFinding = (finding: ReviewFinding) =>
    PubSub.publish(events, { type: "finding", finding });
  const publishProgress = (
    run: ReviewRun,
    stage: Extract<ReviewStreamEvent, { type: "progress" }>["stage"],
    message: string,
  ) =>
    PubSub.publish(events, {
      type: "progress" as const,
      runId: run.id,
      threadId: run.threadId,
      stage,
      message,
    });

  const appendActivity = (input: {
    readonly run: ReviewRun;
    readonly kind: string;
    readonly summary: string;
    readonly tone?: "info" | "error";
    readonly payload?: Record<string, unknown>;
  }) => {
    const now = new Date().toISOString();
    const token = randomUUID();
    return orchestration.dispatch({
      type: "thread.activity.append",
      commandId: CommandId.makeUnsafe(`review:${input.run.id}:${token}`),
      threadId: input.run.threadId,
      activity: {
        id: EventId.makeUnsafe(`review:${input.run.id}:${token}`),
        tone: input.tone ?? "info",
        kind: input.kind,
        summary: input.summary,
        payload: { reviewRunId: input.run.id, ...(input.payload ?? {}) },
        turnId: null,
        createdAt: now,
      },
      createdAt: now,
    });
  };
  const appendCancelledActivity = (run: ReviewRun) =>
    appendActivity({
      run,
      kind: "review.cancelled",
      summary: "Modesto Review cancelled",
    }).pipe(Effect.catch(() => Effect.void));

  const runProviderCommand = (
    runId: ReviewRunId,
    command: ReviewProviderCommand,
    cwd: string,
    onStarted: () => void,
    onStdoutLine: (line: string) => void,
  ): Effect.Effect<ReviewProcessResult, never> => {
    if (shuttingDown) {
      shuttingDownRuns.add(runId);
      return Effect.succeed({
        code: 1,
        stdout: "",
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      });
    }
    const execution = startReviewProcess({
      command,
      cwd,
      onStarted,
      onStdoutLine,
    });
    activeProcesses.set(runId, execution.child);
    if (shuttingDown) {
      shuttingDownRuns.add(runId);
      execution.child.kill("SIGTERM");
    } else if (cancelledRuns.has(runId)) {
      execution.child.kill("SIGTERM");
    }
    return Effect.promise(() =>
      execution.result.finally(() => {
        activeProcesses.delete(runId);
      }),
    );
  };

  const processRun = (queued: ReviewRun, cwd: string, command: ReviewProviderCommand) => {
    let latestRun = queued;
    let persistedFindingCount = queued.findingCount;
    let latestReviewSummary = queued.summary;
    return Effect.gen(function* () {
      let run: ReviewRun = {
        ...queued,
        status: "running",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      run = yield* repository.saveRunIfActive(run);
      latestRun = run;
      if (run.status !== "running") {
        cancelledRuns.delete(run.id);
        yield* publishRun(run);
        if (run.status === "cancelled") yield* appendCancelledActivity(run);
        return;
      }

      const cancelBeforeProvider = () =>
        Effect.gen(function* () {
          if (!cancelledRuns.has(run.id)) return false;
          const now = new Date().toISOString();
          run = yield* repository.saveRunIfActive({
            ...run,
            status: "cancelled",
            error: null,
            finishedAt: now,
            updatedAt: now,
          });
          latestRun = run;
          cancelledRuns.delete(run.id);
          yield* publishRun(run);
          yield* appendCancelledActivity(run);
          return true;
        });

      if (yield* cancelBeforeProvider()) return;
      yield* publishRun(run);
      if (yield* cancelBeforeProvider()) return;
      yield* publishProgress(run, "preparing_context", "Preparing repository context");
      yield* appendActivity({
        run,
        kind: "review.started",
        summary: "Modesto Review started",
      });
      if (yield* cancelBeforeProvider()) return;

      const publishedProgress = new Set<string>();
      const publishLiveProgress = (
        stage: "preparing_context" | "analyzing_changes" | "checking_issues",
        message: string,
      ) => {
        const key = `${stage}:${message}`;
        if (publishedProgress.has(key)) return;
        publishedProgress.add(key);
        try {
          Effect.runSync(publishProgress(run, stage, message));
        } catch {
          // The review service may be closing while a child flushes its final stdout chunk.
        }
      };
      const result = yield* runProviderCommand(
        run.id,
        command,
        cwd,
        () => publishLiveProgress("analyzing_changes", "Analyzing changes"),
        (line) => {
          const event = parseModestoReviewStreamLine(command.outputMode, line);
          if (event.type === "result") {
            publishLiveProgress("checking_issues", "Checking reported issues");
          } else if (event.type === "progress") {
            publishLiveProgress(progressStage(event.message), event.message);
          }
        },
      );
      let findingCount = 0;
      let reportedError: string | null = null;
      let reviewResult: ParsedModestoReviewResult | null = null;
      let analyzingPublished = false;

      for (const line of result.stdout.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const event = parseModestoReviewStreamLine(command.outputMode, line);
        if (event.type === "result") {
          reviewResult =
            command.outputMode === "coderabbit-jsonl" && reviewResult
              ? {
                  summary: `CodeRabbit found ${reviewResult.findings.length + event.result.findings.length} issue${reviewResult.findings.length + event.result.findings.length === 1 ? "" : "s"}.`,
                  findings: [...reviewResult.findings, ...event.result.findings],
                }
              : event.result;
          latestReviewSummary = reviewResult.summary;
        } else if (event.type === "error") {
          reportedError = event.message;
        }
      }

      if (reviewResult) {
        for (const parsedFinding of reviewResult.findings) {
          if (cancelledRuns.has(run.id)) break;
          if (!analyzingPublished) {
            yield* publishProgress(run, "checking_issues", "Checking reported issues");
            analyzingPublished = true;
          }
          const findingNow = new Date().toISOString();
          const finding: ReviewFinding = {
            id: ReviewFindingId.makeUnsafe(`review-finding:${randomUUID()}`),
            runId: run.id,
            threadId: run.threadId,
            provider: run.provider,
            ...parsedFinding,
            status: "open",
            createdAt: findingNow,
            updatedAt: findingNow,
          };
          yield* repository.createFinding(finding);
          findingCount += 1;
          persistedFindingCount = findingCount;
          yield* publishFinding(finding);
        }
      } else if (result.code === 0 && !reportedError) {
        reportedError = "The review runtime completed without a structured result.";
      }

      const now = new Date().toISOString();
      if (cancelledRuns.has(run.id)) {
        run = yield* repository.saveRunIfActive({
          ...run,
          status: "cancelled",
          findingCount,
          summary: null,
          error: null,
          finishedAt: now,
          updatedAt: now,
        });
        latestRun = run;
        yield* appendCancelledActivity(run);
      } else if (result.code !== 0 || reportedError) {
        const message = reviewFailureMessage({
          result,
          reportedError,
          interruptedByShutdown: shuttingDownRuns.has(run.id),
        });
        run = yield* repository.saveRunIfActive({
          ...run,
          status: "failed",
          findingCount,
          summary: reviewResult?.summary ?? null,
          error: message,
          finishedAt: now,
          updatedAt: now,
        });
        latestRun = run;
        if (run.status === "cancelled") {
          yield* appendCancelledActivity(run);
        } else if (run.status === "failed") {
          yield* appendActivity({
            run,
            kind: "review.failed",
            summary: "Code review failed",
            tone: "error",
            payload: { error: message },
          });
        }
      } else {
        run = yield* repository.saveRunIfActive({
          ...run,
          status: "completed",
          findingCount,
          summary: reviewResult?.summary ?? null,
          error: null,
          finishedAt: now,
          updatedAt: now,
        });
        latestRun = run;
        if (run.status === "cancelled") {
          yield* appendCancelledActivity(run);
        } else if (run.status === "completed") {
          yield* publishProgress(run, "review_complete", "Review complete");
          yield* appendActivity({
            run,
            kind: "review.completed",
            summary:
              reviewResult?.summary ??
              `Code review completed with ${findingCount} finding${findingCount === 1 ? "" : "s"}`,
            payload: { findingCount, provider: run.provider, reviewSummary: reviewResult?.summary },
          });
        }
      }
      cancelledRuns.delete(run.id);
      shuttingDownRuns.delete(run.id);
      yield* publishRun(run);
    }).pipe(
      Effect.catch((cause) =>
        Effect.gen(function* () {
          const now = new Date().toISOString();
          const cancelled = cancelledRuns.has(queued.id);
          const terminalRun: ReviewRun = {
            ...latestRun,
            status: cancelled ? "cancelled" : "failed",
            findingCount: persistedFindingCount,
            summary: latestReviewSummary,
            error: cancelled
              ? null
              : (cause instanceof Error ? cause.message : String(cause)).slice(0, 4_000),
            finishedAt: now,
            updatedAt: now,
          };
          const failed = yield* repository.saveRunIfActive(terminalRun).pipe(
            Effect.catch((persistenceCause) =>
              Effect.logError("Failed to persist terminal review state.", {
                cause: persistenceCause,
              }).pipe(Effect.as(terminalRun)),
            ),
          );
          cancelledRuns.delete(queued.id);
          shuttingDownRuns.delete(queued.id);
          activeProcesses.delete(queued.id);
          yield* publishRun(failed);
          if (failed.status === "failed") {
            yield* appendActivity({
              run: failed,
              kind: "review.failed",
              summary: "Code review failed",
              tone: "error",
              payload: { error: failed.error ?? "Unexpected review failure." },
            }).pipe(Effect.catch(() => Effect.void));
          } else if (failed.status === "cancelled") {
            yield* appendCancelledActivity(failed);
          }
        }),
      ),
      Effect.onInterrupt(() =>
        Effect.gen(function* () {
          const now = new Date().toISOString();
          const cancelled = cancelledRuns.has(queued.id) && !shuttingDown;
          const terminalRun: ReviewRun = {
            ...latestRun,
            status: cancelled ? "cancelled" : "failed",
            findingCount: persistedFindingCount,
            summary: latestReviewSummary,
            error: cancelled ? null : "Review interrupted by Modesto shutdown.",
            finishedAt: now,
            updatedAt: now,
          };
          const interrupted = yield* repository.saveRunIfActive(terminalRun).pipe(
            Effect.catch((persistenceCause) =>
              Effect.logError("Failed to persist interrupted review state.", {
                cause: persistenceCause,
              }).pipe(Effect.as(terminalRun)),
            ),
          );
          cancelledRuns.delete(queued.id);
          shuttingDownRuns.delete(queued.id);
          activeProcesses.delete(queued.id);
          yield* publishRun(interrupted).pipe(Effect.catch(() => Effect.void));
          if (interrupted.status === "cancelled") {
            yield* appendCancelledActivity(interrupted);
          } else if (interrupted.status === "failed") {
            yield* appendActivity({
              run: interrupted,
              kind: "review.failed",
              summary: "Code review failed",
              tone: "error",
              payload: {
                error: interrupted.error ?? "Review interrupted by Modesto shutdown.",
              },
            }).pipe(Effect.catch(() => Effect.void));
          }
        }),
      ),
      Effect.ensuring(
        command.cleanup
          ? Effect.sync(command.cleanup).pipe(Effect.catch(() => Effect.void))
          : Effect.void,
      ),
    );
  };

  const providers: ReviewServiceShape["providers"] = () =>
    Effect.all(
      listReviewProviderAdapters().map((adapter) => adapter.availability()),
      { concurrency: "unbounded" },
    ).pipe(
      Effect.map((availableProviders) => ({ providers: availableProviders })),
      Effect.mapError(toError("Failed to load review providers.")),
    );

  const install: ReviewServiceShape["install"] = (input) =>
    Effect.tryPromise({
      try: async () => {
        const adapter = getReviewProviderAdapter(input.provider);
        if (input.action === "authenticate") {
          const current = await Effect.runPromise(adapter.availability());
          if (!current.executable) {
            throw new Error("Install CodeRabbit before signing in.");
          }
          await execFileAsync(current.executable, ["auth", "login", "--agent"], {
            timeout: 5 * 60_000,
            maxBuffer: 2 * 1024 * 1024,
            env: process.env,
          });
          const availability = await Effect.runPromise(adapter.availability());
          if (availability.authenticated !== "yes") {
            throw new Error(
              "CodeRabbit sign-in did not complete. Finish the browser flow, then try again.",
            );
          }
          return { availability };
        }
        if (process.platform === "win32") {
          throw new Error("CodeRabbit CLI installation on Windows currently requires WSL.");
        }
        await execFileAsync(
          "/bin/sh",
          ["-c", "curl -fsSL https://cli.coderabbit.ai/install.sh | sh"],
          {
            timeout: 120_000,
            maxBuffer: 2 * 1024 * 1024,
            env: process.env,
          },
        );
        const availability = await Effect.runPromise(adapter.availability());
        if (availability.installation !== "detected") {
          throw new Error(
            "CodeRabbit installed, but Modesto could not find it on PATH. Restart Modesto and recheck.",
          );
        }
        return { availability };
      },
      catch: toError("CodeRabbit could not be installed inside Modesto."),
    });

  const list: ReviewServiceShape["list"] = (input) => {
    const adapter = getReviewProviderAdapter(input.provider);
    return Effect.all(
      [
        adapter.availability(),
        repository.listRuns(input.threadId),
        repository.listFindings(input.threadId),
      ],
      { concurrency: "unbounded" },
    ).pipe(
      Effect.map(([reviewAvailability, runs, findings]) => ({
        availability: reviewAvailability,
        runs: runs.filter((run) => run.provider === input.provider),
        findings: findings.filter((finding) => finding.provider === input.provider),
      })),
      Effect.mapError(toError("Failed to load review history.")),
    );
  };

  const start: ReviewServiceShape["start"] = (input) =>
    Effect.gen(function* () {
      const adapter = getReviewProviderAdapter(input.provider);
      const reviewAvailability = yield* adapter.availability();
      if (!reviewAvailability.executable) {
        return yield* new ReviewServiceError({
          message:
            reviewAvailability.message ?? `${reviewAvailability.displayName} is unavailable.`,
        });
      }
      if (reviewAvailability.authenticated === "no") {
        return yield* new ReviewServiceError({
          message: reviewAvailability.message ?? `Connect ${reviewAvailability.displayName} first.`,
        });
      }
      const shell = yield* snapshots.getShellSnapshot();
      const thread = shell.threads.find((candidate) => candidate.id === input.threadId);
      if (!thread)
        return yield* new ReviewServiceError({ message: "Review thread was not found." });
      const cwd = resolveThreadWorkspaceCwd({ thread, projects: shell.projects });
      if (!cwd) {
        return yield* new ReviewServiceError({
          message: "The thread does not have an available workspace.",
        });
      }
      const command = yield* adapter.buildCommand(input, cwd);
      const now = new Date().toISOString();
      const run: ReviewRun = {
        id: ReviewRunId.makeUnsafe(`review-run:${randomUUID()}`),
        threadId: thread.id,
        projectId: thread.projectId,
        provider: input.provider,
        status: "queued",
        target: input.target,
        configuration: input.configuration ?? DEFAULT_MODESTO_REVIEW_CONFIGURATION,
        findingCount: 0,
        summary: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const created = yield* Effect.gen(function* () {
        const persisted = yield* repository.createRun(run);
        yield* publishRun(persisted);
        return persisted;
      }).pipe(
        Effect.onError(() =>
          command.cleanup
            ? Effect.sync(command.cleanup).pipe(Effect.catch(() => Effect.void))
            : Effect.void,
        ),
      );
      yield* processRun(created, cwd, command).pipe(Effect.forkIn(serviceScope));
      return created;
    }).pipe(Effect.mapError(toError("Failed to start code review.")));

  const cancel: ReviewServiceShape["cancel"] = (input) =>
    Effect.gen(function* () {
      const existing = yield* repository.getRun(input.runId);
      if (Option.isNone(existing)) {
        return yield* new ReviewServiceError({ message: "Review run was not found." });
      }
      const run = existing.value;
      if (run.status !== "queued" && run.status !== "running") return run;
      cancelledRuns.add(run.id);
      activeProcesses.get(run.id)?.kill("SIGTERM");
      const now = new Date().toISOString();
      const cancelled = yield* repository.saveRunIfActive({
        ...run,
        status: "cancelled",
        error: null,
        finishedAt: now,
        updatedAt: now,
      });
      if (cancelled.status !== "cancelled") cancelledRuns.delete(run.id);
      yield* publishRun(cancelled);
      return cancelled;
    }).pipe(Effect.mapError(toError("Failed to cancel code review.")));

  const ignoreFinding: ReviewServiceShape["ignoreFinding"] = (input) =>
    repository
      .setFindingIgnored({
        id: input.findingId,
        ignored: input.ignored,
        updatedAt: new Date().toISOString(),
      })
      .pipe(
        Effect.tap(publishFinding),
        Effect.mapError(toError("Failed to update the review finding.")),
      );

  return {
    providers,
    install,
    list,
    start,
    cancel,
    ignoreFinding,
    streamEvents: Stream.fromPubSub(events),
  } satisfies ReviewServiceShape;
});

export const ReviewServiceLive = Layer.effect(ReviewService, makeReviewService);
