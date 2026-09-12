// FILE: motion.ts
// Purpose: Single source of truth for interaction motion (hover, press, entrance, transitions).
// Layer: Web UI motion primitive
// Exports: duration/easing token names + class-name helpers for interactive surfaces
// Note: every class here is a literal string. Tailwind scans source TEXT, so a class built by
//       interpolating a variable (`transition-[${prop}]`) is not guaranteed to be emitted —
//       compose from the constants below instead of assembling utilities at a call site.
// Why: Durations were scattered across the app (150/200/220/250/300) and easing curves were
//      hand-written as raw cubic-beziers at each call site, so no two surfaces felt alike.
//      Every curve now lives in index.css (`--ease-*`, `--motion-*`); this module is the only
//      place that assembles them into class names. Adding a new interactive surface means
//      picking a helper here, not inventing a duration.
//
// Relationship to `disclosureMotion.ts`: that module owns OPEN/CLOSE (height/width reveal) and
// is the required entry point for any toggle per AGENTS.md. It builds on the tokens here so a
// disclosure and a hover share one timing language. This module owns everything else.

import { cn } from "~/lib/utils";

/**
 * Duration ladder. Values live in `index.css` so CSS and markup cannot drift.
 * Referenced from markup as `duration-(--motion-base)`.
 */
export const MOTION_DURATION = {
  /** 90ms — hover tint, icon color. No layout, no travel. */
  instant: "duration-(--motion-instant)",
  /** 140ms — chips, toggles, text state. */
  fast: "duration-(--motion-fast)",
  /** 200ms — cards, rows, disclosures. The default. */
  base: "duration-(--motion-base)",
  /** 320ms — sheets, docks, panes that cross the viewport. */
  slow: "duration-(--motion-slow)",
  /** 440ms — first-paint entrances that want to be noticed. */
  deliberate: "duration-(--motion-deliberate)",
} as const;

/** Easing utilities emitted by the `--ease-*` theme tokens in `index.css`. */
export const MOTION_EASE = {
  /** Signature decelerate. Default for anything that moves or resizes. */
  fluid: "ease-fluid",
  /** Longer tail. Entrances that should settle rather than snap. */
  entrance: "ease-entrance",
  /** Flat-then-fast. Long-distance panel travel. */
  soft: "ease-soft",
  /** Slight overshoot. Press-release and pop-in on small elements only. */
  spring: "ease-spring",
  /** Symmetric. Loops and directionless cross-fades. */
  smooth: "ease-smooth",
} as const;

/**
 * The same ladder in raw values, for JS animation APIs (auto-animate, Web Animations)
 * and inline `style.cssText` that cannot consume a Tailwind class. Keep in lockstep with
 * the `--motion-*` / `--ease-*` definitions in `index.css` — these are the one permitted
 * duplication of those numbers, and exist so no call site invents its own.
 */
export const MOTION_MS = {
  instant: 90,
  fast: 140,
  base: 200,
  slow: 320,
  deliberate: 440,
} as const;

/** Raw easing curves, matching the `--ease-*` tokens. For JS APIs and inline styles. */
export const MOTION_EASE_CSS = {
  fluid: "cubic-bezier(0.22, 1, 0.36, 1)",
  entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
  soft: "cubic-bezier(0.32, 0.72, 0, 1)",
  spring: "cubic-bezier(0.34, 1.32, 0.64, 1)",
  smooth: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

/** Properties worth transitioning together on a hoverable surface. */
const SURFACE_PROPERTIES = "transition-[background-color,border-color,box-shadow,transform,color]";

/**
 * Interactive surface: cards, tiles, and anything that lifts under the cursor.
 *
 * The lift is one pixel on purpose. Travel is what makes motion feel cheap — the
 * shadow and fill carry the affordance, and the transform only has to hint at it.
 * Press collapses the lift so the surface reads as physically depressed.
 */
export const MOTION_SURFACE_CLASS = cn(
  SURFACE_PROPERTIES,
  MOTION_DURATION.base,
  MOTION_EASE.fluid,
  "hover:-translate-y-px active:translate-y-0",
  // Press is faster than release: a control should feel instant going down and
  // relaxed coming back up. That asymmetry is most of what reads as "responsive".
  // Written out rather than interpolated — Tailwind scans source text, so a class
  // assembled from a variable is not guaranteed to be emitted.
  "active:duration-(--motion-instant)",
  "motion-reduce:transform-none motion-reduce:transition-none",
);

/**
 * Compact control: buttons, chips, segmented options, icon buttons.
 * Scales rather than lifts — a small control has no room to travel.
 */
export const MOTION_CONTROL_CLASS = cn(
  SURFACE_PROPERTIES,
  MOTION_DURATION.fast,
  MOTION_EASE.spring,
  "active:scale-[0.97]",
  "active:duration-(--motion-instant)",
  "motion-reduce:transform-none motion-reduce:transition-none",
);

/**
 * List/sidebar row: color-only. Rows sit in a dense stack, so any transform on
 * one row visibly disturbs its neighbours — the tint does all the work.
 */
export const MOTION_ROW_CLASS = cn(
  "transition-[background-color,color]",
  MOTION_DURATION.instant,
  MOTION_EASE.fluid,
  "motion-reduce:transition-none",
);

/** Opacity/color-only fade for text and icons changing state in place. */
export const MOTION_FADE_CLASS = cn(
  "transition-[opacity,color]",
  MOTION_DURATION.fast,
  MOTION_EASE.fluid,
  "motion-reduce:transition-none",
);

/** Long-travel surfaces: docks, sheets, side panels. */
export const MOTION_PANEL_CLASS = cn(
  "transition-[transform,opacity,width,height]",
  MOTION_DURATION.slow,
  MOTION_EASE.soft,
  "motion-reduce:transition-none",
);

/**
 * Staggered entrance for a list of freshly mounted items.
 *
 * Returns the class plus the inline `--motion-index` custom property the CSS reads,
 * so the delay ladder stays in the stylesheet instead of being recomputed in JS at
 * every call site. Cap `index` yourself for long lists — see `motionStaggerIndex`.
 */
export function motionEnter(index = 0): {
  readonly className: string;
  readonly style: React.CSSProperties;
} {
  return {
    className: "motion-enter",
    style: { "--motion-index": index } as React.CSSProperties,
  };
}

/**
 * Clamp a stagger index so a long list does not end with items appearing seconds
 * late. Beyond the cap every remaining item shares the last delay step.
 */
export function motionStaggerIndex(index: number, cap = 8): number {
  return Math.min(Math.max(index, 0), cap);
}
