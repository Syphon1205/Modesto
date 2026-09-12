import * as NodeOs from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { describe, expect } from "vitest";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as VercelService from "./VercelService.ts";
import type { VercelFetcher } from "./VercelService.ts";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const fetchImpl: VercelFetcher = async (url) => {
  if (url.endsWith("/v2/user")) {
    return jsonResponse({ user: { username: "ada", email: "ada@example.com" } });
  }
  if (url.includes("/v9/projects")) {
    return jsonResponse({
      projects: [
        {
          id: "prj_1",
          name: "modesto",
          link: { type: "github", org: "Syphon1205", repo: "modesto-source" },
          latestDeployments: [
            { id: "dpl_1", url: "modesto.vercel.app", readyState: "READY", target: "production" },
          ],
        },
      ],
    });
  }
  return jsonResponse({ error: "not found" }, 404);
};

const memorySecrets = (): Layer.Layer<ServerSecretStore.ServerSecretStore> => {
  const values = new Map<string, Uint8Array>();
  return Layer.succeed(
    ServerSecretStore.ServerSecretStore,
    ServerSecretStore.ServerSecretStore.of({
      get: (name) => {
        const value = values.get(name);
        return Effect.succeed(value === undefined ? Option.none() : Option.some(value));
      },
      set: (name, value) =>
        Effect.sync(() => {
          values.set(name, value);
        }),
      create: (name, value) =>
        Effect.sync(() => {
          values.set(name, value);
        }),
      getOrCreateRandom: () => Effect.succeed(new Uint8Array()),
      remove: (name) =>
        Effect.sync(() => {
          values.delete(name);
        }),
    }),
  );
};

const serviceLayer = (env: NodeJS.ProcessEnv) => {
  const homeDir = NodeOs.tmpdir();
  return Layer.effect(
    VercelService.VercelService,
    VercelService.make({
      fetch: fetchImpl,
      env,
      homeDir,
      platform: "linux",
      claudeDir: NodePath.join(homeDir, "modesto-vercel-test-claude"),
    }),
  ).pipe(Layer.provide(memorySecrets()), Layer.provide(NodeServices.layer));
};

describe("VercelService", () => {
  it.effect("authenticates from VERCEL_TOKEN and lists GitHub-linked projects", () =>
    Effect.gen(function* () {
      const vercel = yield* VercelService.VercelService;
      const status = yield* vercel.authStatus();
      expect(status).toMatchObject({
        authenticated: true,
        username: "ada",
        source: "env",
      });
      const listed = yield* vercel.listProjects();
      expect(listed.projects).toEqual([
        {
          id: "prj_1",
          name: "modesto",
          framework: null,
          githubOwner: "Syphon1205",
          githubRepo: "modesto-source",
          latestDeployment: {
            id: "dpl_1",
            url: "https://modesto.vercel.app",
            state: "READY",
            target: "production",
            createdAt: null,
          },
        },
      ]);
    }).pipe(Effect.provide(serviceLayer({ VERCEL_TOKEN: "env-token" }))),
  );

  it.effect("stores a pasted token after Vercel accepts it", () =>
    Effect.gen(function* () {
      const vercel = yield* VercelService.VercelService;
      const before = yield* vercel.authStatus();
      expect(before.authenticated).toBe(false);
      const after = yield* vercel.setToken({ token: "pasted-token" });
      expect(after).toMatchObject({
        authenticated: true,
        username: "ada",
        source: "token",
      });
      expect((yield* vercel.authStatus()).source).toBe("token");
    }).pipe(Effect.provide(serviceLayer({}))),
  );
});
