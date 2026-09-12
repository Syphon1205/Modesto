import { validateAvatarDefinition } from "@bible-strong/avatar-core";
import { describe, expect, it } from "vitest";

import {
  AGENT_AVATAR_ANIMATIONS,
  AGENT_AVATAR_NODE_SURFACES,
  AGENT_AVATAR_SURFACES,
  animationForActivity,
  composeAgentAvatarDefinition,
  defaultAgentAvatarSpec,
  surfaceFromPreset,
  surfaceRoundnessFields,
} from "./agentAvatarDefinition";
import {
  avatarSeedFromString,
  avatarSpecForName,
  createAvatarRandom,
  generateAvatarSpec,
  normalizeAvatarSpec,
} from "./agentAvatarRandom";

describe("surface presets", () => {
  it("carries only the roundness terms each solid uses", () => {
    // The engine's validator rejects e.g. a `tipRoundness` on a sphere, so a
    // stale key would make the whole avatar unrenderable.
    for (const type of AGENT_AVATAR_SURFACES) {
      const surface = surfaceFromPreset(type);
      const fields = surfaceRoundnessFields(type);
      for (const key of ["morphRoundness", "tipRoundness", "baseRoundness"] as const) {
        if (fields.includes(key)) expect(surface[key]).toBeTypeOf("number");
        else expect(key in surface).toBe(false);
      }
    }
  });

  it("excludes the solids the engine forbids as attached parts", () => {
    expect(AGENT_AVATAR_NODE_SURFACES).not.toContain("mickey");
    expect(AGENT_AVATAR_NODE_SURFACES).not.toContain("cursor");
  });
});

describe("composeAgentAvatarDefinition", () => {
  it("produces a definition the engine accepts", () => {
    const result = validateAvatarDefinition(composeAgentAvatarDefinition(defaultAgentAvatarSpec()));
    expect(result.ok).toBe(true);
  });

  it("accepts every generated character", () => {
    // The generator is the main source of specs, so a roll the engine rejects
    // would throw inside <Avatar> and take out the roster.
    for (let seed = 0; seed < 120; seed += 1) {
      const result = validateAvatarDefinition(
        composeAgentAvatarDefinition(generateAvatarSpec(seed)),
      );
      expect(result.ok, `seed ${seed}: ${result.ok ? "" : result.errors[0]?.message}`).toBe(true);
    }
  });

  it("accepts a spec recovered from junk", () => {
    const spec = normalizeAvatarSpec({
      primary: { type: "hexagon", width: -5, height: Number.NaN, roundness: 40 } as never,
      nodes: [{ surface: { type: "mickey" as never } as never, position: [1e9, 0, 0] } as never],
      bodyColor: "not-a-colour" as never,
      eyes: { left: { width: -900 } as never } as never,
      seed: -3,
    });
    expect(validateAvatarDefinition(composeAgentAvatarDefinition(spec)).ok).toBe(true);
  });

  it("carries the body and colours onto the definition", () => {
    const spec = { ...defaultAgentAvatarSpec(), bodyColor: "#abc", eyeColor: "#123456" };
    const definition = composeAgentAvatarDefinition(spec);
    // Short hex has to be expanded: the engine's schema takes #rrggbb only.
    expect(definition.colors.body).toBe("#aabbcc");
    expect(definition.colors.eyes).toBe("#123456");
    expect(definition.body.primary.type).toBe(spec.primary.type);
  });

  it("keeps the whole behaviour library on every bot", () => {
    const definition = composeAgentAvatarDefinition(generateAvatarSpec(9));
    expect(Object.keys(definition.expressions).length).toBeGreaterThan(20);
    expect(definition.animationOrder.length).toBeGreaterThan(20);
  });

  it("applies the bot's eyes as a delta across every expression", () => {
    // A wide-eyed bot must stay wide-eyed while it squints, or the character
    // evaporates the moment it does anything.
    const base = defaultAgentAvatarSpec();
    const wide = {
      ...base,
      eyes: {
        ...base.eyes,
        left: { ...base.eyes.left, width: base.eyes.left.width + 20 },
        right: { ...base.eyes.right, width: base.eyes.right.width + 20 },
      },
    };
    const plain = composeAgentAvatarDefinition(base);
    const widened = composeAgentAvatarDefinition(wide);
    for (const key of Object.keys(plain.expressions)) {
      expect(widened.expressions[key]!.eyes.left.width).toBeCloseTo(
        plain.expressions[key]!.eyes.left.width + 20,
        6,
      );
    }
  });

  it("never lets an offset invert an eye", () => {
    const base = defaultAgentAvatarSpec();
    const tiny = {
      ...base,
      eyes: {
        ...base.eyes,
        left: { ...base.eyes.left, width: 1, height: 1 },
        right: { ...base.eyes.right, width: 1, height: 1 },
      },
    };
    const definition = composeAgentAvatarDefinition(tiny);
    for (const expression of Object.values(definition.expressions)) {
      expect(expression.eyes.left.width).toBeGreaterThan(0);
      expect(expression.eyes.left.height).toBeGreaterThan(0);
      expect(expression.eyes.right.width).toBeGreaterThan(0);
      expect(expression.eyes.right.height).toBeGreaterThan(0);
    }
    expect(validateAvatarDefinition(definition).ok).toBe(true);
  });

  it("is stable for equal input so the engine can cache validation", () => {
    const spec = generateAvatarSpec(4);
    expect(composeAgentAvatarDefinition(spec)).toEqual(composeAgentAvatarDefinition(spec));
  });
});

describe("animationForActivity", () => {
  it("maps every activity to an animation the library actually ships", () => {
    for (const activity of ["idle", "working", "waiting", "done", "failed"] as const) {
      expect(AGENT_AVATAR_ANIMATIONS).toContain(animationForActivity(activity));
    }
  });
});

describe("generateAvatarSpec", () => {
  it("reproduces a character from its seed", () => {
    expect(generateAvatarSpec(42)).toEqual(generateAvatarSpec(42));
  });

  it("derives a stable face from a name", () => {
    expect(avatarSpecForName("Scout")).toEqual(avatarSpecForName("  scout  "));
  });

  it("only rolls specs that already satisfy normalisation", () => {
    for (let seed = 0; seed < 120; seed += 1) {
      const spec = generateAvatarSpec(seed);
      expect(normalizeAvatarSpec(spec)).toEqual(spec);
    }
  });

  it("reaches every primary solid across a span of seeds", () => {
    const seen = new Set(
      Array.from({ length: 300 }, (_unused, seed) => generateAvatarSpec(seed).primary.type),
    );
    expect(seen.size).toBe(AGENT_AVATAR_SURFACES.length);
  });

  it("only ever attaches parts in mirrored pairs", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const { nodes } = generateAvatarSpec(seed);
      expect(nodes.length === 0 || nodes.length === 2).toBe(true);
      if (nodes.length === 2) {
        expect(nodes[0]!.position[0]).toBeCloseTo(-nodes[1]!.position[0], 6);
      }
    }
  });
});

describe("createAvatarRandom", () => {
  it("is deterministic and bounded", () => {
    const a = createAvatarRandom(1234);
    const b = createAvatarRandom(1234);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const random = createAvatarRandom(7);
    for (let index = 0; index < 300; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("survives a zero seed rather than collapsing to a constant", () => {
    const random = createAvatarRandom(0);
    expect(random()).not.toBe(random());
  });
});

describe("avatarSeedFromString", () => {
  it("is stable, in range, and separates similar names", () => {
    expect(avatarSeedFromString("Scout")).toBe(avatarSeedFromString("Scout"));
    expect(avatarSeedFromString("scout")).not.toBe(avatarSeedFromString("scout "));
    const seed = avatarSeedFromString("a rather long bot name");
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(2_147_483_647);
  });
});

describe("normalizeAvatarSpec", () => {
  it("falls back to defaults for missing input", () => {
    expect(normalizeAvatarSpec(null)).toEqual(defaultAgentAvatarSpec());
    expect(normalizeAvatarSpec(undefined)).toEqual(defaultAgentAvatarSpec());
  });

  it("rejects an unknown solid instead of rendering nothing", () => {
    expect(normalizeAvatarSpec({ primary: { type: "hexagon" } as never }).primary.type).toBe(
      "sphere",
    );
  });

  it("drops roundness terms that no longer apply after a type change", () => {
    const spec = normalizeAvatarSpec({
      primary: {
        type: "sphere",
        width: 200,
        height: 200,
        depth: 200,
        roundness: 1,
        tipRoundness: 0.4,
      },
    });
    expect("tipRoundness" in spec.primary).toBe(false);
  });

  it("caps attached parts at the engine's limit", () => {
    const node = generateAvatarSpec(3).nodes[0] ?? {
      surface: surfaceFromPreset("sphere"),
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    };
    expect(
      normalizeAvatarSpec({ nodes: Array.from({ length: 40 }, () => node) }).nodes.length,
    ).toBe(16);
  });
});
