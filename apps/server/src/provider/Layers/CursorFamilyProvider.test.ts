import * as NodeAssert from "node:assert/strict";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { KimiSettings, PoolsideSettings, QwenSettings } from "@modesto/contracts";

import {
  KIMI_FAMILY_DESCRIPTOR,
  POOLSIDE_FAMILY_DESCRIPTOR,
  QWEN_FAMILY_DESCRIPTOR,
} from "../cursorFamily.ts";
import {
  buildInitialCursorFamilyProviderSnapshot,
  checkCursorFamilyProviderStatus,
} from "./CursorFamilyProvider.ts";

const decodeKimiSettings = Schema.decodeSync(KimiSettings);
const decodeQwenSettings = Schema.decodeSync(QwenSettings);
const decodePoolsideSettings = Schema.decodeSync(PoolsideSettings);

const testLayer = NodeServices.layer;

/**
 * A PATH with nothing on it, so a probe genuinely cannot find the binary.
 * `checkCursorFamilyProviderStatus` is otherwise free to pick up a real
 * `kimi`/`qwen`/`pool` install on the developer's machine and take a
 * different branch.
 */
const emptyEnvironment: NodeJS.ProcessEnv = {
  PATH: nodePath.join(nodeOs.tmpdir(), "modesto-nonexistent-bin-dir"),
};

it.layer(testLayer)("cursor family provider snapshots", (it) => {
  it.effect("reports a disabled instance without probing anything", () =>
    Effect.gen(function* () {
      const snapshot = yield* checkCursorFamilyProviderStatus(
        KIMI_FAMILY_DESCRIPTOR,
        decodeKimiSettings({ enabled: false }),
        emptyEnvironment,
      );

      NodeAssert.equal(snapshot.enabled, false);
      NodeAssert.equal(snapshot.status, "disabled");
      NodeAssert.equal(snapshot.message, "Kimi is disabled in Modesto settings.");
    }),
  );

  it.effect("reports a missing CLI with the provider's own binary name", () =>
    Effect.gen(function* () {
      const snapshot = yield* checkCursorFamilyProviderStatus(
        QWEN_FAMILY_DESCRIPTOR,
        decodeQwenSettings({ enabled: true }),
        emptyEnvironment,
      );

      NodeAssert.equal(snapshot.status, "error");
      NodeAssert.equal(snapshot.installed, false);
      NodeAssert.equal(snapshot.message, "Qwen Code CLI (`qwen`) is not installed or not on PATH.");
    }),
  );

  it.effect("carries the instance's custom models into the initial snapshot", () =>
    Effect.gen(function* () {
      const snapshot = yield* buildInitialCursorFamilyProviderSnapshot(
        POOLSIDE_FAMILY_DESCRIPTOR,
        decodePoolsideSettings({ enabled: true, customModels: ["pool-custom"] }),
      );

      NodeAssert.equal(snapshot.displayName, "Poolside");
      NodeAssert.equal(snapshot.badgeLabel, "Early Access");
      NodeAssert.deepEqual(
        snapshot.models.map((model) => model.slug),
        ["pool-custom"],
      );
    }),
  );
});
