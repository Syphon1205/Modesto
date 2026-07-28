import type { ReviewAvailability, ReviewProvider, ReviewStartInput } from "@modesto/contracts";
import type { Effect } from "effect";

import type { ModestoReviewOutputMode } from "../modestoReviewOutput.ts";
import type { ReviewServiceError } from "../Errors.ts";

export interface ReviewProviderCommand {
  readonly executable: string;
  readonly args: ReadonlyArray<string>;
  readonly outputMode: ModestoReviewOutputMode;
  readonly timeoutMs: number;
  readonly cleanup?: () => void;
}

export interface ReviewProviderAdapter {
  readonly provider: ReviewProvider;
  readonly availability: () => Effect.Effect<ReviewAvailability>;
  readonly buildCommand: (
    input: ReviewStartInput,
    cwd: string,
  ) => Effect.Effect<ReviewProviderCommand, ReviewServiceError>;
}
