import { describe, expect, it } from "vitest";

import { classifyReviewProcessError, startReviewProcess } from "./reviewProcess.ts";

describe("reviewProcess", () => {
  it("streams JSONL lines and captures the process result", async () => {
    const lines: string[] = [];
    const execution = startReviewProcess({
      command: {
        executable: process.execPath,
        args: ["-e", 'console.log(JSON.stringify({type:"progress"}))'],
        outputMode: "codex-jsonl",
        timeoutMs: 1_000,
      },
      cwd: process.cwd(),
      onStdoutLine: (line) => lines.push(line),
    });

    await expect(execution.result).resolves.toMatchObject({
      code: 0,
      timedOut: false,
      outputLimitExceeded: false,
    });
    expect(lines).toEqual(['{"type":"progress"}']);
  });

  it("marks a process stopped by the configured timeout", async () => {
    const execution = startReviewProcess({
      command: {
        executable: process.execPath,
        args: ["-e", "setTimeout(() => undefined, 10_000)"],
        outputMode: "codex-jsonl",
        timeoutMs: 25,
      },
      cwd: process.cwd(),
    });

    await expect(execution.result).resolves.toMatchObject({ code: 1, timedOut: true });
  });

  it("distinguishes output limits from timeouts", () => {
    expect(
      classifyReviewProcessError({
        code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
        killed: true,
      }),
    ).toEqual({ timedOut: false, outputLimitExceeded: true });
  });
});
