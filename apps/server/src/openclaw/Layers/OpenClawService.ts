import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type OpenClawConnectionConfig,
  type OpenClawGatewayStatus,
  type OpenClawStreamEvent,
} from "@modesto/contracts";
import { Effect, Layer, Option, PubSub, Stream } from "effect";

import { ServerSecretStore } from "../../auth/Services/ServerSecretStore.ts";
import { ServerConfig } from "../../config.ts";
import { IncomingTaskRouter } from "../../incomingTask/Services/IncomingTaskRouter.ts";
import { IntegrationRepository } from "../../persistence/Services/IntegrationRepository.ts";
import { findExecutableOnPath } from "../../provider/providerRuntimeDiscovery.ts";
import { OpenClawServiceError } from "../Errors.ts";
import { OpenClawService, type OpenClawServiceShape } from "../Services/OpenClawService.ts";

export const OPENCLAW_INGRESS_SECRET_NAME = "integration.openclaw.ingress-token";
const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const CLI_TIMEOUT_MS = 15_000;

const defaultConfig = (): OpenClawConnectionConfig => ({
  gatewayUrl: null,
  allowedProjectIds: [],
  allowedModelSelections: [],
  defaultModelSelection: null,
  runtimeMode: "approval-required",
  interactionMode: "default",
  envMode: "worktree",
  enabled: false,
  updatedAt: new Date().toISOString(),
});

const toError =
  (message: string) =>
  (cause: unknown): OpenClawServiceError =>
    new OpenClawServiceError({ message, cause });

interface CliResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(
  executable: string,
  args: ReadonlyArray<string>,
  timeoutMs = CLI_TIMEOUT_MS,
): Effect.Effect<CliResult, OpenClawServiceError> {
  return Effect.tryPromise({
    try: () =>
      new Promise<CliResult>((resolve) => {
        execFile(
          executable,
          [...args],
          { timeout: timeoutMs, maxBuffer: 2_000_000 },
          (error, stdout, stderr) => {
            resolve({
              code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
              stdout: String(stdout),
              stderr: String(stderr),
            });
          },
        );
      }),
    catch: toError(`Failed to run OpenClaw command: ${args.join(" ")}`),
  });
}

function companionPluginFiles(endpoint: string, token: string) {
  const packageJson = {
    name: "@modesto/openclaw-tool",
    version: "0.1.0",
    type: "module",
    dependencies: { typebox: "latest" },
    peerDependencies: { openclaw: "*" },
    openclaw: {
      extensions: ["./index.mjs"],
    },
  };
  const manifest = {
    id: "modesto",
    name: "Modesto",
    description: "Routes coding tasks into the local Modesto agent workflow",
    contracts: { tools: ["modesto_code_task"] },
    activation: { onStartup: true },
    toolMetadata: { modesto_code_task: { optional: true } },
    configSchema: { type: "object", additionalProperties: false },
  };
  const entry = `import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const endpoint = ${JSON.stringify(endpoint)};
const token = ${JSON.stringify(token)};

export default definePluginEntry({
  id: "modesto",
  name: "Modesto",
  description: "Routes coding tasks into Modesto",
  register(api) {
    api.registerTool({
      name: "modesto_code_task",
      description: "Send a coding task to an allowed Modesto workspace and coding agent.",
      parameters: Type.Object({
        sourceTaskId: Type.String({ minLength: 1, maxLength: 256 }),
        projectId: Type.String({ minLength: 1 }),
        prompt: Type.String({ minLength: 1, maxLength: 64000 }),
        title: Type.Optional(Type.String({ maxLength: 160 })),
        requestedProvider: Type.Optional(Type.String()),
      }, { additionalProperties: false }),
      outputSchema: Type.Object({
        taskId: Type.String(),
        threadId: Type.Union([Type.String(), Type.Null()]),
        status: Type.String(),
        duplicate: Type.Boolean(),
      }, { additionalProperties: false }),
      async execute(_id, params) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": \`Bearer \${token}\`,
          },
          body: JSON.stringify(params),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.message || \`Modesto rejected the task (\${response.status})\`);
        }
        const details = {
          taskId: body.task.id,
          threadId: body.task.threadId,
          status: body.task.status,
          duplicate: body.duplicate,
        };
        return {
          content: [{ type: "text", text: \`Task accepted by Modesto: \${details.taskId}\` }],
          details,
        };
      },
    }, { optional: true });
  },
});
`;
  return { packageJson, manifest, entry };
}

function parseVersion(stdout: string): string | null {
  const value = stdout.trim();
  return value.length > 0 ? value.slice(0, 200) : null;
}

export const makeOpenClawService = Effect.gen(function* () {
  const repository = yield* IntegrationRepository;
  const taskRouter = yield* IncomingTaskRouter;
  const secrets = yield* ServerSecretStore;
  const config = yield* ServerConfig;
  const events = yield* PubSub.unbounded<OpenClawStreamEvent>();

  const loadConfig = repository
    .getOpenClawConfig()
    .pipe(
      Effect.map(Option.getOrElse(defaultConfig)),
      Effect.mapError(toError("Failed to load OpenClaw configuration.")),
    );

  const probe = Effect.gen(function* () {
    const executable =
      findExecutableOnPath({ binaryName: "openclaw" }) ??
      findExecutableOnPath({ binaryName: "oclaw" });
    if (!executable) {
      return {
        installation: "not-found",
        executable: null,
        gateway: "unknown",
        gatewayUrl: null,
        plugin: "unknown",
        version: null,
        message: "OpenClaw CLI was not found on PATH.",
      } satisfies OpenClawGatewayStatus;
    }

    const stored = yield* loadConfig;
    const versionResult = yield* runCli(executable, ["--version"]);
    const statusResult = yield* runCli(executable, ["gateway", "status", "--deep", "--json"]);
    const pluginResult = yield* runCli(executable, [
      "plugins",
      "inspect",
      "modesto",
      "--runtime",
      "--json",
    ]);
    return {
      installation: "detected",
      executable,
      gateway: statusResult.code === 0 ? "connected" : "disconnected",
      gatewayUrl: stored.gatewayUrl ?? DEFAULT_GATEWAY_URL,
      plugin: pluginResult.code === 0 ? "installed" : "not-installed",
      version: parseVersion(versionResult.stdout),
      message:
        statusResult.code === 0
          ? null
          : (
              statusResult.stderr.trim() ||
              statusResult.stdout.trim() ||
              "Gateway is unavailable."
            ).slice(0, 1_000),
    } satisfies OpenClawGatewayStatus;
  });

  const getSnapshot = Effect.gen(function* () {
    const [connectionConfig, status, tasks] = yield* Effect.all(
      [loadConfig, probe, repository.listTasks({ source: "openclaw", limit: 100 })],
      { concurrency: "unbounded" },
    ).pipe(Effect.mapError(toError("Failed to load the OpenClaw snapshot.")));
    return { config: connectionConfig, status, tasks };
  });

  const updateConfig: OpenClawServiceShape["updateConfig"] = (input) =>
    Effect.gen(function* () {
      const current = yield* loadConfig;
      if (input.gatewayToken !== undefined) {
        if (input.gatewayToken === null) {
          yield* secrets
            .remove("integration.openclaw.gateway-token")
            .pipe(Effect.mapError(toError("Failed to clear the OpenClaw gateway token.")));
        } else {
          yield* secrets
            .set("integration.openclaw.gateway-token", new TextEncoder().encode(input.gatewayToken))
            .pipe(Effect.mapError(toError("Failed to save the OpenClaw gateway token.")));
        }
      }
      const next: OpenClawConnectionConfig = {
        gatewayUrl: input.gatewayUrl !== undefined ? input.gatewayUrl : current.gatewayUrl,
        allowedProjectIds: input.allowedProjectIds ?? current.allowedProjectIds,
        allowedModelSelections: input.allowedModelSelections ?? current.allowedModelSelections,
        defaultModelSelection:
          input.defaultModelSelection !== undefined
            ? input.defaultModelSelection
            : current.defaultModelSelection,
        runtimeMode: input.runtimeMode ?? current.runtimeMode,
        interactionMode: input.interactionMode ?? current.interactionMode,
        envMode: input.envMode ?? current.envMode,
        enabled: input.enabled ?? current.enabled,
        updatedAt: new Date().toISOString(),
      };
      yield* repository
        .saveOpenClawConfig(next)
        .pipe(Effect.mapError(toError("Failed to save OpenClaw configuration.")));
      return yield* getSnapshot;
    });

  const setup: OpenClawServiceShape["setup"] = (input) =>
    Effect.gen(function* () {
      const executable =
        findExecutableOnPath({ binaryName: "openclaw" }) ??
        findExecutableOnPath({ binaryName: "oclaw" });
      if (!executable) {
        return yield* new OpenClawServiceError({
          message: "Install OpenClaw and ensure its CLI is available on PATH.",
        });
      }
      const tokenBytes = yield* secrets
        .getOrCreateRandom(OPENCLAW_INGRESS_SECRET_NAME, 32)
        .pipe(Effect.mapError(toError("Failed to create the OpenClaw ingress credential.")));
      const token = Buffer.from(tokenBytes).toString("base64url");
      if (input.installPlugin) {
        const pluginDir = join(config.baseDir, "integrations", "openclaw-modesto-tool");
        const files = companionPluginFiles(
          `http://127.0.0.1:${config.port}/api/integrations/openclaw/tasks`,
          token,
        );
        yield* Effect.tryPromise({
          try: async () => {
            await mkdir(pluginDir, { recursive: true, mode: 0o700 });
            await writeFile(
              join(pluginDir, "package.json"),
              `${JSON.stringify(files.packageJson, null, 2)}\n`,
              { mode: 0o600 },
            );
            await writeFile(
              join(pluginDir, "openclaw.plugin.json"),
              `${JSON.stringify(files.manifest, null, 2)}\n`,
              { mode: 0o600 },
            );
            await writeFile(join(pluginDir, "index.mjs"), files.entry, { mode: 0o600 });
            await chmod(pluginDir, 0o700);
          },
          catch: toError("Failed to prepare the OpenClaw companion plugin."),
        });
        const install = yield* runCli(
          executable,
          ["plugins", "install", pluginDir, "--force"],
          120_000,
        );
        if (install.code !== 0) {
          return yield* new OpenClawServiceError({
            message: (
              install.stderr.trim() ||
              install.stdout.trim() ||
              "OpenClaw rejected the companion plugin install."
            ).slice(0, 2_000),
          });
        }
      }
      const current = yield* loadConfig;
      yield* repository
        .saveOpenClawConfig({
          ...current,
          enabled: true,
          gatewayUrl: current.gatewayUrl ?? DEFAULT_GATEWAY_URL,
          updatedAt: new Date().toISOString(),
        })
        .pipe(Effect.mapError(toError("Failed to enable OpenClaw.")));
      const status = yield* probe;
      yield* PubSub.publish(events, { type: "status", status });
      return status;
    });

  const testConnection = probe.pipe(
    Effect.tap((status) => PubSub.publish(events, { type: "status", status })),
  );

  const submitTask: OpenClawServiceShape["submitTask"] = (input) =>
    taskRouter.submit({ ...input, source: "openclaw" }).pipe(
      Effect.tap(({ task }) => PubSub.publish(events, { type: "task", task })),
      Effect.mapError(toError("OpenClaw task was rejected.")),
    );

  return {
    getSnapshot,
    updateConfig,
    setup,
    testConnection,
    submitTask,
    streamEvents: Stream.fromPubSub(events),
  } satisfies OpenClawServiceShape;
});

export const OpenClawServiceLive = Layer.effect(OpenClawService, makeOpenClawService);
