import {
  LangGraphConnectionConfigUpdate,
  LangGraphConnectionStatus,
  LangGraphInvokeInput,
  LangGraphInvokeResult,
  LangGraphSnapshot,
} from "@modesto/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { LangGraphServiceError } from "../Errors.ts";

export interface LangGraphServiceShape {
  readonly getSnapshot: Effect.Effect<LangGraphSnapshot, LangGraphServiceError>;
  readonly updateConfig: (
    input: LangGraphConnectionConfigUpdate,
  ) => Effect.Effect<LangGraphSnapshot, LangGraphServiceError>;
  readonly testConnection: Effect.Effect<LangGraphConnectionStatus, LangGraphServiceError>;
  readonly invoke: (
    input: LangGraphInvokeInput,
  ) => Effect.Effect<LangGraphInvokeResult, LangGraphServiceError>;
}

export class LangGraphService extends ServiceMap.Service<
  LangGraphService,
  LangGraphServiceShape
>()("modesto/langgraph/Services/LangGraphService") {}
