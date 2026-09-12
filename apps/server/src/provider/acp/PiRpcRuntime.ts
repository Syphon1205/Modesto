// FILE: PiRpcRuntime.ts
// Purpose: A small, purpose-built JSON-RPC-over-stdio runtime for Pi's own
//          RPC protocol (`pi --mode rpc`), NOT the Agent Client Protocol -
//          this is a genuinely different wire format from every other
//          provider in this tree (Cursor, Grok, GitHub Copilot, Factory
//          Droid, Custom ACP Agent all speak ACP via the shared
//          AcpSessionRuntime/effect-acp; Pi does not implement ACP at all).
//
//          Protocol source of truth: this package's own vendored docs at
//          node_modules/@earendil-works/pi-coding-agent/docs/rpc.md (read in
//          full while building this file) and node_modules/@earendil-works/
//          pi-coding-agent/dist/cli.js --help (run live on this machine -
//          the real, installed v0.74.0 binary, not just docs). Every command/
//          event shape below traces back to one of those two sources.
//
//          Framing is intentionally hand-rolled rather than using
//          `node:readline`: the protocol doc explicitly warns that
//          `readline` is not compliant here because it also splits on
//          U+2028/U+2029, which are valid *inside* JSON strings and would
//          corrupt a message that happens to contain them. Split on `\n`
//          only, and strip an optional trailing `\r` - exactly the framing
//          the doc's own reference Node.js client uses.
//
//          Uses raw `node:child_process.spawn` rather than this tree's
//          `effect/unstable/process` `ChildProcessSpawner` service: that
//          service's higher-level helpers are built for the
//          request/response and one-shot-command shapes used elsewhere in
//          this tree, not a long-lived bidirectional JSONL stream with a
//          bespoke framing rule. The primary Modesto tree's own Gemini
//          adapter takes the same approach for its bespoke (non-ACP)
//          protocol, for the same reason. The process lifecycle is still
//          wrapped in `Effect.acquireRelease` for proper scope-based
//          cleanup, matching this tree's idioms elsewhere.
// @module provider/acp/PiRpcRuntime

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import * as StringDecoderModule from "node:string_decoder";

import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

export class PiRpcError extends Schema.TaggedErrorClass<PiRpcError>()("PiRpcError", {
  detail: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export interface PiRpcSpawnInput {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
}

/** Any JSONL record pi RPC mode writes to stdout: a `response` (has `id`,
 * correlates to a sent command) or an event (no `id`). Left as a loosely
 * typed record - see rpc.md for the full real shape catalog per `type`;
 * PiAdapter.ts narrows the fields it actually consumes. */
export type PiRpcRecord = Readonly<Record<string, unknown>> & { readonly type: string };

export interface PiRpcRuntimeOptions {
  readonly spawn: PiRpcSpawnInput;
}

export class PiRpcRuntime extends Context.Service<
  PiRpcRuntime,
  {
    /** Sends a command (assigns a fresh `id` if the caller didn't set one)
     * and waits for the matching `{"type":"response", id, ...}` record. */
    readonly sendCommand: (
      command: Record<string, unknown>,
    ) => Effect.Effect<PiRpcRecord, PiRpcError>;
    /** Every record without an `id` - i.e. every real agent event. */
    readonly getEvents: () => Stream.Stream<PiRpcRecord>;
    /** True once the child process has exited (crash or graceful). */
    readonly hasExited: Effect.Effect<boolean>;
  }
>()("modesto/provider/acp/PiRpcRuntime") {}

function attachJsonlReader(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
  // Ported directly from rpc.md's own reference implementation - hand-rolled
  // on purpose, see the module header for why `node:readline` is unsafe here.
  const decoder = new StringDecoderModule.StringDecoder("utf8");
  let buffer = "";

  stream.on("data", (chunk: Buffer | string) => {
    buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) break;

      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.trim()) onLine(line);
    }
  });

  stream.on("end", () => {
    buffer += decoder.end();
    const remaining = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
    if (remaining.trim()) onLine(remaining);
  });
}

export const layer = (
  options: PiRpcRuntimeOptions,
): Layer.Layer<PiRpcRuntime, PiRpcError, Scope.Scope> =>
  Layer.effect(
    PiRpcRuntime,
    Effect.gen(function* () {
      const child: ChildProcessWithoutNullStreams = yield* Effect.acquireRelease(
        Effect.try({
          try: () =>
            spawn(options.spawn.command, options.spawn.args, {
              cwd: options.spawn.cwd,
              env: options.spawn.env ?? process.env,
              stdio: ["pipe", "pipe", "pipe"],
            }),
          catch: (cause) =>
            new PiRpcError({ detail: `Failed to spawn '${options.spawn.command}'.`, cause }),
        }),
        (proc) =>
          Effect.gen(function* () {
            if (proc.killed || proc.exitCode !== null) {
              return;
            }
            proc.kill("SIGTERM");
            yield* Effect.sleep("1 second");
            if (!proc.killed && proc.exitCode === null) {
              proc.kill("SIGKILL");
            }
          }).pipe(Effect.ignore),
      );

      const exitedRef = yield* Ref.make(false);
      const eventsPubSub = yield* PubSub.unbounded<PiRpcRecord>();
      const pendingByRequestId = yield* Ref.make(
        new Map<string, Deferred.Deferred<PiRpcRecord, PiRpcError>>(),
      );
      const stderrTailRef = yield* Ref.make("");

      attachJsonlReader(child.stdout, (line) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          return;
        }
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
        const record = parsed as PiRpcRecord;
        const id = (record as { readonly id?: unknown }).id;
        if (record.type === "response" && typeof id === "string") {
          Effect.runFork(
            Ref.get(pendingByRequestId).pipe(
              Effect.flatMap((pending) => {
                const deferred = pending.get(id);
                if (!deferred) return Effect.void;
                return Deferred.succeed(deferred, record).pipe(
                  Effect.tap(() =>
                    Ref.update(pendingByRequestId, (current) => {
                      const next = new Map(current);
                      next.delete(id);
                      return next;
                    }),
                  ),
                );
              }),
            ),
          );
          return;
        }
        Effect.runFork(PubSub.publish(eventsPubSub, record));
      });

      child.stderr.on("data", (chunk: Buffer) => {
        Effect.runFork(
          Ref.update(stderrTailRef, (current) =>
            `${current}${chunk.toString("utf8")}`.slice(-4000),
          ),
        );
      });

      child.on("exit", () => {
        Effect.runFork(
          Effect.gen(function* () {
            yield* Ref.set(exitedRef, true);
            const pending = yield* Ref.get(pendingByRequestId);
            const stderrTail = yield* Ref.get(stderrTailRef);
            yield* Effect.forEach(
              Array.from(pending.values()),
              (deferred) =>
                Deferred.fail(
                  deferred,
                  new PiRpcError({
                    detail: `Pi RPC process exited before responding.${stderrTail ? ` stderr: ${stderrTail}` : ""}`,
                  }),
                ).pipe(Effect.ignore),
              { discard: true },
            );
            yield* PubSub.shutdown(eventsPubSub);
          }),
        );
      });

      let nextRequestId = 0;

      const sendCommand = (
        command: Record<string, unknown>,
      ): Effect.Effect<PiRpcRecord, PiRpcError> =>
        Effect.gen(function* () {
          if (yield* Ref.get(exitedRef)) {
            return yield* new PiRpcError({ detail: "Pi RPC process has already exited." });
          }
          const requestId =
            typeof command.id === "string" && command.id.trim()
              ? command.id
              : `pi-rpc-${nextRequestId++}`;
          const deferred = yield* Deferred.make<PiRpcRecord, PiRpcError>();
          yield* Ref.update(pendingByRequestId, (current) => {
            const next = new Map(current);
            next.set(requestId, deferred);
            return next;
          });
          yield* Effect.try({
            try: () => {
              child.stdin.write(`${JSON.stringify({ ...command, id: requestId })}\n`);
            },
            catch: (cause) =>
              new PiRpcError({ detail: "Failed to write to Pi RPC process stdin.", cause }),
          }).pipe(
            Effect.tapError(() =>
              Ref.update(pendingByRequestId, (current) => {
                const next = new Map(current);
                next.delete(requestId);
                return next;
              }),
            ),
          );
          return yield* Deferred.await(deferred);
        });

      return PiRpcRuntime.of({
        sendCommand,
        getEvents: () => Stream.fromPubSub(eventsPubSub),
        hasExited: Ref.get(exitedRef),
      });
    }),
  );
