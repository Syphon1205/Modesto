import { describe, expect, it } from "vite-plus/test";

import { MODESTO_THEME } from "@modesto/shared/themePalettes";

import { themeWashColors } from "./themeWash";

describe("themeWashColors", () => {
  it("uses the incoming theme accent and canvas", () => {
    const wash = themeWashColors("modesto", "light");
    expect(wash.accent).toBe(MODESTO_THEME.colors.accent);
    expect(wash.canvas).toBe(MODESTO_THEME.colors.canvas);
  });

  it("falls back to the product default for an unknown preference", () => {
    const wash = themeWashColors("system", "dark");
    expect(wash.accent.length).toBeGreaterThan(0);
    expect(wash.canvas.length).toBeGreaterThan(0);
  });
});
