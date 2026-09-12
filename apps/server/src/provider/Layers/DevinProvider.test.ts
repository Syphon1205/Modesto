import * as NodeAssert from "node:assert/strict";

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, it } from "vite-plus/test";

import { DevinSettings } from "@modesto/contracts";

import type { DevinFetch } from "./DevinAdapter.ts";
import { checkDevinProviderStatus } from "./DevinProvider.ts";

const decodeDevinSettings = Schema.decodeSync(DevinSettings);

const neverCalledFetch: DevinFetch = async () => {
  throw new Error("fetch should not have been called");
};

describe("checkDevinProviderStatus", () => {
  it("reports a disabled instance without calling Devin", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const snapshot = yield* checkDevinProviderStatus(
          decodeDevinSettings({ enabled: false }),
          {},
          neverCalledFetch,
        );

        NodeAssert.equal(snapshot.status, "disabled");
        NodeAssert.equal(snapshot.message, "Devin is disabled in Modesto settings.");
      }),
    ));

  it("asks for an API key instead of failing when the environment has none", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const snapshot = yield* checkDevinProviderStatus(
          decodeDevinSettings({ enabled: true }),
          {},
          neverCalledFetch,
        );

        NodeAssert.equal(snapshot.status, "warning");
        // Devin is hosted: there is nothing to install, only a key to add.
        NodeAssert.equal(snapshot.installed, true);
        NodeAssert.equal(snapshot.auth.status, "unauthenticated");
        NodeAssert.match(snapshot.message ?? "", /DEVIN_API_KEY/);
      }),
    ));

  it("surfaces a rejected key as an auth error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const snapshot = yield* checkDevinProviderStatus(
          decodeDevinSettings({ enabled: true }),
          { DEVIN_API_KEY: "bad-key" },
          (async () => new Response("unauthorized", { status: 401 })) satisfies DevinFetch,
        );

        NodeAssert.equal(snapshot.status, "error");
        NodeAssert.equal(snapshot.auth.status, "unauthenticated");
        NodeAssert.match(snapshot.message ?? "", /HTTP 401/);
      }),
    ));

  it("reports ready when Devin accepts the key", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const requestedUrls: Array<string> = [];
        const snapshot = yield* checkDevinProviderStatus(
          decodeDevinSettings({ enabled: true, apiBaseUrl: "https://devin.test/v1/" }),
          { DEVIN_API_KEY: "good-key" },
          (async (input) => {
            requestedUrls.push(input);
            return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
          }) satisfies DevinFetch,
        );

        NodeAssert.equal(snapshot.status, "ready");
        NodeAssert.equal(snapshot.auth.status, "authenticated");
        // The configured base URL is honored, trailing slash and all.
        NodeAssert.deepEqual(requestedUrls, ["https://devin.test/v1/sessions?limit=1"]);
      }),
    ));
});
