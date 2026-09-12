import { describe, expect, it } from "vite-plus/test";

import {
  collectNativeAppsFromPrompt,
  resolveNativeAppMention,
  searchNativeAppMentions,
} from "./nativeApps.ts";

describe("resolveNativeAppMention", () => {
  it("resolves common After Effects and Photoshop aliases", () => {
    expect(resolveNativeAppMention("after effects")?.id).toBe("after-effects");
    expect(resolveNativeAppMention("ae")?.id).toBe("after-effects");
    expect(resolveNativeAppMention("photoshop")?.id).toBe("photoshop");
    expect(resolveNativeAppMention("ps")?.id).toBe("photoshop");
    expect(resolveNativeAppMention("Adobe Photoshop")?.id).toBe("photoshop");
  });
});

describe("collectNativeAppsFromPrompt", () => {
  it("collects @photoshop and @after-effects chips", () => {
    expect(
      collectNativeAppsFromPrompt("@photoshop wrap the hand around the other person ").map(
        (app) => app.id,
      ),
    ).toEqual(["photoshop"]);
    expect(collectNativeAppsFromPrompt("nudge this @after-effects ").map((app) => app.id)).toEqual([
      "after-effects",
    ]);
  });
});

describe("searchNativeAppMentions", () => {
  it("finds After Effects from a partial query", () => {
    expect(searchNativeAppMentions("after").some((match) => match.app.id === "after-effects")).toBe(
      true,
    );
  });
});
