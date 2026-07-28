import {
  OpenClawConnectionConfigUpdate,
  OpenClawGatewayStatus,
  OpenClawSetupInput,
  OpenClawSnapshot,
  OpenClawStreamEvent,
  OpenClawSubmitTaskInput,
  OpenClawSubmitTaskResult,
} from "@modesto/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

import type { OpenClawServiceError } from "../Errors.ts";

export interface OpenClawServiceShape {
  readonly getSnapshot: Effect.Effect<OpenClawSnapshot, OpenClawServiceError>;
  readonly updateConfig: (
    input: OpenClawConnectionConfigUpdate,
  ) => Effect.Effect<OpenClawSnapshot, OpenClawServiceError>;
  readonly setup: (
    input: OpenClawSetupInput,
  ) => Effect.Effect<OpenClawGatewayStatus, OpenClawServiceError>;
  readonly testConnection: Effect.Effect<OpenClawGatewayStatus, OpenClawServiceError>;
  readonly submitTask: (
    input: OpenClawSubmitTaskInput,
  ) => Effect.Effect<OpenClawSubmitTaskResult, OpenClawServiceError>;
  readonly streamEvents: Stream.Stream<OpenClawStreamEvent, never, never>;
}

export class OpenClawService extends ServiceMap.Service<OpenClawService, OpenClawServiceShape>()(
  "modesto/openclaw/Services/OpenClawService",
) {}
