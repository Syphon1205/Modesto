// FILE: agentAvatarRandom.ts
// Purpose: Roll plausible characters, derive a face from a name, and force any
//          stored spec back into range.
// Layer: Agents UI (avatar)
//
// Every range here is narrower than the engine's schema allows on purpose. The
// schema's job is to reject impossible data; this file's job is to never roll
// an ugly one. A user who wants a 3000-wide sliver can still drag the slider
// there — the dice should not hand them one.

import type {
  AgentAvatarSpec,
  AgentAvatarSurface,
  AgentAvatarSurfaceType,
} from "@modesto/contracts";

import {
  AGENT_AVATAR_NODE_SURFACES,
  AGENT_AVATAR_SURFACES,
  defaultAgentAvatarEyes,
  defaultAgentAvatarSpec,
  surfaceFromPreset,
  surfaceRoundnessFields,
} from "./agentAvatarDefinition";

/** mulberry32 — reproducible, so a persisted `seed` can rebuild a character. */
export function createAvatarRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, so an unedited bot still gets a face derived from its name. */
export function avatarSeedFromString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 2_147_483_647;
}

export function randomAvatarSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Hues the generator draws from. Hand-picked rather than a uniform sweep: the
 * yellow-green band reads as sickly on both app grounds and pure red reads as
 * an error state, so a uniform roll keeps producing bots that look broken.
 */
const HUES: ReadonlyArray<number> = [210, 225, 255, 275, 292, 320, 340, 18, 32, 160, 172, 190];

function hexChannel(value: number, match: number): string {
  return Math.round(clamp((value + match) * 255, 0, 255))
    .toString(16)
    .padStart(2, "0");
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const huePrime = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let rgb: readonly [number, number, number];
  if (huePrime < 1) rgb = [chroma, secondary, 0];
  else if (huePrime < 2) rgb = [secondary, chroma, 0];
  else if (huePrime < 3) rgb = [0, chroma, secondary];
  else if (huePrime < 4) rgb = [0, secondary, chroma];
  else if (huePrime < 5) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];
  const match = l - chroma / 2;
  return `#${hexChannel(rgb[0], match)}${hexChannel(rgb[1], match)}${hexChannel(rgb[2], match)}`;
}

export function hexToRgb(hex: string): readonly [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return [0, 0, 0];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Relative luminance (WCAG), used to keep eyes legible against the body. */
function linearChannel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function avatarLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** Dark eyes on a dark body vanish at roster size; this picks the side that reads. */
export function readableEyeColor(bodyColor: string): string {
  return avatarLuminance(bodyColor) > 0.42 ? "#111316" : "#f4f6fb";
}

/**
 * A complete, plausible character from one seed.
 *
 * Some rolls attach a node or two. That is the single biggest source of
 * variety — every bot on a sphere looks like the same bot in a different
 * colour, whereas a sphere with two small spheres on top is a different
 * creature entirely.
 */
export function generateAvatarSpec(seed: number): AgentAvatarSpec {
  const random = createAvatarRandom(seed);
  const pick = <T>(values: ReadonlyArray<T>): T =>
    values[Math.floor(random() * values.length)] ?? (values[0] as T);
  const between = (minimum: number, maximum: number): number =>
    Math.round((minimum + random() * (maximum - minimum)) * 100) / 100;

  const hue = pick(HUES);
  const bodyColor = hslToHex(hue, 52 + random() * 26, 52 + random() * 16);

  const primaryType = pick(AGENT_AVATAR_SURFACES);
  const primary = scaleSurface(surfaceFromPreset(primaryType), between(0.86, 1.12), random);

  // Node budget: zero most of the time, a symmetric pair sometimes. A random
  // scatter of solids reads as damage, not as design, so the only multi-node
  // roll offered here is a mirrored pair.
  const nodes: Array<AgentAvatarSpec["nodes"][number]> = [];
  if (random() < 0.45) {
    const nodeType = pick(AGENT_AVATAR_NODE_SURFACES);
    const scale = between(0.2, 0.42);
    const offsetX = primary.width * between(0.3, 0.46);
    const offsetY = primary.height * between(0.28, 0.5);
    const surface = scaleSurface(surfaceFromPreset(nodeType), scale, random);
    const tilt = between(0, 28);
    nodes.push({ surface, position: [-offsetX, offsetY, 0], rotation: [0, 0, -tilt] });
    nodes.push({ surface, position: [offsetX, offsetY, 0], rotation: [0, 0, tilt] });
  }

  const eyes = defaultAgentAvatarEyes();
  const eyeWidth = clamp(eyes.left.width * between(0.75, 1.5), 6, 90);
  const eyeHeight = clamp(eyes.left.height * between(0.7, 1.35), 8, 120);
  const eyeY = eyes.left.y + between(-10, 10);

  return {
    primary,
    nodes,
    bodyColor,
    eyeColor: readableEyeColor(bodyColor),
    eyes: {
      left: { width: eyeWidth, height: eyeHeight, x: eyes.left.x, y: eyeY, angle: 0 },
      right: { width: eyeWidth, height: eyeHeight, x: eyes.right.x, y: eyeY, angle: 0 },
      spacing: clamp(eyes.spacing * between(0.7, 1.45), 4, 160),
    },
    seed,
  };
}

function scaleSurface(
  surface: AgentAvatarSurface,
  scale: number,
  random: () => number,
): AgentAvatarSurface {
  // Slight per-axis jitter so scaled solids are not uniformly shrunk copies.
  const axis = (): number => scale * (0.94 + random() * 0.12);
  return {
    ...surface,
    width: clamp(surface.width * axis(), 1, 10_000),
    height: clamp(surface.height * axis(), 1, 10_000),
    depth: clamp(surface.depth * axis(), 1, 10_000),
  };
}

export function avatarSpecForName(name: string): AgentAvatarSpec {
  return generateAvatarSpec(avatarSeedFromString(name.trim().toLowerCase() || "agent"));
}

function normalizeSurface(
  input: Partial<AgentAvatarSurface> | undefined,
  fallback: AgentAvatarSurface,
  allowed: ReadonlyArray<AgentAvatarSurfaceType>,
): AgentAvatarSurface {
  const type = allowed.includes(input?.type as AgentAvatarSurfaceType)
    ? (input?.type as AgentAvatarSurfaceType)
    : fallback.type;
  const preset = surfaceFromPreset(type);
  const fields = surfaceRoundnessFields(type);
  const surface: AgentAvatarSurface = {
    type,
    width: clamp(input?.width ?? preset.width, 0.001, 10_000),
    height: clamp(input?.height ?? preset.height, 0.001, 10_000),
    depth: clamp(input?.depth ?? preset.depth, 0.001, 10_000),
    roundness: clamp(input?.roundness ?? preset.roundness, 0, 1),
  };
  // Only the terms this solid uses are carried through: the engine's validator
  // rejects a `tipRoundness` on a sphere, so a stale key from a previous type
  // would make the whole avatar unrenderable.
  return {
    ...surface,
    ...(fields.includes("morphRoundness")
      ? { morphRoundness: clamp(input?.morphRoundness ?? preset.morphRoundness ?? 0, 0, 1) }
      : {}),
    ...(fields.includes("tipRoundness")
      ? { tipRoundness: clamp(input?.tipRoundness ?? preset.tipRoundness ?? 0, 0, 1) }
      : {}),
    ...(fields.includes("baseRoundness")
      ? { baseRoundness: clamp(input?.baseRoundness ?? preset.baseRoundness ?? 0, 0, 1) }
      : {}),
  };
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeEye(
  input: Partial<AgentAvatarSpec["eyes"]["left"]> | undefined,
  fallback: AgentAvatarSpec["eyes"]["left"],
): AgentAvatarSpec["eyes"]["left"] {
  return {
    width: clamp(input?.width ?? fallback.width, 1, 10_000),
    height: clamp(input?.height ?? fallback.height, 1, 10_000),
    x: clamp(input?.x ?? fallback.x, -10_000, 10_000),
    y: clamp(input?.y ?? fallback.y, -10_000, 10_000),
    angle: clamp(input?.angle ?? fallback.angle, -10_000, 10_000),
  };
}

/**
 * Force any candidate spec into range.
 *
 * Run on every read from persistence, not only on user edits: a spec written
 * by an older build, or hand-edited in localStorage, must still render. The
 * engine throws on an invalid definition, and an exception inside `<Avatar>`
 * takes out the whole roster, not one card.
 */
export function normalizeAvatarSpec(
  input: Partial<AgentAvatarSpec> | null | undefined,
): AgentAvatarSpec {
  const base = defaultAgentAvatarSpec();
  if (!input) return base;
  const eyes = defaultAgentAvatarEyes();
  return {
    primary: normalizeSurface(input.primary, base.primary, AGENT_AVATAR_SURFACES),
    nodes: (Array.isArray(input.nodes) ? input.nodes : []).slice(0, 16).map((node) => ({
      surface: normalizeSurface(node?.surface, base.primary, AGENT_AVATAR_NODE_SURFACES),
      position: [
        clamp(node?.position?.[0] ?? 0, -10_000, 10_000),
        clamp(node?.position?.[1] ?? 0, -10_000, 10_000),
        clamp(node?.position?.[2] ?? 0, -10_000, 10_000),
      ] as [number, number, number],
      rotation: [
        clamp(node?.rotation?.[0] ?? 0, -360, 360),
        clamp(node?.rotation?.[1] ?? 0, -360, 360),
        clamp(node?.rotation?.[2] ?? 0, -360, 360),
      ] as [number, number, number],
    })),
    bodyColor: HEX.test(input.bodyColor ?? "") ? (input.bodyColor as string) : base.bodyColor,
    eyeColor: HEX.test(input.eyeColor ?? "") ? (input.eyeColor as string) : base.eyeColor,
    eyes: {
      left: normalizeEye(input.eyes?.left, eyes.left),
      right: normalizeEye(input.eyes?.right, eyes.right),
      spacing: clamp(input.eyes?.spacing ?? eyes.spacing, 0, 10_000),
    },
    seed: clamp(Math.round(input.seed ?? 0), 0, 2_147_483_647),
  };
}
