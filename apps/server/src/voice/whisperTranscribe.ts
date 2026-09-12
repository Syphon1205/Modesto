// FILE: whisperTranscribe.ts
// Purpose: Runs one recorded clip through the local whisper.cpp executable.
// Layer: Server utility
// Exports: whisperTranscribeArgs, parseWhisperTranscript, transcribeWithWhisper
// Depends on: ProcessRunner for the spawn, node fs for the scratch clip.
//
// The clip is written to a scratch file because whisper.cpp reads audio from a
// path, not stdin. It is removed in a `finally` so a failed run cannot leave
// recorded audio sitting on disk - the recording is the most sensitive thing
// this feature touches, and it should outlive the transcription by nothing.
//
// Output is taken from stdout with `-np -nt`, which prints the transcript and
// nothing else. The alternative (`-oj`, a JSON sidecar file) means a second
// file to write, read, and clean up for a payload that is one string.

import { randomUUID } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import type { ServerVoiceTranscriptionInput } from "@modesto/contracts";

import * as ProcessRunner from "../processRunner.ts";
import { decodeVoiceAudio } from "./voiceAudio.ts";
import type { WhisperModel } from "./whisperCatalog.ts";

/**
 * A two-minute clip on the default model finishes in seconds on any machine
 * with a GPU and well inside a minute on CPU. Five minutes is the point past
 * which something has gone wrong rather than slow.
 */
const TRANSCRIBE_TIMEOUT = Duration.minutes(5);

export function whisperTranscribeArgs(input: {
  readonly modelPath: string;
  readonly audioPath: string;
  readonly englishOnly: boolean;
  readonly threads: number;
}): ReadonlyArray<string> {
  return [
    "--model",
    input.modelPath,
    "--file",
    input.audioPath,
    // Print the transcript alone: no banner, no timing table, no timestamps.
    "--no-prints",
    "--no-timestamps",
    "--threads",
    String(input.threads),
    // An English-only model cannot do anything else, and saying so skips the
    // language-detection pass. Multilingual models are left on auto-detect.
    ...(input.englishOnly ? ["--language", "en"] : ["--language", "auto"]),
  ];
}

/**
 * Cleans the engine's stdout into a transcript.
 *
 * whisper.cpp emits bracketed markers for non-speech - `[BLANK_AUDIO]`,
 * `(silence)`, music cues - and a recording of someone changing their mind
 * mid-press is mostly those. Stripping them turns "a stray marker got typed
 * into my prompt" into an empty result the caller can ignore.
 */
export function parseWhisperTranscript(stdout: string): string {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\[[A-Z_ ]+\]/g, "").replace(/\((?:silence|music)\)/gi, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Half the cores, floored at one and capped at eight: enough to be quick without starving the agent processes sharing this host. */
export function whisperThreadCount(cpuCount: number): number {
  return Math.max(1, Math.min(8, Math.floor(cpuCount / 2) || 1));
}

export const transcribeWithWhisper = Effect.fn("voice.whisper.transcribe")(function* (input: {
  readonly request: ServerVoiceTranscriptionInput;
  readonly binaryPath: string;
  readonly modelPath: string;
  readonly model: WhisperModel;
}) {
  const runner = yield* ProcessRunner.ProcessRunner;

  const audioBuffer = yield* Effect.try({
    try: () => decodeVoiceAudio(input.request),
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });

  const audioPath = nodePath.join(nodeOs.tmpdir(), `modesto-voice-${randomUUID()}.wav`);

  return yield* Effect.acquireUseRelease(
    Effect.promise(() => fsp.writeFile(audioPath, audioBuffer)).pipe(Effect.as(audioPath)),
    (path) =>
      Effect.gen(function* () {
        const result = yield* runner
          .run({
            command: input.binaryPath,
            args: [
              ...whisperTranscribeArgs({
                modelPath: input.modelPath,
                audioPath: path,
                englishOnly: input.model.englishOnly,
                threads: whisperThreadCount(nodeOs.cpus().length),
              }),
            ],
            timeout: TRANSCRIBE_TIMEOUT,
            timeoutBehavior: "timedOutResult",
          })
          .pipe(
            Effect.mapError(
              (cause) =>
                new Error(
                  `The speech engine could not be run. ${
                    cause instanceof Error ? cause.message : String(cause)
                  }`,
                  { cause },
                ),
            ),
          );

        if (result.timedOut) {
          return yield* Effect.fail(new Error("Transcription took too long and was stopped."));
        }
        if (result.code !== 0) {
          // The engine's own last line is far more useful than an exit code -
          // a missing Metal shader or an unreadable model both land here.
          const detail = firstMeaningfulLine(result.stderr) ?? `exit code ${result.code}`;
          return yield* Effect.fail(new Error(`The speech engine failed: ${detail}`));
        }

        return parseWhisperTranscript(result.stdout);
      }),
    (path) => Effect.promise(() => fsp.rm(path, { force: true })),
  );
});

function firstMeaningfulLine(stderr: string): string | null {
  const line = stderr
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .at(-1);
  return line ?? null;
}
