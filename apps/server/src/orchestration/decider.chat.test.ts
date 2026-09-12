import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@modesto/contracts";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as NodeServices from "@effect/platform-node/NodeServices";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel } from "./projector.ts";

const now = "2026-01-01T00:00:00.000Z";

it.layer(NodeServices.layer)("decider chat thread.create", (it) => {
  it.effect("creates a chat without a live project", () =>
    Effect.gen(function* () {
      const result = yield* decideOrchestrationCommand({
        command: {
          type: "thread.create",
          commandId: CommandId.make("cmd-unscoped-chat"),
          threadId: ThreadId.make("thread-unscoped-chat"),
          projectId: ProjectId.make("unscoped-chat"),
          title: "New chat",
          modelSelection: {
            instanceId: ProviderInstanceId.make("codex"),
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "full-access",
          conversationMode: "chat",
          branch: null,
          worktreePath: null,
          createdAt: now,
        },
        readModel: createEmptyReadModel(now),
      });

      const event = Array.isArray(result) ? result[0] : result;
      expect(event.type).toBe("thread.created");
      expect(event.payload).toMatchObject({
        threadId: ThreadId.make("thread-unscoped-chat"),
        conversationMode: "chat",
      });
    }),
  );

  it.effect("still requires a project for work threads", () =>
    Effect.gen(function* () {
      const error = yield* decideOrchestrationCommand({
        command: {
          type: "thread.create",
          commandId: CommandId.make("cmd-work-missing-project"),
          threadId: ThreadId.make("thread-work-missing"),
          projectId: ProjectId.make("missing"),
          title: "New thread",
          modelSelection: {
            instanceId: ProviderInstanceId.make("codex"),
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "full-access",
          conversationMode: "code",
          branch: null,
          worktreePath: null,
          createdAt: now,
        },
        readModel: createEmptyReadModel(now),
      }).pipe(Effect.flip);

      expect(error.message).toContain("does not exist");
    }),
  );
});
