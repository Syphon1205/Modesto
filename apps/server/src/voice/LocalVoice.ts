// FILE: LocalVoice.ts
// Purpose: Modesto Voice's speech service - status, model install, transcription.
// Layer: Server service
// Exports: LocalVoice, layer
// Depends on: ServerConfig for the data dir, ServerSettingsService for the
//             chosen model, ProcessRunner for the engine spawn.
//
// Everything here runs on the machine hosting the server. There is no speech
// vendor, no API key, and no audio leaving the host: the clip is written to a
// scratch file, handed to a local whisper.cpp process, and deleted. That is
// the whole point of the feature, so the service exposes no remote fallback -
// there is nothing to fall back to, and an "offline" feature that quietly
// posts audio somewhere the first time it struggles would be a lie.
//
// Install progress lives in a Ref rather than on disk because it only
// describes an in-flight fetch. Everything durable is answered by looking at
// the file: a restart mid-download reports `missing` with the partial byte
// count, which is exactly true.

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";

import {
  DEFAULT_SERVER_SETTINGS,
  DEFAULT_VOICE_MODEL_ID,
  type ServerVoiceStatus,
  type ServerVoiceTranscriptionInput,
  type ServerVoiceTranscriptionResult,
  type VoiceModelId,
  type VoiceSettings,
} from "@modesto/contracts";
import { HostProcessPlatform } from "@modesto/shared/hostProcess";

import { ServerConfig } from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";
import * as ServerSettings from "../serverSettings.ts";
import { resolveWhisperBinary, whisperInstallHint } from "./whisperBinary.ts";
import { whisperModel } from "./whisperCatalog.ts";
import {
  downloadWhisperModel,
  readWhisperModelState,
  whisperModelPaths,
} from "./whisperModelStore.ts";
import { transcribeWithWhisper } from "./whisperTranscribe.ts";

/** The in-flight half of the model state; the durable half is the file itself. */
interface InstallProgress {
  readonly modelId: VoiceModelId;
  readonly downloadedBytes: number;
  readonly phase: "downloading" | "verifying";
}

export class LocalVoice extends Context.Service<
  LocalVoice,
  {
    readonly status: Effect.Effect<ServerVoiceStatus>;
    readonly installModel: (modelId: VoiceModelId) => Effect.Effect<ServerVoiceStatus>;
    readonly transcribe: (
      input: ServerVoiceTranscriptionInput,
    ) => Effect.Effect<ServerVoiceTranscriptionResult, Error>;
  }
>()("modesto/voice/LocalVoice") {}

export const make = Effect.gen(function* () {
  const config = yield* ServerConfig;
  const settingsService = yield* ServerSettings.ServerSettingsService;
  const platform = yield* HostProcessPlatform;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runner = yield* ProcessRunner.ProcessRunner;

  const installProgress = yield* Ref.make<InstallProgress | null>(null);
  const installFailure = yield* Ref.make<string | null>(null);
  const installFiber = yield* Ref.make<Fiber.Fiber<void, never> | null>(null);

  const voiceSettings: Effect.Effect<VoiceSettings> = settingsService.getSettings.pipe(
    Effect.map((settings) => settings.voice),
    // Voice must still report a truthful status when the settings file is
    // unreadable; falling back to the defaults keeps the panel diagnostic
    // instead of blank.
    Effect.orElseSucceed(() => DEFAULT_SERVER_SETTINGS.voice),
  );

  const resolveEngine = Effect.fn("voice.resolve_engine")(function* () {
    const settings = yield* voiceSettings;
    return yield* resolveWhisperBinary({
      baseDir: config.baseDir,
      ...(settings.binaryPath ? { configuredPath: settings.binaryPath } : {}),
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.orElseSucceed(() => null),
    );
  });

  const status: Effect.Effect<ServerVoiceStatus> = Effect.gen(function* () {
    const settings = yield* voiceSettings;
    const modelId = settings.modelId ?? DEFAULT_VOICE_MODEL_ID;
    const model = whisperModel(modelId);
    const [engine, diskState, progress, failure] = yield* Effect.all([
      resolveEngine(),
      Effect.promise(() => readWhisperModelState(config.baseDir, model)),
      Ref.get(installProgress),
      Ref.get(installFailure),
    ]);

    const inFlight = progress?.modelId === settings.modelId ? progress : null;
    const modelState =
      diskState.kind === "ready"
        ? ("ready" as const)
        : inFlight
          ? inFlight.phase
          : failure !== null
            ? ("failed" as const)
            : ("missing" as const);

    return {
      engine: {
        state: engine ? ("ready" as const) : ("missing" as const),
        path: engine?.path ?? null,
        hint: engine ? null : whisperInstallHint(platform),
      },
      model: {
        id: modelId,
        state: modelState,
        downloadedBytes: inFlight?.downloadedBytes ?? diskState.bytes,
        totalBytes: model.bytes,
        error: modelState === "failed" ? failure : null,
      },
      ready: engine !== null && diskState.kind === "ready",
    } satisfies ServerVoiceStatus;
  });

  const installModel = (modelId: VoiceModelId): Effect.Effect<ServerVoiceStatus> =>
    Effect.gen(function* () {
      const running = yield* Ref.get(installFiber);
      const current = yield* Ref.get(installProgress);
      // Idempotent while the same model is already coming down. A second
      // press should not start a competing writer against the same partial
      // file, and the caller is already polling for the answer.
      if (running !== null && current?.modelId === modelId) {
        return yield* status;
      }
      if (running !== null) {
        yield* Fiber.interrupt(running);
      }

      const model = whisperModel(modelId);
      yield* settingsService.updateSettings({ voice: { modelId } }).pipe(
        // A settings write failing must not block the download: the file is
        // the durable half, and status still reports this model while the
        // install is in flight.
        Effect.catch(() => Effect.void),
      );
      yield* Ref.set(installFailure, null);
      yield* Ref.set(installProgress, {
        modelId,
        downloadedBytes: 0,
        phase: "downloading" as const,
      });

      const run = Effect.tryPromise({
        try: () =>
          downloadWhisperModel({
            baseDir: config.baseDir,
            model,
            onProgress: (downloadedBytes) => {
              // Fire-and-forget: progress is advisory, and awaiting a Ref
              // write per chunk would throttle the download to describe it.
              Effect.runSync(
                Ref.set(installProgress, {
                  modelId,
                  downloadedBytes,
                  phase: "downloading" as const,
                }),
              );
            },
          }),
        catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      }).pipe(
        // The message is the user's only account of what went wrong, and
        // `downloadWhisperModel` already words its failures for them.
        Effect.catch((error: Error) => Ref.set(installFailure, error.message)),
        Effect.catchDefect((defect: unknown) =>
          Ref.set(installFailure, defect instanceof Error ? defect.message : String(defect)),
        ),
        Effect.ensuring(
          Ref.set(installProgress, null).pipe(Effect.andThen(Ref.set(installFiber, null))),
        ),
      );

      const fiber = yield* Effect.forkChild(run);
      yield* Ref.set(installFiber, fiber);
      return yield* status;
    });

  const transcribe = (
    input: ServerVoiceTranscriptionInput,
  ): Effect.Effect<ServerVoiceTranscriptionResult, Error> =>
    Effect.gen(function* () {
      const settings = yield* voiceSettings;
      const modelIdToUse = settings.modelId ?? DEFAULT_VOICE_MODEL_ID;
      const model = whisperModel(modelIdToUse);
      const engine = yield* resolveEngine();
      if (engine === null) {
        return yield* Effect.fail(new Error(whisperInstallHint(platform)));
      }

      const diskState = yield* Effect.promise(() => readWhisperModelState(config.baseDir, model));
      if (diskState.kind !== "ready") {
        return yield* Effect.fail(
          new Error(`The ${model.label} speech model is not installed yet.`),
        );
      }

      const text = yield* transcribeWithWhisper({
        request: input,
        binaryPath: engine.path,
        modelPath: whisperModelPaths(config.baseDir, model).filePath,
        model,
      }).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.provideService(ProcessRunner.ProcessRunner, runner),
      );

      if (text.length === 0) {
        return yield* Effect.fail(new Error("Nothing was said in that recording."));
      }
      return { text } satisfies ServerVoiceTranscriptionResult;
    });

  return LocalVoice.of({ status, installModel, transcribe });
});

export const layer = Layer.effect(LocalVoice, make).pipe(Layer.provide(ProcessRunner.layer));
