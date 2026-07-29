import {
  type LangGraphAssistant,
  type LangGraphConnectionConfig,
  type LangGraphConnectionStatus,
} from "@modesto/contracts";
import { Effect, Layer, Option } from "effect";

import { ServerSecretStore } from "../../auth/Services/ServerSecretStore.ts";
import { IntegrationRepository } from "../../persistence/Services/IntegrationRepository.ts";
import { LangGraphServiceError } from "../Errors.ts";
import { LangGraphService, type LangGraphServiceShape } from "../Services/LangGraphService.ts";

const LANGGRAPH_API_KEY_SECRET = "integration.langgraph.api-key";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_CHARS = 2_000_000;

const defaultConfig = (): LangGraphConnectionConfig => ({
  deploymentUrl: null,
  assistantId: null,
  enabled: false,
  hasApiKey: false,
  updatedAt: new Date().toISOString(),
});

const toError =
  (message: string) =>
  (cause: unknown): LangGraphServiceError =>
    new LangGraphServiceError({ message, cause });

export function normalizeLangGraphDeploymentUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LangGraph deployment URL must use http or https.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("LangGraph deployment URL cannot include credentials, a query, or a fragment.");
  }
  return url.toString().replace(/\/+$/, "");
}

function asAssistant(value: unknown): LangGraphAssistant | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.assistant_id !== "string" || typeof candidate.graph_id !== "string") {
    return null;
  }
  return {
    assistantId: candidate.assistant_id,
    graphId: candidate.graph_id,
    name: typeof candidate.name === "string" ? candidate.name : null,
    description: typeof candidate.description === "string" ? candidate.description : null,
  };
}

export function parseLangGraphAssistants(value: unknown): readonly LangGraphAssistant[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry) => {
    const assistant = asAssistant(entry);
    return assistant ? [assistant] : [];
  });
}

export const makeLangGraphService = Effect.gen(function* () {
  const repository = yield* IntegrationRepository;
  const secrets = yield* ServerSecretStore;

  const readApiKey = secrets
    .get(LANGGRAPH_API_KEY_SECRET)
    .pipe(Effect.mapError(toError("Failed to read the LangGraph API key.")));

  const loadConfig = Effect.gen(function* () {
    const [stored, apiKey] = yield* Effect.all([
      repository
        .getLangGraphConfig()
        .pipe(Effect.mapError(toError("Failed to load LangGraph configuration."))),
      readApiKey,
    ]);
    return {
      ...Option.getOrElse(stored, defaultConfig),
      hasApiKey: apiKey !== null,
    } satisfies LangGraphConnectionConfig;
  });

  const request = (path: string, body: unknown) =>
    Effect.gen(function* () {
      const config = yield* loadConfig;
      if (!config.deploymentUrl) {
        return yield* new LangGraphServiceError({
          message: "Add a LangGraph deployment URL before connecting.",
        });
      }
      const deploymentUrl = yield* Effect.try({
        try: () => normalizeLangGraphDeploymentUrl(config.deploymentUrl!),
        catch: toError("The LangGraph deployment URL is invalid."),
      });
      const apiKeyBytes = yield* readApiKey;
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${deploymentUrl}${path}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(apiKeyBytes
                ? { "x-api-key": new TextDecoder().decode(apiKeyBytes) }
                : {}),
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }),
        catch: toError("Could not reach the LangGraph Agent Server."),
      });
      const text = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: toError("Could not read the LangGraph response."),
      });
      if (text.length > MAX_RESPONSE_CHARS) {
        return yield* new LangGraphServiceError({
          message: "LangGraph returned more than 2 MB. Reduce the graph output and try again.",
        });
      }
      if (!response.ok) {
        const detail = text.trim().slice(0, 1_000);
        return yield* new LangGraphServiceError({
          message: `LangGraph returned ${response.status}${detail ? `: ${detail}` : "."}`,
        });
      }
      return yield* Effect.try({
        try: () => (text ? (JSON.parse(text) as unknown) : null),
        catch: toError("LangGraph returned invalid JSON."),
      });
    });

  const discoverAssistants = request("/assistants/search", {
    metadata: {},
    limit: 100,
    offset: 0,
  }).pipe(
    Effect.flatMap((value) => {
      const assistants = parseLangGraphAssistants(value);
      if (!assistants) {
        return Effect.fail(
          new LangGraphServiceError({
            message: "LangGraph returned an invalid assistant list.",
          }),
        );
      }
      return Effect.succeed(assistants);
    }),
  );

  const testConnection = discoverAssistants.pipe(
    Effect.map(
      (assistants): LangGraphConnectionStatus => ({
        state: "connected",
        message:
          assistants.length > 0
            ? `Connected · ${assistants.length} assistant${assistants.length === 1 ? "" : "s"} found.`
            : "Connected, but this deployment has no assistants.",
        checkedAt: new Date().toISOString(),
        assistants,
      }),
    ),
  );

  const getSnapshot: LangGraphServiceShape["getSnapshot"] = Effect.gen(function* () {
    const config = yield* loadConfig;
    if (!config.deploymentUrl) {
      return {
        config,
        status: {
          state: "disconnected",
          message: "Add a deployment URL to connect LangGraph.",
          checkedAt: null,
          assistants: [],
        },
      };
    }
    const status = yield* testConnection.pipe(
      Effect.catchAll((error) =>
        Effect.succeed({
          state: "error" as const,
          message: error.message,
          checkedAt: new Date().toISOString(),
          assistants: [],
        }),
      ),
    );
    return { config, status };
  });

  const updateConfig: LangGraphServiceShape["updateConfig"] = (input) =>
    Effect.gen(function* () {
      const current = yield* loadConfig;
      if (input.apiKey !== undefined) {
        yield* (input.apiKey === null
          ? secrets.remove(LANGGRAPH_API_KEY_SECRET)
          : secrets.set(LANGGRAPH_API_KEY_SECRET, new TextEncoder().encode(input.apiKey))
        ).pipe(Effect.mapError(toError("Failed to update the LangGraph API key.")));
      }
      const deploymentUrl =
        input.deploymentUrl === undefined
          ? current.deploymentUrl
          : input.deploymentUrl === null
            ? null
            : yield* Effect.try({
                try: () => normalizeLangGraphDeploymentUrl(input.deploymentUrl!),
                catch: toError("The LangGraph deployment URL is invalid."),
              });
      const next: LangGraphConnectionConfig = {
        deploymentUrl,
        assistantId: input.assistantId !== undefined ? input.assistantId : current.assistantId,
        enabled: input.enabled ?? current.enabled,
        hasApiKey: input.apiKey === null ? false : input.apiKey ? true : current.hasApiKey,
        updatedAt: new Date().toISOString(),
      };
      yield* repository
        .saveLangGraphConfig(next)
        .pipe(Effect.mapError(toError("Failed to save LangGraph configuration.")));
      return yield* getSnapshot;
    });

  const invoke: LangGraphServiceShape["invoke"] = (input) =>
    Effect.gen(function* () {
      const config = yield* loadConfig;
      if (!config.enabled) {
        return yield* new LangGraphServiceError({
          message: "Enable LangGraph before running an assistant.",
        });
      }
      const assistantId = input.assistantId ?? config.assistantId;
      if (!assistantId) {
        return yield* new LangGraphServiceError({
          message: "Choose a default LangGraph assistant first.",
        });
      }
      const output = yield* request("/runs/wait", {
        assistant_id: assistantId,
        input: input.input,
        metadata: { source: "modesto" },
        on_completion: "delete",
        durability: "async",
      });
      return {
        assistantId,
        output,
        completedAt: new Date().toISOString(),
      };
    });

  return { getSnapshot, updateConfig, testConnection, invoke } satisfies LangGraphServiceShape;
});

export const LangGraphServiceLive = Layer.effect(LangGraphService, makeLangGraphService);
