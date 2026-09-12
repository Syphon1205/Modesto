// FILE: disclosureMotion.ts
// Purpose: Shared open/close motion tokens for collapsible UI (sidebar lists, transcript panels, etc.).
// Layer: Web UI motion primitive
// Exports: class-name helpers + Collapsible panel tokens
// Why: Sidebar project/thread expand and chat disclosures reused the same grid/opacity
//      timing in multiple places; centralize it so new expand/collapse surfaces stay consistent.
//      Timing itself is delegated to lib/motion.ts, so a disclosure and a hover on the same
//      surface share one duration ladder and one easing curve.

import { MOTION_DURATION, MOTION_EASE } from "~/lib/motion";
import { cn } from "~/lib/utils";

/** Shell grid that animates height via grid-template-rows + fade. */
export const DISCLOSURE_SHELL_MOTION_CLASS = `grid transition-[grid-template-rows,opacity] ${MOTION_DURATION.base} ${MOTION_EASE.fluid} motion-reduce:transition-none`;

export const DISCLOSURE_SHELL_OPEN_CLASS = "grid-rows-[1fr] opacity-100";
export const DISCLOSURE_SHELL_CLOSED_CLASS = "grid-rows-[0fr] opacity-0";

/** Required inner wrapper so grid-row collapse measures correctly. */
export const DISCLOSURE_INNER_CLASS = "min-h-0 overflow-hidden";

/** Optional content drift/fade layered on top of the shell animation. */
export const DISCLOSURE_CONTENT_MOTION_CLASS = `transition-[opacity,transform] ${MOTION_DURATION.base} ${MOTION_EASE.fluid} motion-reduce:transition-none`;

export const DISCLOSURE_CONTENT_OPEN_CLASS = "translate-y-0 opacity-100";
export const DISCLOSURE_CONTENT_CLOSED_CLASS = "-translate-y-1 opacity-0 pointer-events-none";

/** Chevron rotation paired with the shell motion. */
export const DISCLOSURE_CHEVRON_MOTION_CLASS = `size-3.5 shrink-0 text-muted-foreground transition-transform ${MOTION_DURATION.base} ${MOTION_EASE.fluid} motion-reduce:transition-none`;

/** Base-ui Collapsible panel height animation using the same timing curve. */
export const DISCLOSURE_COLLAPSIBLE_PANEL_CLASS = `h-(--collapsible-panel-height) overflow-hidden transition-[height] ${MOTION_DURATION.base} ${MOTION_EASE.fluid} motion-reduce:transition-none data-ending-style:h-0 data-starting-style:h-0 data-open:data-ending-style:[height:var(--collapsible-panel-height)]`;

/**
 * Inline-axis (width) reveal for side panels that open/close along the
 * horizontal axis. Same timing curve as the vertical disclosures so every
 * toggle in the app stays consistent. Pair `open ? openWidthClassName : "w-0"`.
 */
export const DISCLOSURE_WIDTH_MOTION_CLASS = `overflow-hidden transition-[width] ${MOTION_DURATION.base} ${MOTION_EASE.fluid} motion-reduce:transition-none`;

/** Viewport-edge panels travel and resize as one surface on open/close. */
export const DISCLOSURE_PANEL_MOTION_CLASS = `overflow-hidden transition-[width,height,opacity,transform,translate] ${MOTION_DURATION.slow} ${MOTION_EASE.soft} motion-reduce:transform-none motion-reduce:transition-none`;

export function disclosurePanelClassName(
  open: boolean,
  edge: "right" | "bottom",
  className?: string,
) {
  return cn(
    DISCLOSURE_PANEL_MOTION_CLASS,
    open
      ? "translate-x-0 translate-y-0 opacity-100"
      : edge === "right"
        ? "pointer-events-none translate-x-3 opacity-0"
        : "pointer-events-none translate-y-3 opacity-0",
    className,
  );
}

export function disclosureWidthClassName(
  open: boolean,
  openWidthClassName: string,
  className?: string,
) {
  return cn(DISCLOSURE_WIDTH_MOTION_CLASS, open ? openWidthClassName : "w-0", className);
}

export function disclosureShellClassName(open: boolean, className?: string) {
  return cn(
    DISCLOSURE_SHELL_MOTION_CLASS,
    open ? DISCLOSURE_SHELL_OPEN_CLASS : DISCLOSURE_SHELL_CLOSED_CLASS,
    className,
  );
}

export function disclosureContentClassName(open: boolean, className?: string) {
  return cn(
    DISCLOSURE_CONTENT_MOTION_CLASS,
    open ? DISCLOSURE_CONTENT_OPEN_CLASS : DISCLOSURE_CONTENT_CLOSED_CLASS,
    className,
  );
}

export function disclosureChevronClassName(open: boolean, className?: string) {
  return cn(DISCLOSURE_CHEVRON_MOTION_CLASS, open && "rotate-90", className);
}
