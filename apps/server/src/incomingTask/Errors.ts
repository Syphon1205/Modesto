import { Schema } from "effect";

export class IncomingTaskError extends Schema.TaggedErrorClass<IncomingTaskError>()(
  "IncomingTaskError",
  {
    message: Schema.String,
    code: Schema.Literals([
      "integration-disabled",
      "workspace-denied",
      "agent-denied",
      "configuration-invalid",
      "dispatch-failed",
    ]),
    cause: Schema.optional(Schema.Defect),
  },
) {}
