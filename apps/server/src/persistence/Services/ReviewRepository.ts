import {
  ReviewFinding,
  ReviewFindingId,
  ReviewRun,
  ReviewRunId,
  ThreadId,
} from "@modesto/contracts";
import { ServiceMap } from "effect";
import type { Effect, Option } from "effect";

import type { ReviewRepositoryError } from "../Errors.ts";

export interface ReviewRepositoryShape {
  readonly createRun: (run: ReviewRun) => Effect.Effect<ReviewRun, ReviewRepositoryError>;
  readonly saveRun: (run: ReviewRun) => Effect.Effect<ReviewRun, ReviewRepositoryError>;
  readonly saveRunIfActive: (run: ReviewRun) => Effect.Effect<ReviewRun, ReviewRepositoryError>;
  readonly failStaleActiveRuns: (updatedAt: string) => Effect.Effect<void, ReviewRepositoryError>;
  readonly getRun: (
    id: ReviewRunId,
  ) => Effect.Effect<Option.Option<ReviewRun>, ReviewRepositoryError>;
  readonly createFinding: (
    finding: ReviewFinding,
  ) => Effect.Effect<ReviewFinding, ReviewRepositoryError>;
  readonly setFindingIgnored: (input: {
    readonly id: ReviewFindingId;
    readonly ignored: boolean;
    readonly updatedAt: string;
  }) => Effect.Effect<ReviewFinding, ReviewRepositoryError>;
  readonly listRuns: (
    threadId: ThreadId,
  ) => Effect.Effect<ReadonlyArray<ReviewRun>, ReviewRepositoryError>;
  readonly listFindings: (
    threadId: ThreadId,
  ) => Effect.Effect<ReadonlyArray<ReviewFinding>, ReviewRepositoryError>;
}

export class ReviewRepository extends ServiceMap.Service<ReviewRepository, ReviewRepositoryShape>()(
  "modesto/persistence/Services/ReviewRepository",
) {}
