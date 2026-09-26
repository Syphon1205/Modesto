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
  isCrucialModel,
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

describe("isCrucialModel", () => {
  it("recognizes explicitly marked default models as crucial", () => {
    expect(isCrucialModel(model("custom-xyz", "Custom XYZ", { isDefault: true }))).toBe(true);
  });

  it("recognizes provider default models as crucial", () => {
    expect(isCrucialModel(model("auto", "Auto"), ProviderDriverKind.make("cursor"))).toBe(true);
  });

  it("identifies flagship models across major frontier providers", () => {
    expect(isCrucialModel(model("gpt-5", "GPT-5"))).toBe(true);
    expect(isCrucialModel(model("gpt-5.6-sol", "GPT-5.6 Sol"))).toBe(true);
    expect(isCrucialModel(model("o3-mini", "o3-mini"))).toBe(true);
    expect(isCrucialModel(model("claude-3-7-sonnet", "Claude 3.7 Sonnet"))).toBe(true);
    expect(isCrucialModel(model("claude-opus-4-8", "Claude Opus 4.8"))).toBe(true);
    expect(isCrucialModel(model("gemini-2.5-pro", "Gemini 2.5 Pro"))).toBe(true);
    expect(isCrucialModel(model("gemini-3-flash", "Gemini 3 Flash"))).toBe(true);
    expect(isCrucialModel(model("grok-4-6", "Grok 4.6"))).toBe(true);
    expect(isCrucialModel(model("deepseek-r1", "DeepSeek R1"))).toBe(true);
    expect(isCrucialModel(model("deepseek-v3", "DeepSeek V3"))).toBe(true);
    expect(isCrucialModel(model("llama-3.3-70b", "Llama 3.3 70B"))).toBe(true);
    expect(isCrucialModel(model("composer-2", "Composer 2"))).toBe(true);
  });

  it("classifies embeddings, audio, image, and utility models as non-crucial", () => {
    expect(isCrucialModel(model("text-embedding-3-small", "Text Embedding 3 Small"))).toBe(false);
    expect(isCrucialModel(model("bge-large-en-v1.5", "BGE Large EN"))).toBe(false);
    expect(isCrucialModel(model("whisper-1", "Whisper 1"))).toBe(false);
    expect(isCrucialModel(model("tts-1", "TTS 1"))).toBe(false);
    expect(isCrucialModel(model("dall-e-3", "DALL-E 3"))).toBe(false);
    expect(isCrucialModel(model("text-moderation-latest", "Text Moderation"))).toBe(false);
    expect(isCrucialModel(model("unknown-utility-1", "Unknown Utility 1"))).toBe(false);
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

  it("names the first and counts the rest when crucial models are present", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("grok-4-6", "Grok 4.6"), model("gpt-6", "GPT-6")])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(describeProviderModelReleases(releases)).toBe("Grok 4.6 and 1 more model are out");
  });

  it("prioritizes crucial models to lead the announcement over minor models", () => {
    const releases = detectNewProviderModels({
      providers: [
        cursor([
          model("text-embedding-3-small", "Text Embedding 3 Small"),
          model("gpt-5", "GPT-5"),
        ]),
      ],
      seen: { cursor: ["old-model"] },
    });
    expect(releases[0]?.model.slug).toBe("gpt-5");
    expect(describeProviderModelReleases(releases)).toBe("GPT-5 and 1 more model are out");
  });

  it("summarizes cleanly when tons of models arrive without any crucial update", () => {
    const bulkReleases = detectNewProviderModels({
      providers: [
        cursor([
          model("embed-1", "Embed 1"),
          model("embed-2", "Embed 2"),
          model("embed-3", "Embed 3"),
          model("embed-4", "Embed 4"),
        ]),
      ],
      seen: { cursor: ["old-model"] },
    });
    expect(describeProviderModelReleases(bulkReleases)).toBe("4 new models are available");
  });

  it("summarizes cleanly for 2 non-crucial models", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("embed-1", "Embed 1"), model("embed-2", "Embed 2")])],
      seen: { cursor: ["old-model"] },
    });
    expect(describeProviderModelReleases(releases)).toBe("2 new models are available");
  });

  it("has nothing to say about an empty batch", () => {
    expect(describeProviderModelReleases([])).toBeNull();
    expect(describeProviderModelReleaseSource([])).toBeNull();
  });
});

describe("describeProviderModelReleaseSource", () => {
  it("summarizes single provider with 2 models concisely", () => {
    const releases = detectNewProviderModels({
      providers: [cursor([model("grok-4-6", "Grok 4.6"), model("gpt-6", "GPT-6")])],
      seen: { cursor: ["gpt-5"] },
    });
    expect(describeProviderModelReleaseSource(releases)).toBe(
      "Now available in Cursor: Grok 4.6 and GPT-6.",
    );
  });

  it("summarizes bulk non-crucial models without dumping model names", () => {
    const releases = detectNewProviderModels({
      providers: [
        cursor([
          model("embed-1", "Embed 1"),
          model("embed-2", "Embed 2"),
          model("embed-3", "Embed 3"),
          model("embed-4", "Embed 4"),
          model("embed-5", "Embed 5"),
        ]),
      ],
      seen: { cursor: ["old-model"] },
    });
    expect(describeProviderModelReleaseSource(releases)).toBe("Now available in Cursor.");
  });

  it("highlights 1 crucial model and summarizes the rest when tons of models arrive", () => {
    const releases = detectNewProviderModels({
      providers: [
        cursor([
          model("embed-1", "Embed 1"),
          model("embed-2", "Embed 2"),
          model("embed-3", "Embed 3"),
          model("gpt-5", "GPT-5"),
        ]),
      ],
      seen: { cursor: ["old-model"] },
    });
    expect(describeProviderModelReleaseSource(releases)).toBe(
      "Now available in Cursor: GPT-5 and 3 other models.",
    );
  });

  it("highlights 2 crucial models and summarizes the rest when tons of models arrive", () => {
    const releases = detectNewProviderModels({
      providers: [
        cursor([
          model("embed-1", "Embed 1"),
          model("claude-3-7-sonnet", "Claude 3.7 Sonnet"),
          model("embed-2", "Embed 2"),
          model("gpt-5", "GPT-5"),
        ]),
      ],
      seen: { cursor: ["old-model"] },
    });
    expect(describeProviderModelReleaseSource(releases)).toBe(
      "Now available in Cursor: Claude 3.7 Sonnet, GPT-5, and 2 other models.",
    );
  });

  it("summarizes across multiple providers cleanly", () => {
    const releases = detectNewProviderModels({
      providers: [
        cursor([model("embed-1", "Embed 1"), model("embed-2", "Embed 2")]),
        provider({
          driver: "grok",
          displayName: "Grok",
          models: [model("embed-3", "Embed 3")],
        }),
      ],
      seen: { cursor: ["old-model"], grok: ["old-model"] },
    });
    expect(describeProviderModelReleaseSource(releases)).toBe("Now available in Cursor and Grok.");
  });
});
