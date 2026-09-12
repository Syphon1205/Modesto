// FILE: seenProviderModels.ts
// Purpose: Remember which provider models this install has already been shown,
//          so a model release is announced once and never again.
// Layer: Updates (storage)

import { useCallback } from "react";
import * as Schema from "effect/Schema";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { type SeenProviderModels } from "./providerModelReleases";

export const SEEN_PROVIDER_MODELS_STORAGE_KEY = "modesto:seen-provider-models:v1";

const SeenProviderModelsSchema = Schema.Struct({
  byDriver: Schema.Record(Schema.String, Schema.Array(Schema.String)),
});

const EMPTY: typeof SeenProviderModelsSchema.Type = { byDriver: {} };

export function useSeenProviderModels(): {
  readonly seen: SeenProviderModels;
  /**
   * Fold today's slugs into the record. Merging rather than replacing means a
   * provider that is temporarily down - reporting an empty or short model list
   * - cannot erase what we already recorded and make old models look new when
   * it comes back.
   */
  readonly recordSeen: (slugs: SeenProviderModels) => void;
} {
  const [document, setDocument] = useLocalStorage(
    SEEN_PROVIDER_MODELS_STORAGE_KEY,
    EMPTY,
    SeenProviderModelsSchema,
  );

  const recordSeen = useCallback(
    (slugs: SeenProviderModels) => {
      const merged: Record<string, ReadonlyArray<string>> = { ...document.byDriver };
      let changed = false;
      for (const [driver, driverSlugs] of Object.entries(slugs)) {
        const before = merged[driver] ?? [];
        const union = [...new Set([...before, ...driverSlugs])];
        if (union.length !== before.length) {
          merged[driver] = union;
          changed = true;
        } else if (merged[driver] === undefined) {
          merged[driver] = union;
          changed = true;
        }
      }
      if (!changed) return;
      setDocument({ byDriver: merged });
    },
    [document.byDriver, setDocument],
  );

  return { seen: document.byDriver, recordSeen };
}
