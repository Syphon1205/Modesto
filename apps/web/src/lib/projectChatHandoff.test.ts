import { describe, expect, it } from "vite-plus/test";

import {
  peekProjectChatHandoff,
  stageProjectChatHandoff,
  takeProjectChatHandoff,
} from "./projectChatHandoff";

describe("project chat handoff", () => {
  it("keeps a request until the project flow consumes it", () => {
    stageProjectChatHandoff("fix the login bug");

    expect(peekProjectChatHandoff()).toBe("fix the login bug");
    expect(takeProjectChatHandoff()).toBe("fix the login bug");
    expect(peekProjectChatHandoff()).toBeNull();
  });
});
