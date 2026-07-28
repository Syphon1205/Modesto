import {
  ReviewCancelInput,
  ReviewFinding,
  ReviewIgnoreFindingInput,
  ReviewListInput,
  ReviewListResult,
  ReviewProviderListResult,
  ReviewInstallInput,
  ReviewInstallResult,
  ReviewRun,
  ReviewStartInput,
  ReviewStreamEvent,
} from "@modesto/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

import type { ReviewServiceError } from "../Errors.ts";

export interface ReviewServiceShape {
  readonly providers: () => Effect.Effect<ReviewProviderListResult, ReviewServiceError>;
  readonly install: (
    input: ReviewInstallInput,
  ) => Effect.Effect<ReviewInstallResult, ReviewServiceError>;
  readonly list: (input: ReviewListInput) => Effect.Effect<ReviewListResult, ReviewServiceError>;
  readonly start: (input: ReviewStartInput) => Effect.Effect<ReviewRun, ReviewServiceError>;
  readonly cancel: (input: ReviewCancelInput) => Effect.Effect<ReviewRun, ReviewServiceError>;
  readonly ignoreFinding: (
    input: ReviewIgnoreFindingInput,
  ) => Effect.Effect<ReviewFinding, ReviewServiceError>;
  readonly streamEvents: Stream.Stream<ReviewStreamEvent, never, never>;
}

export class ReviewService extends ServiceMap.Service<ReviewService, ReviewServiceShape>()(
  "modesto/review/Services/ReviewService",
) {}
