import { describe, expect, it } from "vite-plus/test";
import {
  ProviderDriverKind,
  type ServerProvider,
  type ServerProviderModel,
} from "@modesto/contracts";

import {
  currentProviderModelSlugs,
  describeProviderModelReleaseSource,
  describeProviderModelReleases,
  detectNewProviderModels,
  providerModelReleaseKey,
} from "./providerModelReleases";

function model(slug: string, name: string, overrides: Partial<ServerProviderModel> = {}) {
  return { slug, name, isCustom: false, capabilities: null, ...overrides } as ServerProviderModel;
}

function provider(input: {
  readonly driver: string;
  readonly displayName?: string;
  readonly models: ReadonlyArray<ServerProviderModel>;
  readonly instanceId?: string;
}): ServerProvider {
  return {
    driver: ProviderDriverKind.make(input.driver),
    instanceId: input.instanceId ?? `${input.driver}-default`,
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    models: input.models,
    slashCommands: [],
    skills: [],
  } as unknown as ServerProvider;
}

const cursor = (models: ReadonlyArray<ServerProviderModel>) =>
  provider({ driver: "cursor", displayName: "Cursor", models });

describe("detectNewProviderModels", () => {
  it("says nothing about a provider it is seeing for the first time", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("grok-4-6", "Grok 4.6"), model("gpt-5", "GPT-5")])],
      seen: {},
    });
    expect(releases).toEqual([]);
  });

  it("announces a model the provider did not offer before", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("gpt-5", "GPT-5"), model("grok-4-6", "Grok 4.6")])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(releases).toHaveLength(1);
    expect(releases[0]?.model.name).toBe("Grok 4.6");
    expect(releases[0]?.providerName).toBe("Cursor");
  });

  it("says nothing when every offered model is already known", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("gpt-5", "GPT-5")])],
      seen: { cursor: ["gpt-5", "grok-4-6"] },
    });
    expect(releases).toEqual([]);
  });

  it("never announces a model the user added themselves", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("my-model", "My Model", { isCustom: true })])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(releases).toEqual([]);
  });

  it("never announces a legacy model", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("old-one", "Old One", { isLegacy: true })])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(releases).toEqual([]);
  });

  it("stays silent when a known provider reports nothing, rather than treating it as news", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(releases).toEqual([]);
  });

  it("announces a model once even when two instances of the driver report it", () => {
    const releases = detectNewProviderModels({
      providers: [
        provider({
          driver: "cursor",
          displayName: "Cursor",
          instanceId: "cursor-a",
          models: [model("grok-4-6", "Grok 4.6")],
        }),
        provider({
          driver: "cursor",
          displayName: "Cursor",
          instanceId: "cursor-b",
          models: [model("grok-4-6", "Grok 4.6")],
        }),
      ],
      seen: { cursor: ["gpt-5"] },
    });
    expect(releases).toHaveLength(1);
  });

  it("treats the same model under a different provider as its own news", () => {
    const releases = detectNewProviderModels({
      providers: [
        cursor([model("grok-4-6", "Grok 4.6")]),
        provider({ driver: "grok", displayName: "Grok", models: [model("grok-4-6", "Grok 4.6")] }),
      ],
      seen: { cursor: ["gpt-5"], grok: ["grok-4-5"] },
    });
    expect(releases).toHaveLength(2);
  });
});

describe("currentProviderModelSlugs", () => {
  it("collects vendor models per driver", () => {
    expect(
      currentProviderModelSlugs([cursor([model("gpt-5", "GPT-5"), model("grok-4-6", "Grok 4.6")])]),
    ).toEqual({ cursor: ["gpt-5", "grok-4-6"] });
  });

  it("unions the instances of one driver", () => {
    const slugs = currentProviderModelSlugs([
      provider({ driver: "cursor", instanceId: "a", models: [model("gpt-5", "GPT-5")] }),
      provider({ driver: "cursor", instanceId: "b", models: [model("grok-4-6", "Grok 4.6")] }),
    ]);
    expect(slugs.cursor).toEqual(["gpt-5", "grok-4-6"]);
  });

  it("omits custom models, so they are never recorded as vendor releases", () => {
    expect(
      currentProviderModelSlugs([cursor([model("mine", "Mine", { isCustom: true })])]),
    ).toEqual({});
  });
});

describe("providerModelReleaseKey", () => {
  it("is null with nothing to announce", () => {
    expect(providerModelReleaseKey([])).toBeNull();
  });

  it("does not depend on the order the releases arrive in", () => {
    const a = detectNewProviderModels({
      providers: [cursor([model("a", "A"), model("b", "B")])],
      seen: { cursor: ["x"] },
    });
    const b = detectNewProviderModels({
      providers: [cursor([model("b", "B"), model("a", "A")])],
      seen: { cursor: ["x"] },
    });
    expect(providerModelReleaseKey(a)).toBe(providerModelReleaseKey(b));
  });
});

describe("describeProviderModelReleases", () => {
  it("names the model outright when there is one", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("grok-4-6", "Grok 4.6")])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(describeProviderModelReleases(releases)).toBe("Grok 4.6 is out");
    expect(describeProviderModelReleaseSource(releases)).toBe("Now available in Cursor.");
  });

  it("names the first and counts the rest", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("grok-4-6", "Grok 4.6"), model("gpt-6", "GPT-6")])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(describeProviderModelReleases(releases)).toBe("Grok 4.6 and 1 more model are out");
  });

  it("has nothing to say about an empty batch", () => {
    expect(describeProviderModelReleases([])).toBeNull();
    expect(describeProviderModelReleaseSource([])).toBeNull();
  });
});
