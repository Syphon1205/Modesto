// FILE: ConnectionsHeroStage.logic.ts
// Purpose: Slot math for the Connections hero coverflow - where each logo tile
//          sits on the 3D arc, and how solid it reads at that depth.
// Layer: Connections UI (pure)

export const CONNECTIONS_HERO_LOGO_IDS = [
  "google-drive",
  "salesforce",
  "hubspot",
  "gmail",
  "slack",
  "discord",
  "figma",
  "higgsfield",
  "canva",
  "framer",
  "github",
  "vercel",
  "supabase",
  "stripe",
  "notion",
  "dropbox",
  "linear",
] as const;

export type ConnectionsHeroLogoId = (typeof CONNECTIONS_HERO_LOGO_IDS)[number];

/** Furthest slot still rendered on either side of the featured tile. */
export const HERO_VISIBLE_SLOTS = 2;

/** Shortest signed distance around the ring, so a logo steps to a neighbour instead of wrapping the long way. */
export function heroCarouselOffset(index: number, active: number, count: number): number {
  if (count <= 0) return 0;
  const raw = (((index - active) % count) + count) % count;
  return raw > count / 2 ? raw - count : raw;
}

/**
 * One pose per slot. Only translateX / translateZ / rotateY vary - the stage
 * owns the single shared rotateX, so tiles are never tilted twice and never
 * come out vertically squashed. Z stays inside a narrow band relative to the
 * stage perspective, which keeps the perspective scale jump between the
 * featured tile and its neighbours small enough to read as depth rather than
 * as a size change.
 */
export function heroCarouselSlotTransform(offset: number): string {
  const clamped = Math.max(-HERO_VISIBLE_SLOTS, Math.min(HERO_VISIBLE_SLOTS, offset));
  if (clamped === 0) return "translate3d(0rem, 0rem, 2.4rem) rotateY(0deg)";
  const side = clamped < 0 ? -1 : 1;
  const rank = Math.abs(clamped);
  const x = rank === 1 ? 5.65 : 9.1;
  const z = rank === 1 ? -3.2 : -9.5;
  const spin = rank === 1 ? 38 : 52;
  return `translate3d(${side * x}rem, 0rem, ${z}rem) rotateY(${-side * spin}deg)`;
}

/** Tiles fade out with depth; anything past the visible band is not painted at all. */
export function heroCarouselSlotOpacity(offset: number): number {
  const rank = Math.abs(offset);
  if (rank === 0) return 1;
  if (rank === 1) return 0.94;
  if (rank === 2) return 0.32;
  return 0;
}

/** Nearer tiles paint over further ones, mirroring their Z order. */
export function heroCarouselSlotDepthIndex(offset: number): number {
  return HERO_VISIBLE_SLOTS + 1 - Math.abs(offset);
}
