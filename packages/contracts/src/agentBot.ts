// FILE: agentBot.ts
// Purpose: Wire contracts for agent bots - the persistent named teammates that
//          live in the Agents tab, each with a durable identity, a procedural
//          avatar, a persona, and a home model.
// Layer: Shared contracts (schema-only)
//
// A bot is an identity, not a thread. Threads come and go; the bot's name,
// face, persona, and model outlive every task it runs. That split is the whole
// point of the surface - a roster you recognise, rather than a list of chats
// you have to re-read to identify.
//
// The avatar is stored as a *specification*, never as a rasterised image: the
// renderer draws it from these numbers at whatever size and expression the
// surface needs (a 20px roster dot, a 96px lab preview, a blinking ambient
// orb). Storing pixels would freeze the expression and blur on retina.
//
// Attribution: the procedural-avatar concept (a small parameter set driving an
// SVG face with named expressions and ambient motion) follows the design of
// Bible Strong Avatar Lab <https://github.com/smontlouis/bible-strong-avatar-lab>.
// Modesto's engine is an independent implementation - see THIRD_PARTY_NOTICES.md.

import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Stable identity for a bot. Opaque to everything but the roster store; the
 * UI routes on it (`/agents/$agentId`) so it must survive renames.
 */
export const AgentBotId = TrimmedNonEmptyString.check(Schema.isMaxLength(120));
export type AgentBotId = typeof AgentBotId.Type;

/** Matches the avatar engine's own `roundness`: 0..1. */
const Roundness = Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** Matches the engine's `dimension`. */
const Dimension = Schema.Number.check(Schema.isBetween({ minimum: 0.001, maximum: 10_000 }));

/** Matches the engine's `boundedNumber`. */
const Bounded = Schema.Number.check(Schema.isBetween({ minimum: -10_000, maximum: 10_000 }));

const Degrees = Schema.Number.check(Schema.isBetween({ minimum: -360, maximum: 360 }));

/**
 * `#rgb` / `#rrggbb`. The avatar engine's schema accepts `#rrggbb` only, and
 * `composeAgentAvatarDefinition` expands the short form on the way out.
 */
export const AgentAvatarColor = Schema.String.check(
  Schema.isPattern(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
);
export type AgentAvatarColor = typeof AgentAvatarColor.Type;

/**
 * The engine's eight solids. Mirrored here rather than imported because
 * `packages/contracts` is schema-only and must not depend on a runtime
 * package; `agentAvatarDefinition.ts` has a compile-time check that this list
 * and the engine's `SurfaceType` have not drifted apart.
 */
export const AgentAvatarSurfaceType = Schema.Literals([
  "sphere",
  "mickey",
  "cursor",
  "cube",
  "capsule",
  "cylinder",
  "cone",
  "diamond",
]);
export type AgentAvatarSurfaceType = typeof AgentAvatarSurfaceType.Type;

/**
 * One solid. `width`/`height`/`depth` are real 3-D extents — the engine
 * samples a superellipsoid and projects it, which is why a bot reads as a
 * volume that turns rather than as a flat sticker.
 *
 * The three extra roundness terms only apply to some solids (cylinder uses
 * `morphRoundness`; cone uses `tipRoundness` and `baseRoundness`), so they are
 * optional rather than defaulted — writing them onto a sphere is rejected by
 * the engine's own validator.
 */
export const AgentAvatarSurface = Schema.Struct({
  type: AgentAvatarSurfaceType,
  width: Dimension,
  height: Dimension,
  depth: Dimension,
  roundness: Roundness,
  morphRoundness: Schema.optional(Roundness),
  tipRoundness: Schema.optional(Roundness),
  baseRoundness: Schema.optional(Roundness),
});
export type AgentAvatarSurface = typeof AgentAvatarSurface.Type;

const Vector3 = Schema.Tuple([Bounded, Bounded, Bounded]);
const Rotation3 = Schema.Tuple([Degrees, Degrees, Degrees]);

/**
 * An extra solid welded onto the body — an ear, a fin, a hat, an antenna.
 * This is what makes two bots on the same sphere read as different creatures.
 */
export const AgentAvatarBodyNode = Schema.Struct({
  surface: AgentAvatarSurface,
  position: Vector3,
  rotation: Rotation3,
});
export type AgentAvatarBodyNode = typeof AgentAvatarBodyNode.Type;

/** One eye, in the engine's own units. */
export const AgentAvatarEye = Schema.Struct({
  width: Bounded,
  height: Bounded,
  x: Bounded,
  y: Bounded,
  angle: Bounded,
});
export type AgentAvatarEye = typeof AgentAvatarEye.Type;

/**
 * The bot's neutral eyes.
 *
 * Stored as the *neutral* pose only, never per-expression: composition applies
 * the difference between these and the base library's neutral to all 28
 * expressions, so a bot with wide-set eyes keeps them while it is thinking,
 * sleeping or laughing. That is the engine's own relative-expression model —
 * see `composeAgentAvatarDefinition`.
 */
export const AgentAvatarEyes = Schema.Struct({
  left: AgentAvatarEye,
  right: AgentAvatarEye,
  spacing: Bounded,
});
export type AgentAvatarEyes = typeof AgentAvatarEyes.Type;

/**
 * Everything that makes one bot look like itself.
 *
 * Deliberately *not* a whole `AvatarDefinition`: the 28 expressions and 23
 * animations are identical for every bot and live in one bundled base library
 * (~23KB), so persisting them per bot would put a copy of that library in
 * localStorage for each teammate. Composition welds the two together at render
 * time — the same copy-on-write split the upstream studio uses.
 */
export const AgentAvatarSpec = Schema.Struct({
  primary: AgentAvatarSurface,
  nodes: Schema.Array(AgentAvatarBodyNode).check(Schema.isMaxLength(16)),
  bodyColor: AgentAvatarColor,
  eyeColor: AgentAvatarColor,
  eyes: AgentAvatarEyes,
  /** What `Randomise` last rolled, so a character can be reproduced. */
  seed: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2_147_483_647 })),
});
export type AgentAvatarSpec = typeof AgentAvatarSpec.Type;

/**
 * What a bot is doing, in roster vocabulary. This is the bot-level rollup of
 * its threads, not a thread status: a bot with three running threads is
 * "working" once, not three times.
 */
export const AgentBotActivity = Schema.Literals(["idle", "working", "waiting", "done", "failed"]);
export type AgentBotActivity = typeof AgentBotActivity.Type;

/**
 * The bot's home model. Same shape as `AutomationModelRef` and for the same
 * reason: a bot routes through the ordinary provider-instance path rather than
 * owning a parallel notion of "which agent runs this".
 */
export const AgentBotModelRef = Schema.Struct({
  providerId: TrimmedNonEmptyString,
  modelId: TrimmedNonEmptyString,
  variant: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
});
export type AgentBotModelRef = typeof AgentBotModelRef.Type;

export const AgentBotName = TrimmedNonEmptyString.check(Schema.isMaxLength(60));
export const AgentBotTagline = Schema.String.check(Schema.isMaxLength(120));
export const AgentBotPersona = Schema.String.check(Schema.isMaxLength(8_000));

/**
 * A persistent teammate.
 *
 * `persona` is prepended to the first turn of every thread the bot starts. It
 * is a plain instruction block rather than a structured role/goal/constraints
 * triple because providers differ in what they do with structure, and a
 * lowest-common-denominator string is the only thing every driver honours
 * identically.
 */
export const AgentBot = Schema.Struct({
  id: AgentBotId,
  name: AgentBotName,
  /** One line under the name in the roster. May be empty. */
  tagline: AgentBotTagline,
  persona: AgentBotPersona,
  avatar: AgentAvatarSpec,
  model: Schema.NullOr(AgentBotModelRef),
  /**
   * Project this bot works in by default, as `environmentId:projectId`. Null
   * means "ask when it starts a task" - a bot without a home is still a valid
   * bot, it just cannot be dispatched in one click.
   */
  homeProjectKey: Schema.NullOr(TrimmedNonEmptyString),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  /** Archived bots keep their history but leave the roster and ambient layer. */
  archived: Schema.Boolean,
});
export type AgentBot = typeof AgentBot.Type;

/** The roster as persisted. Versioned so a shape change can migrate rather than drop. */
export const AgentBotRoster = Schema.Struct({
  version: Schema.Literal(1),
  bots: Schema.Array(AgentBot),
});
export type AgentBotRoster = typeof AgentBotRoster.Type;

/**
 * Everything the create/edit form collects. Separate from `AgentBot` so the
 * lab can hold a partial, unsaved character without inventing timestamps or an
 * id for something the user may still cancel.
 */
export const AgentBotDraft = Schema.Struct({
  name: AgentBotName,
  tagline: AgentBotTagline,
  persona: AgentBotPersona,
  avatar: AgentAvatarSpec,
  model: Schema.NullOr(AgentBotModelRef),
  homeProjectKey: Schema.NullOr(TrimmedNonEmptyString),
});
export type AgentBotDraft = typeof AgentBotDraft.Type;
