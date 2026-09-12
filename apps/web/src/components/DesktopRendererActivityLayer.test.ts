import { describe, expect, it } from "vite-plus/test";

import { isThreadKeepingRendererAlive } from "./DesktopRendererActivityLayer";

describe("isThreadKeepingRendererAlive", () => {
  it("treats running sessions and background liveness as live", () => {
    expect(
      isThreadKeepingRendererAlive({
        hasPendingApprovals: false,
        hasPendingUserInput: false,
        session: {
          status: "running",
          activeTurnId: null,
          providerInstanceId: "codex",
          providerName: "Codex",
        } as never,
        backgroundLiveness: null,
        latestTurn: null,
      }),
    ).toBe(true);
    expect(
      isThreadKeepingRendererAlive({
        hasPendingApprovals: false,
        hasPendingUserInput: false,
        session: null,
        backgroundLiveness: "working",
        latestTurn: null,
      }),
    ).toBe(true);
    expect(
      isThreadKeepingRendererAlive({
        hasPendingApprovals: false,
        hasPendingUserInput: false,
        session: null,
        backgroundLiveness: null,
        latestTurn: null,
      }),
    ).toBe(false);
  });
});
