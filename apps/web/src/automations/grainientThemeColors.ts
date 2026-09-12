import { formatHex, parse } from "culori/fn";

export type GrainientThemeColors = {
  readonly color1: string;
  readonly color2: string;
  readonly color3: string;
  readonly lightMode: boolean;
};

const FALLBACK_DARK: GrainientThemeColors = {
  color1: "#6366F1",
  color2: "#22D3EE",
  color3: "#A78BFA",
  lightMode: false,
};

const FALLBACK_LIGHT: GrainientThemeColors = {
  color1: "#4F46E5",
  color2: "#0891B2",
  color3: "#7C3AED",
  lightMode: true,
};

function readCssRgb(property: string): string | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.color = `var(${property})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  if (!value || value === "rgba(0, 0, 0, 0)") return null;
  return value;
}

function toHex(cssColor: string | null, fallback: string): string {
  if (!cssColor) return fallback;
  const parsed = parse(cssColor);
  if (!parsed) return fallback;
  return formatHex(parsed) ?? fallback;
}

function mixHex(left: string, right: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const channels = (hex: string) =>
    [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ] as const;
  const a = channels(left);
  const b = channels(right);
  const mix = (index: 0 | 1 | 2) => Math.round(a[index]! + (b[index]! - a[index]!) * t);
  return `#${[mix(0), mix(1), mix(2)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Pulls Grainient's three stops from the live theme tokens so the featured
 * card tracks whatever palette the user has selected.
 */
export function readGrainientThemeColors(
  appearance: "light" | "dark" = "dark",
): GrainientThemeColors {
  const fallback = appearance === "light" ? FALLBACK_LIGHT : FALLBACK_DARK;
  const primary = toHex(readCssRgb("--primary"), fallback.color1);
  const info = toHex(readCssRgb("--info"), fallback.color2);
  const success = toHex(readCssRgb("--success"), fallback.color3);

  return {
    color1: primary,
    color2: mixHex(primary, info, 0.55),
    color3: mixHex(primary, success, 0.45),
    lightMode: appearance === "light",
  };
}
