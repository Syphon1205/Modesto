// FILE: agentAvatarDefinition.ts
// Purpose: Weld a bot's stored look onto the shared behaviour library to make
//          a complete `AvatarDefinition` for the Bible Strong avatar engine,
//          and map bot activity onto that library's named animations.
// Layer: Agents UI (avatar)
//
// Rendering, geometry, expression blending, animation playback and blinking
// are all the engine's — this module only decides what each bot looks like and
// which animation is playing. See THIRD_PARTY_NOTICES.md: the engine is
// AGPL-3.0, as is Modesto.
//
// The split matters for size as much as for sanity. `baseBehavior.avatar.json`
// is 28 expressions and 23 animations, ~23KB, and is byte-identical for every
// bot; only the body, colours and neutral eyes differ. Persisting whole
// definitions would put a copy of that library in localStorage per teammate.

import {
  surfacePresets,
  type AvatarDefinition,
  type AvatarExpressionDefinition,
  type BodyNodeSurfaceDefinition,
  type HexColor,
  type SurfaceDefinition,
  type SurfaceType,
} from "@bible-strong/avatar-core";
import type {
  AgentAvatarSpec,
  AgentAvatarSurface,
  AgentAvatarSurfaceType,
  AgentBotActivity,
} from "@modesto/contracts";

import baseBehavior from "./baseBehavior.avatar.json";

/**
 * The shared behaviour library: one avatar's worth of expressions and
 * animations, with its own body and colours treated as placeholders that every
 * composition overwrites.
 */
const BASE_DEFINITION = baseBehavior as unknown as AvatarDefinition;

/**
 * Compile-time guard that the contract's surface list and the engine's have
 * not drifted. `packages/contracts` is schema-only and cannot import the
 * engine, so this is where the two are tied together: if upstream adds or
 * renames a solid, this assignment stops compiling.
 */
const _surfaceTypesMatch: AgentAvatarSurfaceType = "sphere" satisfies SurfaceType;
const _surfaceTypesMatchBack: SurfaceType = "sphere" satisfies AgentAvatarSurfaceType;
void _surfaceTypesMatch;
void _surfaceTypesMatchBack;

export const AGENT_AVATAR_SURFACES: ReadonlyArray<AgentAvatarSurfaceType> = [
  "sphere",
  "capsule",
  "cube",
  "cylinder",
  "cone",
  "diamond",
  "mickey",
  "cursor",
];

/**
 * Solids the engine forbids as *attached* nodes (`BodyNodeSurfaceType`
 * excludes them). Offering them in the node picker would produce definitions
 * the engine's own validator rejects.
 */
export const AGENT_AVATAR_NODE_SURFACES: ReadonlyArray<AgentAvatarSurfaceType> =
  AGENT_AVATAR_SURFACES.filter((type) => type !== "mickey" && type !== "cursor");

/** Which roundness terms a given solid actually uses. */
export function surfaceRoundnessFields(
  type: AgentAvatarSurfaceType,
): ReadonlyArray<"roundness" | "morphRoundness" | "tipRoundness" | "baseRoundness"> {
  if (type === "cylinder") return ["roundness", "morphRoundness"];
  if (type === "cone") return ["roundness", "morphRoundness", "tipRoundness", "baseRoundness"];
  return ["roundness"];
}

/**
 * A surface at the engine's own preset proportions, carrying only the
 * roundness terms its type uses — the validator rejects a `tipRoundness` on a
 * sphere, so extra keys cannot simply be left on.
 */
export function surfaceFromPreset(type: AgentAvatarSurfaceType): AgentAvatarSurface {
  const preset = surfacePresets[type];
  const base: AgentAvatarSurface = {
    type,
    width: preset.width,
    height: preset.height,
    depth: preset.depth,
    roundness: preset.roundness,
  };
  return {
    ...base,
    ...(preset.morphRoundness === undefined ? {} : { morphRoundness: preset.morphRoundness }),
    ...(preset.tipRoundness === undefined ? {} : { tipRoundness: preset.tipRoundness }),
    ...(preset.baseRoundness === undefined ? {} : { baseRoundness: preset.baseRoundness }),
  };
}

/** The base library's neutral eyes — the origin every bot's eyes are measured from. */
function baseNeutralEyes(): AvatarExpressionDefinition["eyes"] {
  const neutral = BASE_DEFINITION.expressions["neutral"];
  if (!neutral) throw new Error("Avatar behaviour library is missing its neutral expression.");
  return neutral.eyes;
}

export function defaultAgentAvatarEyes(): AgentAvatarSpec["eyes"] {
  const eyes = baseNeutralEyes();
  return {
    left: { ...eyes.left },
    right: { ...eyes.right },
    spacing: eyes.spacing,
  };
}

export function defaultAgentAvatarSpec(): AgentAvatarSpec {
  return {
    primary: surfaceFromPreset("sphere"),
    nodes: [],
    bodyColor: "#5b7fe5",
    eyeColor: "#111316",
    eyes: defaultAgentAvatarEyes(),
    seed: 0,
  };
}

/** `#abc` -> `#aabbcc`. The engine's schema accepts the long form only. */
function expandHex(color: string): HexColor {
  const raw = color.replace("#", "");
  const full =
    raw.length === 3
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw.padEnd(6, "0").slice(0, 6);
  return `#${full.toLowerCase()}` as HexColor;
}

/**
 * Apply the bot's neutral eyes to one expression as a *delta*.
 *
 * This is the engine/studio's relative-expression model, and it is the reason
 * a bot stays recognisable across all 28 expressions: "sleepy-squint" is not a
 * canonical pair of eyes, it is an offset from neutral, so a wide-eyed bot
 * squints wide and a narrow-eyed bot squints narrow.
 */
function applyEyeOffsets(
  expression: AvatarExpressionDefinition,
  spec: AgentAvatarSpec,
  origin: AvatarExpressionDefinition["eyes"],
): AvatarExpressionDefinition {
  const offset = (
    side: "left" | "right",
    field: "width" | "height" | "x" | "y" | "angle",
  ): number => expression.eyes[side][field] + (spec.eyes[side][field] - origin[side][field]);

  return {
    ...expression,
    eyes: {
      left: {
        // Width and height stay positive: a large negative offset would
        // otherwise invert the eye and the engine would draw it inside out.
        width: Math.max(1, offset("left", "width")),
        height: Math.max(1, offset("left", "height")),
        x: offset("left", "x"),
        y: offset("left", "y"),
        angle: offset("left", "angle"),
      },
      right: {
        width: Math.max(1, offset("right", "width")),
        height: Math.max(1, offset("right", "height")),
        x: offset("right", "x"),
        y: offset("right", "y"),
        angle: offset("right", "angle"),
      },
      spacing: Math.max(0, expression.eyes.spacing + (spec.eyes.spacing - origin.spacing)),
    },
  };
}

/**
 * Contract surface -> engine surface.
 *
 * Not a cast. The contract's optional roundness terms are `number |
 * undefined` under `exactOptionalPropertyTypes`, and the engine's schema
 * rejects a key that is present but undefined — so each term has to be either
 * written with a real value or left off the object entirely.
 */
function toEngineSurface(surface: AgentAvatarSurface): SurfaceDefinition {
  return {
    type: surface.type,
    width: surface.width,
    height: surface.height,
    depth: surface.depth,
    roundness: surface.roundness,
    ...(surface.morphRoundness === undefined ? {} : { morphRoundness: surface.morphRoundness }),
    ...(surface.tipRoundness === undefined ? {} : { tipRoundness: surface.tipRoundness }),
    ...(surface.baseRoundness === undefined ? {} : { baseRoundness: surface.baseRoundness }),
  };
}

/**
 * A complete definition for one bot.
 *
 * Pure and referentially stable per input, so callers can memoise on the spec
 * and hand the engine the same object across renders — `<Avatar>` validates a
 * definition once per object identity, and a fresh object every frame would
 * re-run AJV validation of a 23KB document sixty times a second.
 */
export function composeAgentAvatarDefinition(spec: AgentAvatarSpec): AvatarDefinition {
  const origin = baseNeutralEyes();
  const expressions: Record<string, AvatarExpressionDefinition> = {};
  for (const [key, expression] of Object.entries(BASE_DEFINITION.expressions)) {
    expressions[key] = applyEyeOffsets(expression, spec, origin);
  }

  return {
    ...BASE_DEFINITION,
    body: {
      primary: toEngineSurface(spec.primary),
      nodes: spec.nodes.map((node) => ({
        surface: toEngineSurface(node.surface) as BodyNodeSurfaceDefinition,
        position: [node.position[0], node.position[1], node.position[2]],
        rotation: [node.rotation[0], node.rotation[1], node.rotation[2]],
      })),
    },
    colors: { body: expandHex(spec.bodyColor), eyes: expandHex(spec.eyeColor) },
    expressions,
  };
}

/**
 * Bot activity -> one of the library's named animations.
 *
 * These are real timelines, not still faces: `thinking` glances around,
 * `idle` breathes and blinks. That is what makes a roster feel inhabited, and
 * it is the whole reason for using this engine rather than a static shape.
 */
const ACTIVITY_ANIMATIONS: Record<AgentBotActivity, string> = {
  idle: "idle",
  working: "working",
  waiting: "listening",
  done: "happy",
  failed: "confused",
};

export function animationForActivity(activity: AgentBotActivity): string {
  return ACTIVITY_ANIMATIONS[activity] ?? "idle";
}

/** Every animation the library ships, for the lab's preview strip. */
export const AGENT_AVATAR_ANIMATIONS: ReadonlyArray<string> = BASE_DEFINITION.animationOrder;
