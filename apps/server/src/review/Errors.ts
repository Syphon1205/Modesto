import { Schema } from "effect";

export class ReviewServiceError extends Schema.TaggedErrorClass<ReviewServiceError>()(
  "ReviewServiceError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}
