import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useEffect } from "react";
import { useClientSettings } from "../../hooks/useSettings";
import { useCustomThemes } from "../../hooks/useCustomThemes";
import { useTheme } from "../../hooks/useTheme";
import {
  getStandardThemeColors,
  getThemeColorsForMode,
  getThemeDefinition,
  type ThemeAppearance,
  type ThemeColors,
} from "../../themePalette";

export function terminalAppearanceColors(
  themeId: string,
  appearance: ThemeAppearance,
): ThemeColors {
  const definition = getThemeDefinition(themeId);
  return (
    (definition && getThemeColorsForMode(definition, appearance)) ??
    getStandardThemeColors(appearance)
  );
}

/** The terminal renderer observes these root variables, including already-open terminals. */
export function TerminalAppearanceSync() {
  const preference = useClientSettings((settings) => settings.terminalAppearance);
  const { theme, themeHalves } = useTheme();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const customThemes = useCustomThemes();
  useEffect(() => {
    const appearance = preference === "system" ? (systemDark ? "dark" : "light") : preference;
    const colors = terminalAppearanceColors(themeHalves?.[appearance] ?? theme, appearance);
    const variables = {
      "--terminal-background": colors.terminalBackground,
      "--terminal-foreground": colors.terminalForeground,
      "--terminal-cursor": colors.terminalCursor,
      "--terminal-selection-background": colors.terminalSelection,
    };
    for (const [name, value] of Object.entries(variables))
      document.documentElement.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(variables))
        document.documentElement.style.removeProperty(name);
    };
  }, [preference, theme, themeHalves, systemDark, customThemes]);
  return null;
}
