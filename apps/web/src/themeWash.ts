// FILE: themeWash.ts
// Purpose: The color-wash that plays when someone chooses a look. Boot,
//          system, and cross-tab applies stay instant; this overlay is only
//          the user-initiated "the app has aura" moment.

import {
  getStandardThemeColors,
  getThemeColorsForMode,
  getThemeDefinition,
  type ThemeAppearance,
  type ThemePreference,
} from "./themePalette";

const WASH_MS = 1680;

let lastPointer = { x: 0, y: 0 };
let pointerBound = false;
let activeWash: { overlay: HTMLElement; animation: Animation } | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return (
      document.documentElement.dataset.reduced === "true" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

function rememberPointer(event: PointerEvent): void {
  lastPointer = { x: event.clientX, y: event.clientY };
}

/** Bind once so the wash originates from the click, not the viewport center. */
export function startThemeWashPointerTracking(): void {
  if (pointerBound) return;
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  pointerBound = true;
  lastPointer = {
    x: typeof window.innerWidth === "number" ? window.innerWidth / 2 : 0,
    y: typeof window.innerHeight === "number" ? window.innerHeight * 0.42 : 0,
  };
  window.addEventListener("pointerdown", rememberPointer, { capture: true, passive: true });
  window.addEventListener("pointermove", rememberPointer, { capture: true, passive: true });
}

/** Accent + canvas the wash should flood with for this preference and mode. */
export function themeWashColors(
  theme: ThemePreference,
  appearance: ThemeAppearance,
): { accent: string; canvas: string } {
  const definition = getThemeDefinition(theme);
  const colors = definition
    ? (getThemeColorsForMode(definition, appearance) ?? definition.colors)
    : getStandardThemeColors(appearance);
  return { accent: colors.accent, canvas: colors.canvas };
}

/**
 * Full-screen radial wash of the incoming palette. Honors reduced motion and
 * no-ops in non-DOM environments so theme tests stay dry.
 */
export function playThemeColorWash(colors: { accent: string; canvas: string }): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (!document.body || typeof document.createElement !== "function") return;
  if (prefersReducedMotion()) return;
  startThemeWashPointerTracking();

  activeWash?.animation.cancel();
  activeWash?.overlay.remove();
  activeWash = null;

  const originX = lastPointer.x || window.innerWidth / 2;
  const originY = lastPointer.y || window.innerHeight / 2;
  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.themeWash = "true";
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:200",
    "pointer-events:none",
    `background:radial-gradient(circle at ${originX}px ${originY}px, ${colors.accent} 0%, color-mix(in oklab, ${colors.accent} 58%, ${colors.canvas}) 26%, ${colors.canvas} 56%, ${colors.canvas} 100%)`,
    "opacity:0",
    "will-change:opacity,transform,filter",
  ].join(";");

  document.body.append(overlay);

  if (typeof overlay.animate !== "function") {
    overlay.remove();
    return;
  }

  const animation = overlay.animate(
    [
      { opacity: 0, transform: "scale(0.72)", filter: "saturate(1.1) blur(18px)" },
      { opacity: 0.94, transform: "scale(1.02)", filter: "saturate(1.4) blur(3px)", offset: 0.28 },
      { opacity: 0.82, transform: "scale(1.05)", filter: "saturate(1.25) blur(1px)", offset: 0.62 },
      { opacity: 0, transform: "scale(1.12)", filter: "saturate(1) blur(0px)" },
    ],
    {
      duration: WASH_MS,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards",
    },
  );

  activeWash = { overlay, animation };
  const finish = () => {
    if (activeWash?.overlay === overlay) activeWash = null;
    overlay.remove();
  };
  void animation.finished.then(finish, finish);
}
