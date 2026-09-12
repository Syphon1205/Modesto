// FILE: UnsupportedTextGeneration.ts
// Purpose: A `TextGeneration.Service` for drivers that genuinely have no
//          commit-message/PR-content/branch-name/thread-title generation
//          wired up (e.g. Factory Droid - the primary Modesto tree has none
//          for it either). `ProviderInstance.textGeneration` is a required
//          field, so every driver needs *something* here; this returns a
//          real, honest `TextGenerationError` for every operation instead of
//          silently no-op'ing or reusing an unrelated provider's session.
// @module textGeneration/UnsupportedTextGeneration

import * as Effect from "effect/Effect";
import type { ProviderDriverKind } from "@modesto/contracts";
import { TextGenerationError } from "@modesto/contracts";

import * as TextGeneration from "./TextGeneration.ts";

export function makeUnsupportedTextGeneration(
  driver: ProviderDriverKind,
): TextGeneration.TextGeneration["Service"] {
  const unsupported = (operation: string) =>
    Effect.fail(
      new TextGenerationError({
        operation,
        detail: `${driver} does not support text generation yet.`,
      }),
    );

  return {
    generateCommitMessage: () => unsupported("generateCommitMessage"),
    generatePrContent: () => unsupported("generatePrContent"),
    generateBranchName: () => unsupported("generateBranchName"),
    generateThreadTitle: () => unsupported("generateThreadTitle"),
  } satisfies TextGeneration.TextGeneration["Service"];
}
