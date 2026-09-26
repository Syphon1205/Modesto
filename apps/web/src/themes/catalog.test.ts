import { describe, expect, it } from "vite-plus/test";
import { availableLibraryThemes, BUNDLED_PALETTES } from "./catalog";
import { getThemeModes, parseThemeFile, serializeThemeFile } from "../themePalette";
import { OPEN_CODE_SOUND_OPTIONS } from "../lib/notificationSounds";
import { existsSync } from "node:fs";
describe("shared layout assets", () => {
  it("roundtrips every bundled palette and retains both OpenCode appearances", () => {
    expect(BUNDLED_PALETTES).toHaveLength(75);
    expect(new Set(BUNDLED_PALETTES.map((theme) => theme.id)).size).toBe(75);
    for (const theme of BUNDLED_PALETTES) {
      expect(parseThemeFile(JSON.parse(serializeThemeFile(theme)))).toMatchObject({
        id: theme.id,
        label: theme.label,
      });
      if (theme.id.startsWith("opencode-")) expect(getThemeModes(theme)).toEqual(["light", "dark"]);
      if (theme.id.endsWith("-default")) expect(getThemeModes(theme)).toEqual(["light", "dark"]);
    }
  });
  it("preserves local edits without duplicating a bundled palette", () => {
    const edited = { ...BUNDLED_PALETTES[0]!, label: "My edited palette" };
    const library = availableLibraryThemes([edited]);
    expect(library).toHaveLength(75);
    expect(library.find((theme) => theme.id === edited.id)).toBe(edited);
  });
  it("ships an audio asset for all 45 imported OpenCode sounds", () => {
    expect(OPEN_CODE_SOUND_OPTIONS).toHaveLength(45);
    for (const sound of OPEN_CODE_SOUND_OPTIONS)
      expect(
        existsSync(new URL(`../../public/sounds/opencode/${sound.id}.mp3`, import.meta.url)),
      ).toBe(true);
  });
});
