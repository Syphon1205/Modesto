// FILE: FlickerLoadingIcon.tsx
// Purpose: Themed wrapper around `flicker-dot`'s <FlickerSpinner> — the single place
//          every dot-grid loading/working indicator in Modesto renders through, so
//          colors, motion-reduce behavior, and preset wiring stay consistent app-wide.
// Layer: UI primitive
// Exports: FlickerLoadingIcon

import { FlickerSpinner, type FlickerVariant } from "flicker-dot";
import { cn } from "~/lib/utils";

export interface FlickerLoadingIconProps {
  /** Frame sequence — pull from `~/lib/flickerGrids`, never inline a literal here. */
  grids: boolean[][];
  /** Full 7x7 grid or the derived inner 5x5. Default "7x7". */
  variant?: FlickerVariant;
  /** Render size in px. */
  size?: number;
  className?: string;
  /** Accessible label. Default "Loading". */
  title?: string;
}

/**
 * Renders a `flicker-dot` spinner themed to the current text color: lit dots use
 * `currentColor` and unlit dots are a dim mix of it, so the indicator follows
 * whatever muted-foreground class the caller sets and needs no light/dark branching.
 * `flicker-dot` already honors `prefers-reduced-motion` internally.
 */
export function FlickerLoadingIcon({
  grids,
  variant = "7x7",
  size,
  className,
  title = "Loading",
}: FlickerLoadingIconProps) {
  return (
    <FlickerSpinner
      grids={grids}
      variant={variant}
      {...(size !== undefined ? { size } : {})}
      title={title}
      onColor="currentColor"
      offColor="color-mix(in srgb, currentColor 18%, transparent)"
      className={cn("shrink-0", className)}
    />
  );
}
