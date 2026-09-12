import { describe, expect, it } from "vite-plus/test";

import { readGrainientThemeColors } from "./grainientThemeColors";

describe("readGrainientThemeColors", () => {
  it("returns hex stops for light and dark appearances", () => {
    const dark = readGrainientThemeColors("dark");
    const light = readGrainientThemeColors("light");
    expect(dark.color1).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(dark.color2).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(dark.color3).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(dark.lightMode).toBe(false);
    expect(light.lightMode).toBe(true);
  });
});
