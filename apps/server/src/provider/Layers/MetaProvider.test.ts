import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { MetaSettings } from "@modesto/contracts";

import { buildInitialMetaProviderSnapshot, checkMetaProviderStatus } from "./MetaProvider.ts";

const decodeMetaSettings = Schema.decodeSync(MetaSettings);

describe("buildInitialMetaProviderSnapshot", () => {
  it.effect("returns a disabled snapshot when settings.enabled is false", () =>
    Effect.gen(function* () {
      const snapshot = yield* buildInitialMetaProviderSnapshot(
        decodeMetaSettings({ enabled: false }),
      );
      expect(snapshot.enabled).toBe(false);
      expect(snapshot.status).toBe("disabled");
      expect(snapshot.installed).toBe(false);
      expect(snapshot.message).toContain("disabled");
    }),
  );

  it.effect("returns a pending snapshot with the Muse Spark catalog by default", () =>
    Effect.gen(function* () {
      const snapshot = yield* buildInitialMetaProviderSnapshot(decodeMetaSettings({}));
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.installed).toBe(true);
      expect(snapshot.status).toBe("warning");
      expect(snapshot.displayName).toBe("Meta");
      expect(snapshot.message).toContain("Checking Muse Code");
      expect(snapshot.models.map((model) => model.slug)).toEqual([
        "muse-spark-1.3",
        "muse-spark-1.3-contributor",
        "muse-spark-1.2",
        "muse-spark-1.2-contributor",
        "muse-spark-1.1",
      ]);
      expect(snapshot.models.find((model) => model.slug === "muse-spark-1.3")?.isDefault).toBe(
        true,
      );
      expect(snapshot.models.find((model) => model.slug === "muse-spark-1.1")?.isLegacy).toBe(true);
    }),
  );
});

it.layer(NodeServices.layer)("checkMetaProviderStatus", (it) => {
  it.effect("reports the binary as missing when the binary path does not resolve", () =>
    Effect.gen(function* () {
      const snapshot = yield* checkMetaProviderStatus(
        decodeMetaSettings({
          enabled: true,
          binaryPath: "/definitely/not/installed/muse-binary",
        }),
      );
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.installed).toBe(false);
      expect(snapshot.status).toBe("error");
      expect(snapshot.message).toMatch(/not installed|not on PATH|Failed to execute/);
    }),
  );

  it.effect("keeps the Spark catalog when ACP discovery is unavailable", () =>
    Effect.gen(function* () {
      const snapshot = yield* Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped({ prefix: "modesto-meta-success-" });
          const musePath = path.join(dir, "muse");
          yield* fs.writeFileString(
            musePath,
            ["#!/bin/sh", 'printf "muse 0.1.0\\n"', "exit 0", ""].join("\n"),
          );
          yield* fs.chmod(musePath, 0o755);

          return yield* checkMetaProviderStatus(
            decodeMetaSettings({ enabled: true, binaryPath: musePath }),
          );
        }),
      );

      expect(snapshot.status).toBe("warning");
      expect(snapshot.installed).toBe(true);
      expect(snapshot.models.map((model) => model.slug)).toContain("muse-spark-1.3");
      expect(snapshot.message).toContain("ACP");
    }),
  );
});
