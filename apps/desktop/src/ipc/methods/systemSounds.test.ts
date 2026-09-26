import { describe, expect, it } from "vitest";

import { resolveMacSystemSoundPath } from "./systemSounds.ts";

describe("system sounds", () => {
  it("resolves validated identifiers to the macOS system sound directory", () => {
    expect(resolveMacSystemSoundPath("glass")).toBe("/System/Library/Sounds/Glass.aiff");
    expect(resolveMacSystemSoundPath("submarine")).toBe("/System/Library/Sounds/Submarine.aiff");
  });
});
