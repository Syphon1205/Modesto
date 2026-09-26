import { describe, expect, it } from "vite-plus/test";

import {
  MODESTO_SOUND_OPTIONS,
  OPEN_CODE_SOUND_OPTIONS,
  SOUND_OPTIONS,
  SOUND_OPTION_GROUPS,
  SYSTEM_SOUND_OPTIONS,
} from "./notificationSounds";

describe("notification sound catalog", () => {
  it("includes OpenCode, Modesto, and system sound groups", () => {
    expect(OPEN_CODE_SOUND_OPTIONS).toHaveLength(45);
    expect(MODESTO_SOUND_OPTIONS).toHaveLength(29);
    expect(SYSTEM_SOUND_OPTIONS).toHaveLength(10);
    expect(SOUND_OPTION_GROUPS.map((group) => group.label)).toEqual([
      "OpenCode",
      "Modesto",
      "System",
    ]);
  });

  it("uses a unique identifier for every sound", () => {
    const ids = SOUND_OPTIONS.map((sound) => sound.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers five purpose-built choices for every session event", () => {
    for (const event of ["start", "complete", "attention", "interrupted", "error"] as const) {
      expect(
        MODESTO_SOUND_OPTIONS.filter(
          (sound) => sound.id === `modesto-${event}` || sound.id.startsWith(`modesto-${event}-`),
        ),
      ).toHaveLength(5);
    }
  });
});
