import { describe, expect, it } from "vite-plus/test";
import { getStandardThemeColors, getThemeColorsForMode, MODESTO_THEME } from "../../themePalette";
import { terminalAppearanceColors } from "./TerminalAppearanceSync";

describe("independent terminal appearance", () => {
  it("resolves explicit light and dark terminal colors without consulting the document appearance", () => {
    expect(terminalAppearanceColors("system", "dark")).toEqual(getStandardThemeColors("dark"));
    expect(terminalAppearanceColors("system", "light")).toEqual(getStandardThemeColors("light"));
    expect(terminalAppearanceColors(MODESTO_THEME.id, "dark")).toEqual(
      getThemeColorsForMode(MODESTO_THEME, "dark"),
    );
  });
  it("falls back safely if a previously selected theme is unavailable", () => {
    expect(terminalAppearanceColors("removed-theme", "light")).toEqual(
      getStandardThemeColors("light"),
    );
  });
});
