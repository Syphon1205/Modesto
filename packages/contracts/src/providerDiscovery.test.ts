import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ProviderListModelsResult, ProviderListPluginsResult } from "./providerDiscovery";

const decodeProviderListModelsResult = Schema.decodeUnknownSync(ProviderListModelsResult);
const decodeProviderListPluginsResult = Schema.decodeUnknownSync(ProviderListPluginsResult);

describe("ProviderListModelsResult", () => {
  it("preserves optional runtime model descriptions", () => {
    const result = decodeProviderListModelsResult({
      models: [
        {
          slug: "gpt-5.6-luna",
          name: "GPT-5.6 Luna",
          description: "0.4x Factory token rate",
        },
        {
          slug: "custom:GPT-5.6-Luna-0",
          name: "GPT-5.6 Luna",
        },
      ],
      source: "droid-acp",
    });

    expect(result.models[0]?.description).toBe("0.4x Factory token rate");
    expect(result.models[1]?.description).toBeUndefined();
  });
});

describe("ProviderListPluginsResult", () => {
  it("preserves bundled skill summaries for marketplace discovery", () => {
    const result = decodeProviderListPluginsResult({
      marketplaces: [
        {
          name: "personal",
          path: "/tmp/personal",
          plugins: [
            {
              id: "review-tools@personal",
              name: "review-tools",
              source: { type: "local", path: "/tmp/personal/review-tools" },
              installed: false,
              enabled: false,
              installPolicy: "AVAILABLE",
              authPolicy: "ON_USE",
              bundledSkills: [
                {
                  name: "review-code",
                  description: "Review a change for correctness.",
                  interface: { displayName: "Review Code" },
                },
              ],
            },
          ],
        },
      ],
      marketplaceLoadErrors: [],
      remoteSyncError: null,
      featuredPluginIds: [],
    });

    expect(result.marketplaces[0]?.plugins[0]?.bundledSkills?.[0]).toEqual({
      name: "review-code",
      description: "Review a change for correctness.",
      interface: { displayName: "Review Code" },
    });
  });
});
