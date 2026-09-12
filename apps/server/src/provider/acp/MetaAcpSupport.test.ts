import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as EffectAcpErrors from "effect-acp/errors";

import {
  applyMetaAcpModelSelection,
  buildMetaAcpSpawnInput,
  resolveMetaAcpModelId,
} from "./MetaAcpSupport.ts";

describe("resolveMetaAcpModelId", () => {
  it("drops empty model ids and trims the rest", () => {
    expect(resolveMetaAcpModelId(undefined)).toBeUndefined();
    expect(resolveMetaAcpModelId("   ")).toBeUndefined();
    expect(resolveMetaAcpModelId("  muse-spark-1.3  ")).toBe("muse-spark-1.3");
  });
});

describe("buildMetaAcpSpawnInput", () => {
  it("spawns muse --acp with an optional binary path and env", () => {
    expect(buildMetaAcpSpawnInput(undefined, "/tmp/project")).toEqual({
      command: "muse",
      args: ["--acp"],
      cwd: "/tmp/project",
    });

    expect(
      buildMetaAcpSpawnInput({ binaryPath: "/usr/local/bin/muse" }, "/tmp/project", {
        META_API_KEY: "secret",
      }),
    ).toEqual({
      command: "/usr/local/bin/muse",
      args: ["--acp"],
      cwd: "/tmp/project",
      env: {
        META_API_KEY: "secret",
      },
    });
  });
});

describe("applyMetaAcpModelSelection", () => {
  const makeRecordingRuntime = (failure?: EffectAcpErrors.AcpError) => {
    const modelCalls: Array<string> = [];
    const runtime = {
      setSessionModel: (modelId: string) =>
        Effect.gen(function* () {
          modelCalls.push(modelId);
          if (failure) return yield* failure;
          return {};
        }),
    };
    return { runtime, modelCalls };
  };

  it.effect("calls session/set_model when the requested model differs from current", () =>
    Effect.gen(function* () {
      const { runtime, modelCalls } = makeRecordingRuntime();
      const result = yield* applyMetaAcpModelSelection({
        runtime,
        currentModelId: "muse-spark-1.3",
        requestedModelId: "muse-spark-1.2",
        mapError: (cause) => cause.message,
      });
      expect(modelCalls).toEqual(["muse-spark-1.2"]);
      expect(result).toBe("muse-spark-1.2");
    }),
  );

  it.effect("skips set_model when requested matches current", () =>
    Effect.gen(function* () {
      const { runtime, modelCalls } = makeRecordingRuntime();
      const result = yield* applyMetaAcpModelSelection({
        runtime,
        currentModelId: "muse-spark-1.3",
        requestedModelId: "muse-spark-1.3",
        mapError: (cause) => cause.message,
      });
      expect(modelCalls).toEqual([]);
      expect(result).toBe("muse-spark-1.3");
    }),
  );

  it.effect("skips set_model when no model is requested", () =>
    Effect.gen(function* () {
      const { runtime, modelCalls } = makeRecordingRuntime();
      const result = yield* applyMetaAcpModelSelection({
        runtime,
        currentModelId: "muse-spark-1.3",
        requestedModelId: undefined,
        mapError: (cause) => cause.message,
      });
      expect(modelCalls).toEqual([]);
      expect(result).toBe("muse-spark-1.3");
    }),
  );

  it.effect("propagates session/set_model failures via mapError", () =>
    Effect.gen(function* () {
      const failure = EffectAcpErrors.AcpRequestError.invalidParams("session id not known");
      const { runtime } = makeRecordingRuntime(failure);
      const error = yield* Effect.flip(
        applyMetaAcpModelSelection({
          runtime,
          currentModelId: "muse-spark-1.3",
          requestedModelId: "muse-spark-1.2",
          mapError: (cause) => cause.message,
        }),
      );
      expect(error).toBe(failure.message);
    }),
  );
});
