import { ThreadId, type ReviewConfiguration, type ReviewTarget } from "@modesto/contracts";
import { Data, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { getReviewProviderAdapter } from "./Layers/ReviewProviderAdapters.ts";
import {
  parseModestoReviewStreamLine,
  type ParsedModestoReviewResult,
} from "./modestoReviewOutput.ts";
import { DEFAULT_MODESTO_REVIEW_CONFIGURATION } from "./modestoReviewPrompt.ts";
import { startReviewProcess } from "./reviewProcess.ts";

export class ModestoReviewCliError extends Data.TaggedError("ModestoReviewCliError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

type CliTarget = "file" | "pull-request" | "repository" | "staged" | "uncommitted";

export function resolveCliReviewTarget(input: {
  readonly target: CliTarget;
  readonly file?: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly pullRequest?: number;
  readonly base?: string;
}): ReviewTarget {
  if (input.target === "uncommitted") return { type: "uncommittedChanges" };
  if (input.target === "staged") return { type: "stagedChanges" };
  if (input.target === "repository") return { type: "repository" };
  if (input.target === "file") {
    const file = input.file?.trim();
    if (!file) throw new ModestoReviewCliError({ message: "--file is required for file reviews." });
    if (input.startLine !== undefined) {
      if (input.startLine < 1 || (input.endLine !== undefined && input.endLine < input.startLine)) {
        throw new ModestoReviewCliError({
          message:
            "Review line numbers must be positive and --end-line cannot precede --start-line.",
        });
      }
      return {
        type: "selectedCode",
        file,
        startLine: input.startLine,
        endLine: input.endLine ?? input.startLine,
      };
    }
    return { type: "currentFile", file };
  }
  const number = input.pullRequest;
  const baseBranch = input.base?.trim();
  if (!number || !baseBranch) {
    throw new ModestoReviewCliError({
      message: "--pull-request and --base are required for pull-request reviews.",
    });
  }
  return { type: "pullRequest", number, baseBranch };
}

export function renderCliReviewResult(result: ParsedModestoReviewResult): string {
  const lines = [result.summary];
  for (const finding of result.findings) {
    const location = finding.startLine ? `${finding.file}:${finding.startLine}` : finding.file;
    lines.push(
      "",
      `[${finding.severity.toUpperCase()}] ${finding.title}`,
      location,
      finding.explanation,
    );
    if (finding.suggestedFix) lines.push(`Suggested fix: ${finding.suggestedFix}`);
  }
  return lines.join("\n");
}

const reviewCommand = Command.make(
  "review",
  {
    runtime: Flag.choice("runtime", ["codex", "cursor"]).pipe(
      Flag.withDefault("codex"),
      Flag.withDescription("Local agent runtime used for the review."),
    ),
    model: Flag.string("model").pipe(
      Flag.optional,
      Flag.withDescription("Optional runtime model override."),
    ),
    depth: Flag.choice("depth", ["quick", "standard", "deep"]).pipe(
      Flag.withDefault("standard"),
      Flag.withDescription("Review breadth and reasoning depth."),
    ),
    target: Flag.choice("target", [
      "uncommitted",
      "staged",
      "repository",
      "file",
      "pull-request",
    ]).pipe(Flag.withDefault("uncommitted"), Flag.withDescription("Code or Git state to review.")),
    file: Flag.string("file").pipe(
      Flag.optional,
      Flag.withDescription("Repository-relative file for --target file."),
    ),
    startLine: Flag.integer("start-line").pipe(
      Flag.optional,
      Flag.withDescription("First line for a selected-code review."),
    ),
    endLine: Flag.integer("end-line").pipe(
      Flag.optional,
      Flag.withDescription("Last line for a selected-code review."),
    ),
    pullRequest: Flag.integer("pull-request").pipe(
      Flag.optional,
      Flag.withDescription("Pull request number for --target pull-request."),
    ),
    base: Flag.string("base").pipe(
      Flag.optional,
      Flag.withDescription("Base branch for a pull request review."),
    ),
    json: Flag.boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print structured review JSON."),
    ),
  },
  (flags) =>
    Effect.gen(function* () {
      const target = yield* Effect.try({
        try: () => {
          const file = Option.getOrUndefined(flags.file);
          const startLine = Option.getOrUndefined(flags.startLine);
          const endLine = Option.getOrUndefined(flags.endLine);
          const pullRequest = Option.getOrUndefined(flags.pullRequest);
          const base = Option.getOrUndefined(flags.base);
          return resolveCliReviewTarget({
            target: flags.target,
            ...(file !== undefined ? { file } : {}),
            ...(startLine !== undefined ? { startLine } : {}),
            ...(endLine !== undefined ? { endLine } : {}),
            ...(pullRequest !== undefined ? { pullRequest } : {}),
            ...(base !== undefined ? { base } : {}),
          });
        },
        catch: (cause) =>
          cause instanceof ModestoReviewCliError
            ? cause
            : new ModestoReviewCliError({
                message: "Invalid review target.",
                cause,
              }),
      });
      const configuration: ReviewConfiguration = {
        ...DEFAULT_MODESTO_REVIEW_CONFIGURATION,
        runtime: flags.runtime,
        model: Option.getOrElse(flags.model, () => ""),
        depth: flags.depth,
      };
      const adapter = getReviewProviderAdapter("modesto");
      const command = yield* adapter
        .buildCommand(
          {
            threadId: ThreadId.makeUnsafe("modesto-review-cli"),
            provider: "modesto",
            target,
            configuration,
          },
          process.cwd(),
        )
        .pipe(
          Effect.mapError(
            (cause) =>
              new ModestoReviewCliError({
                message: cause.message,
                cause,
              }),
          ),
        );

      return yield* Effect.tryPromise({
        try: async () => {
          let parsedResult: ParsedModestoReviewResult | null = null;
          let reportedError: string | null = null;
          let interrupted = false;
          const publishedProgress = new Set<string>();
          const execution = startReviewProcess({
            command,
            cwd: process.cwd(),
            onStdoutLine: (line) => {
              const event = parseModestoReviewStreamLine(command.outputMode, line);
              if (event.type === "progress") {
                if (publishedProgress.has(event.message)) return;
                publishedProgress.add(event.message);
                console.error(
                  flags.json
                    ? JSON.stringify({ type: "progress", message: event.message })
                    : `Review: ${event.message}`,
                );
              } else if (event.type === "result") {
                parsedResult = event.result;
              } else if (event.type === "error") {
                reportedError = event.message;
              }
            },
          });
          const interrupt = () => {
            interrupted = true;
            execution.child.kill("SIGTERM");
          };
          const cleanup = () => command.cleanup?.();
          process.once("SIGINT", interrupt);
          process.once("exit", cleanup);
          try {
            const result = await execution.result;
            if (result.code !== 0 || reportedError) {
              throw new ModestoReviewCliError({
                message:
                  (interrupted ? "Review interrupted." : reportedError) ??
                  (result.outputLimitExceeded
                    ? "Review produced more output than Modesto can safely process."
                    : result.timedOut
                      ? `Review exceeded the ${flags.depth} time limit.`
                      : result.stderr.trim().slice(0, 4_000) ||
                        `Review runtime exited with code ${result.code}.`),
              });
            }
            if (!parsedResult) {
              throw new ModestoReviewCliError({
                message: "Review runtime completed without a structured result.",
              });
            }
            console.log(
              flags.json
                ? JSON.stringify(parsedResult, null, 2)
                : renderCliReviewResult(parsedResult),
            );
          } finally {
            process.off("SIGINT", interrupt);
            process.off("exit", cleanup);
            cleanup();
          }
        },
        catch: (cause) =>
          cause instanceof ModestoReviewCliError
            ? cause
            : new ModestoReviewCliError({
                message: cause instanceof Error ? cause.message : String(cause),
                cause,
              }),
      });
    }),
).pipe(Command.withDescription("Run a structured Modesto code review in the current repository."));

export const modestoReviewCommand = reviewCommand;
