import { Data } from "effect";

export class LangGraphServiceError extends Data.TaggedError("LangGraphServiceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
