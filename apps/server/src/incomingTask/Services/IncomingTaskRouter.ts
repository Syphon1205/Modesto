import { IncomingTaskSubmitInput, IncomingTaskSubmitResult } from "@modesto/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { IncomingTaskError } from "../Errors.ts";

export interface IncomingTaskRouterShape {
  readonly submit: (
    input: IncomingTaskSubmitInput,
  ) => Effect.Effect<IncomingTaskSubmitResult, IncomingTaskError>;
}

export class IncomingTaskRouter extends ServiceMap.Service<
  IncomingTaskRouter,
  IncomingTaskRouterShape
>()("modesto/incomingTask/Services/IncomingTaskRouter") {}
