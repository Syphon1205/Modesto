import * as NodeOS from "node:os";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import {
  VERCEL_MCP_SERVER_NAME,
  VERCEL_MCP_URL,
  VercelRequestError,
  type VercelAuthStatus,
  type VercelClearTokenResult,
  type VercelInstallMcpResult,
  type VercelListProjectsResult,
  type VercelSetTokenInput,
} from "@modesto/contracts";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import {
  installClaudeMcpServers,
  listInstalledClaudeMcpServerNames,
} from "../provider/claudeMcpServers.ts";
import {
  VERCEL_ACCESS_TOKEN_SECRET,
  VERCEL_API_BASE_URL,
  decodeVercelProjects,
  decodeVercelUser,
  parseVercelCliAuthToken,
  preferVercelToken,
  readTrimmedString,
  vercelApiFailureDetail,
  vercelCliAuthFileCandidates,
} from "./vercelDecode.ts";

const TOKEN_ENCODER = new TextEncoder();
const TOKEN_DECODER = new TextDecoder();

export type VercelFetcher = (
  input: string,
  init?: { readonly headers?: Record<string, string> },
) => Promise<Response>;

export class VercelService extends Context.Service<
  VercelService,
  {
    readonly authStatus: () => Effect.Effect<VercelAuthStatus, VercelRequestError>;
    readonly listProjects: () => Effect.Effect<VercelListProjectsResult, VercelRequestError>;
    readonly setToken: (
      input: VercelSetTokenInput,
    ) => Effect.Effect<VercelAuthStatus, VercelRequestError>;
    readonly clearToken: () => Effect.Effect<VercelClearTokenResult, VercelRequestError>;
    readonly installMcp: () => Effect.Effect<VercelInstallMcpResult, VercelRequestError>;
  }
>()("t3/vercel/VercelService") {}

function requestError(
  operation: VercelRequestError["operation"],
  cause: unknown,
): VercelRequestError {
  if (cause instanceof VercelRequestError) return cause;
  const detail =
    cause instanceof Error && cause.message.trim().length > 0
      ? cause.message
      : "The Vercel request could not be completed.";
  return new VercelRequestError({ operation, detail });
}

function defaultClaudeDir(path: Path.Path): string {
  return path.join(NodeOS.homedir(), ".claude");
}

function decodeStoredToken(bytes: Uint8Array): string | null {
  return readTrimmedString(TOKEN_DECODER.decode(bytes));
}

export const make = Effect.fn("VercelService.make")(function* (options?: {
  readonly fetch?: VercelFetcher;
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
  readonly platform?: NodeJS.Platform;
  readonly claudeDir?: string;
}) {
  const secrets = yield* ServerSecretStore.ServerSecretStore;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fetchImpl = options?.fetch ?? globalThis.fetch;
  const env = options?.env ?? process.env;
  const homeDir = options?.homeDir ?? NodeOS.homedir();
  const platform = options?.platform ?? process.platform;
  const claudeDir = options?.claudeDir ?? defaultClaudeDir(path);

  const readSecretToken = Effect.fn("VercelService.readSecretToken")(function* () {
    const stored = yield* secrets.get(VERCEL_ACCESS_TOKEN_SECRET);
    return Option.match(stored, {
      onNone: () => null,
      onSome: decodeStoredToken,
    });
  });

  const readCliToken = Effect.fn("VercelService.readCliToken")(function* () {
    for (const candidate of vercelCliAuthFileCandidates(homeDir, platform, env)) {
      const raw = yield* fileSystem
        .readFileString(candidate)
        .pipe(Effect.orElseSucceed((): string | undefined => undefined));
      if (raw === undefined) continue;
      const token = parseVercelCliAuthToken(raw);
      if (token) return token;
    }
    return null;
  });

  const resolveCredential = Effect.fn("VercelService.resolveCredential")(function* () {
    return preferVercelToken({
      token: yield* readSecretToken(),
      env: readTrimmedString(env.VERCEL_TOKEN),
      cli: yield* readCliToken(),
    });
  });

  const provideClaudeFiles = <A, E>(
    effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
  ) =>
    effect.pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(Path.Path, path),
    );

  const mcpInstalled = Effect.fn("VercelService.mcpInstalled")(function* () {
    const names = yield* provideClaudeFiles(
      listInstalledClaudeMcpServerNames(claudeDir).pipe(
        Effect.orElseSucceed((): ReadonlyArray<string> => []),
      ),
    );
    return names.includes(VERCEL_MCP_SERVER_NAME);
  });

  const fetchJson = Effect.fn("VercelService.fetchJson")(function* (
    operation: VercelRequestError["operation"],
    pathname: string,
    token: string,
  ) {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetchImpl(`${VERCEL_API_BASE_URL}${pathname}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }),
      catch: (cause) =>
        new VercelRequestError({
          operation,
          detail:
            cause instanceof Error && cause.message.trim().length > 0
              ? cause.message
              : "Could not reach api.vercel.com.",
        }),
    });
    if (!response.ok) {
      return yield* new VercelRequestError({
        operation,
        detail: vercelApiFailureDetail(response.status),
      });
    }
    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: () =>
        new VercelRequestError({
          operation,
          detail: "Vercel returned a response that could not be read.",
        }),
    });
  });

  const unauthenticatedStatus = (mcp: boolean): VercelAuthStatus => ({
    authenticated: false,
    username: null,
    email: null,
    source: null,
    mcpInstalled: mcp,
  });

  const statusFromCredential = Effect.fn("VercelService.statusFromCredential")(function* (
    operation: VercelRequestError["operation"],
    credential: {
      readonly token: string;
      readonly source: NonNullable<VercelAuthStatus["source"]>;
    },
    mcp: boolean,
  ) {
    const payload = yield* fetchJson(operation, "/v2/user", credential.token);
    const user = decodeVercelUser(payload);
    return {
      authenticated: user.username !== null || user.email !== null,
      username: user.username,
      email: user.email,
      source: credential.source,
      mcpInstalled: mcp,
    } satisfies VercelAuthStatus;
  });

  const authStatus: VercelService["Service"]["authStatus"] = () =>
    Effect.gen(function* () {
      const mcp = yield* mcpInstalled();
      const credential = yield* resolveCredential();
      if (!credential) return unauthenticatedStatus(mcp);
      return yield* statusFromCredential("authStatus", credential, mcp).pipe(
        Effect.catch((error) => {
          if (error instanceof VercelRequestError) {
            return Effect.succeed({
              authenticated: false,
              username: null,
              email: null,
              source: credential.source,
              mcpInstalled: mcp,
            } satisfies VercelAuthStatus);
          }
          return Effect.fail(error);
        }),
      );
    }).pipe(Effect.mapError((cause) => requestError("authStatus", cause)));

  const listProjects: VercelService["Service"]["listProjects"] = () =>
    Effect.gen(function* () {
      const credential = yield* resolveCredential();
      if (!credential) return { projects: [] };
      const payload = yield* fetchJson("listProjects", "/v9/projects?limit=100", credential.token);
      return { projects: decodeVercelProjects(payload) };
    }).pipe(Effect.mapError((cause) => requestError("listProjects", cause)));

  const setToken: VercelService["Service"]["setToken"] = (input) =>
    Effect.gen(function* () {
      const mcp = yield* mcpInstalled();
      const credential = { token: input.token, source: "token" as const };
      const status = yield* statusFromCredential("setToken", credential, mcp);
      if (!status.authenticated) {
        return yield* new VercelRequestError({
          operation: "setToken",
          detail: "Vercel rejected this token. Create a new one at vercel.com/account/tokens.",
        });
      }
      yield* secrets.set(VERCEL_ACCESS_TOKEN_SECRET, TOKEN_ENCODER.encode(input.token));
      return status;
    }).pipe(Effect.mapError((cause) => requestError("setToken", cause)));

  const clearToken: VercelService["Service"]["clearToken"] = () =>
    secrets.remove(VERCEL_ACCESS_TOKEN_SECRET).pipe(
      Effect.as({ cleared: true } satisfies VercelClearTokenResult),
      Effect.mapError((cause) => requestError("clearToken", cause)),
    );

  const installMcp: VercelService["Service"]["installMcp"] = () =>
    provideClaudeFiles(
      installClaudeMcpServers({
        claudeDir,
        servers: [
          {
            name: VERCEL_MCP_SERVER_NAME,
            config: { type: "http", url: VERCEL_MCP_URL },
          },
        ],
      }),
    ).pipe(
      Effect.map(
        (): VercelInstallMcpResult => ({
          installed: true,
          name: VERCEL_MCP_SERVER_NAME,
        }),
      ),
      Effect.mapError((cause) => requestError("installMcp", cause)),
    );

  return VercelService.of({
    authStatus,
    listProjects,
    setToken,
    clearToken,
    installMcp,
  });
});

export const layer = Layer.effect(VercelService, make());
