import { spawn } from "node:child_process";

export interface ProcessRunOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly env?: NodeJS.ProcessEnv | undefined;
  readonly outputMode?: "error" | "truncate";
  readonly stdin?: string;
  readonly allowNonZeroExit?: boolean;
  readonly maxBufferBytes?: number;
}

export interface ProcessRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
}

const DEFAULT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

export function runProcess(
  command: string,
  args: readonly string[],
  options: ProcessRunOptions = {},
): Promise<ProcessRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: "pipe",
      shell: false,
    });
    const maxBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
    let stdout: Buffer = Buffer.alloc(0);
    let stderr: Buffer = Buffer.alloc(0);
    let timedOut = false;
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const append = (current: Buffer, chunk: Buffer): Buffer => {
      if (current.byteLength + chunk.byteLength > maxBytes) {
        if (options.outputMode === "truncate") {
          if (current.byteLength >= maxBytes) return current;
          return Buffer.concat([
            current,
            chunk.subarray(0, Math.max(0, maxBytes - current.byteLength)),
          ]);
        }
        child.kill("SIGKILL");
        throw new Error(`${command} exceeded its ${maxBytes}-byte output limit.`);
      }
      return Buffer.concat([current, chunk]);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      try {
        stdout = append(stdout, chunk);
      } catch (error) {
        fail(error);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      try {
        stderr = append(stderr, chunk);
      } catch (error) {
        fail(error);
      }
    });
    child.once("error", fail);
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result: ProcessRunResult = {
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        code,
        signal,
        timedOut,
      };
      if (!options.allowNonZeroExit && (timedOut || code !== 0)) {
        reject(
          new Error(
            `${command} ${timedOut ? "timed out" : `failed with code ${code ?? "null"}`}: ${result.stderr.trim()}`,
          ),
        );
        return;
      }
      resolve(result);
    });

    if (options.stdin !== undefined) child.stdin.end(options.stdin);
    else child.stdin.end();

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
    }, options.timeoutMs ?? 60_000);
    timer.unref();
  });
}
