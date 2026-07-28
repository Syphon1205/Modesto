import { Schema } from "effect";

export class OpenClawServiceError extends Schema.TaggedErrorClass<OpenClawServiceError>()(
  "OpenClawServiceError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}
