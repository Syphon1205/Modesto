import { describe, expect, it } from "vite-plus/test";
import palettes from "./vscodePalettes.json";
import { getThemeModes, parseThemeFile, serializeThemeFile } from "../themePalette";

describe("bundled VS Code palettes", () => {
  it("ships distinct installable palettes that survive the existing import/export path", () => {
    expect(new Set(palettes.map((palette) => palette.id)).size).toBe(palettes.length);
    for (const raw of palettes) {
      const theme = parseThemeFile({ ...raw, version: 1, name: raw.label });
      expect(parseThemeFile(JSON.parse(serializeThemeFile(theme)))).toMatchObject({
        id: theme.id,
        label: theme.label,
      });
      expect(getThemeModes(theme).length).toBeGreaterThan(0);
    }
  });
  it("retains both appearances for GitHub and the single dark mode for Nord", () => {
    expect(
      getThemeModes(
        parseThemeFile({
          ...palettes.find((palette) => palette.label === "GitHub"),
          version: 1,
          name: "GitHub",
        }),
      ),
    ).toEqual(["light", "dark"]);
    expect(
      getThemeModes(
        parseThemeFile({
          ...palettes.find((palette) => palette.label === "Nord"),
          version: 1,
          name: "Nord",
        }),
      ),
    ).toEqual(["dark"]);
  });
});
