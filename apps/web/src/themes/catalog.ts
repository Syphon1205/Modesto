import vscode from "./vscodePalettes.json";
import opencode from "./opencodePalettes.json";
import {
  getCustomThemes,
  installCustomTheme,
  type ThemeDefinition,
  updateCustomTheme,
} from "../themePalette";
import { PROVIDER_PALETTES } from "./providerPalettes";

export const BUNDLED_PALETTES = [
  ...PROVIDER_PALETTES,
  ...vscode,
  ...opencode,
] as ReadonlyArray<ThemeDefinition>;

/** Install on demand so all existing theme persistence, editing and export paths are shared. */
export function ensureBundledPalette(id: string): void {
  const theme = BUNDLED_PALETTES.find((candidate) => candidate.id === id);
  if (!theme) return;
  const installed = getCustomThemes().some((candidate) => candidate.id === id);
  if (!installed) {
    installCustomTheme(theme);
    return;
  }
  // Provider palettes are part of their interface contract. Re-selecting a
  // provider style should pick up corrected upstream colors instead of
  // retaining a stale copy installed by an older Modesto build.
  if (id === "claude-default" || id === "codex-default" || id === "cursor-default") {
    updateCustomTheme(theme);
  }
}

export function availableLibraryThemes(
  custom: ReadonlyArray<ThemeDefinition>,
): ReadonlyArray<ThemeDefinition> {
  const themes = new Map(BUNDLED_PALETTES.map((theme) => [theme.id, theme]));
  for (const theme of custom) themes.set(theme.id, theme);
  return [...themes.values()];
}
