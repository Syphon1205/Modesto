import { scopeThreadRef } from "@modesto/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import { browserTabIdsExcludingMusic, musicPreviewTabIdForThread } from "./musicPlayerStore";

const ref = scopeThreadRef("env-1" as EnvironmentId, ThreadId.make("thread-A"));

describe("musicPlayerStore helpers", () => {
  it("reads the dedicated music tab for a thread", () => {
    expect(musicPreviewTabIdForThread({ "env-1:thread-A": "tab-music" }, ref)).toBe("tab-music");
    expect(musicPreviewTabIdForThread({}, ref)).toBeNull();
  });

  it("keeps music tabs out of the browser strip", () => {
    expect(browserTabIdsExcludingMusic(["tab-a", "tab-music", "tab-b"], "tab-music")).toEqual([
      "tab-a",
      "tab-b",
    ]);
    expect(browserTabIdsExcludingMusic(["tab-a"], null)).toEqual(["tab-a"]);
  });
});
