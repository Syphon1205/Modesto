import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

import {
  __resetMainWindowBackgroundThrottlingForTests,
  bindMainWindowBackgroundThrottling,
  markMainWindowRevealed,
  setMainWindowAgentLiveHold,
  setMainWindowFrameCaptureHold,
} from "./mainWindowBackgroundThrottling.ts";

describe("mainWindowBackgroundThrottling", () => {
  beforeEach(() => {
    __resetMainWindowBackgroundThrottlingForTests();
  });

  it("re-enables throttling on reveal, then keeps it off while agents are live", () => {
    const setBackgroundThrottling = vi.fn();
    const window = {
      isDestroyed: () => false,
      webContents: { setBackgroundThrottling },
    } as never;

    bindMainWindowBackgroundThrottling(window);
    expect(setBackgroundThrottling).not.toHaveBeenCalled();

    markMainWindowRevealed();
    expect(setBackgroundThrottling.mock.calls).toEqual([[true]]);

    setMainWindowAgentLiveHold(true);
    expect(setBackgroundThrottling.mock.calls.at(-1)).toEqual([false]);

    setMainWindowFrameCaptureHold(true);
    setMainWindowAgentLiveHold(false);
    expect(setBackgroundThrottling.mock.calls.at(-1)).toEqual([false]);

    setMainWindowFrameCaptureHold(false);
    expect(setBackgroundThrottling.mock.calls.at(-1)).toEqual([true]);
  });
});
