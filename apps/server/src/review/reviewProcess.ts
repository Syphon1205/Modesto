import { execFile, type ChildProcess } from "node:child_process";

import type { ReviewProviderCommand } from "./Services/ReviewProviderAdapter.ts";

export const REVIEW_MAX_OUTPUT_BYTES = 20_000_000;

export interface ReviewProcessResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly outputLimitExceeded: boolean;
}

export interface ReviewProcessExecution {
  readonly child: ChildProcess;
  readonly result: Promise<ReviewProcessResult>;
}

export function classifyReviewProcessError(error: unknown): {
  readonly timedOut: boolean;
  readonly outputLimitExceeded: boolean;
} {
  const outputLimitExceeded =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
  return {
    timedOut:
      !outputLimitExceeded &&
      error !== null &&
      typeof error === "object" &&
      "killed" in error &&
      error.killed === true,
    outputLimitExceeded,
  };
}

export function startReviewProcess(input: {
  readonly command: ReviewProviderCommand;
  readonly cwd: string;
  readonly onStarted?: () => void;
  readonly onStdoutLine?: (line: string) => void;
}): ReviewProcessExecution {
  let resolveResult: (result: ReviewProcessResult) => void = () => undefined;
  const result = new Promise<ReviewProcessResult>((resolve) => {
    resolveResult = resolve;
  });
  let pendingStdout = "";
  const child = execFile(
    input.command.executable,
    [...input.command.args],
    {
      cwd: input.cwd,
      timeout: input.command.timeoutMs,
      maxBuffer: REVIEW_MAX_OUTPUT_BYTES,
    },
    (error, stdout, stderr) => {
      const failure = classifyReviewProcessError(error);
      resolveResult({
        code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        stdout: String(stdout),
        stderr: String(stderr),
        ...failure,
      });
    },
  );

  child.once("spawn", () => input.onStarted?.());
  child.stdout?.on("data", (chunk: Buffer | string) => {
    pendingStdout += String(chunk);
    const lines = pendingStdout.split(/\r?\n/);
    pendingStdout = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) input.onStdoutLine?.(line);
    }
  });
  child.stdout?.once("end", () => {
    if (pendingStdout.trim()) input.onStdoutLine?.(pendingStdout);
  });

  return { child, result };
}
