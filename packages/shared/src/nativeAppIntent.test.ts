import { describe, expect, it } from "vite-plus/test";

import {
  detectNativeAppsToOpen,
  parseNativeAppComposerCommand,
  resolveNativeAppSendPrompt,
} from "./nativeAppIntent.ts";

function ids(prompt: string): string[] {
  return detectNativeAppsToOpen(prompt).map((app) => app.id);
}

describe("detectNativeAppsToOpen", () => {
  it("opens on an explicit @ mention", () => {
    expect(ids("@photoshop make the hand wrap around")).toEqual(["photoshop"]);
    expect(ids("nudge the title @after-effects")).toEqual(["after-effects"]);
  });

  it("opens on Open / Launch / Bring up", () => {
    expect(ids("Open After Effects")).toEqual(["after-effects"]);
    expect(ids("open photoshop and move the hand")).toEqual(["photoshop"]);
    expect(ids("Please launch Adobe Premiere Pro")).toEqual(["premiere-pro"]);
    expect(ids("can you bring up Illustrator")).toEqual(["illustrator"]);
    expect(ids("switch to after effects")).toEqual(["after-effects"]);
  });

  it("opens on a slash command", () => {
    expect(ids("/photoshop")).toEqual(["photoshop"]);
    expect(ids("/ae soften the keyframes")).toEqual(["after-effects"]);
    expect(ids("/after-effects add a fade")).toEqual(["after-effects"]);
  });

  it("opens when the message is just the app name", () => {
    expect(ids("Photoshop")).toEqual(["photoshop"]);
    expect(ids("After Effects")).toEqual(["after-effects"]);
    expect(ids("Adobe Photoshop")).toEqual(["photoshop"]);
    expect(ids("photoshop please")).toEqual(["photoshop"]);
  });

  it("does not open on incidental prose", () => {
    expect(ids("the after effects of this refactor")).toEqual([]);
    expect(ids("like in Photoshop, use layers")).toEqual([]);
    expect(ids("After Effects of something else")).toEqual([]);
    expect(ids("we should talk about premiere later")).toEqual([]);
    expect(ids("photoshop files live in /exports")).toEqual([]);
  });
});

describe("parseNativeAppComposerCommand", () => {
  it("parses /photoshop and /ae", () => {
    expect(parseNativeAppComposerCommand("/photoshop")?.app.id).toBe("photoshop");
    expect(parseNativeAppComposerCommand("/ae soften this")?.task).toBe("soften this");
    expect(parseNativeAppComposerCommand("/docs")).toBeNull();
  });

  it("rewrites a slash send into an @ mention", () => {
    const parsed = parseNativeAppComposerCommand("/photoshop wrap the hand");
    expect(parsed).not.toBeNull();
    const prompt = resolveNativeAppSendPrompt(parsed!.app, parsed!.task);
    expect(prompt).toContain("@photoshop");
    expect(prompt).toContain("wrap the hand");
  });
});
