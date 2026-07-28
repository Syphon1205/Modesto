import { describe, expect, it } from "vitest";

import { reviewFailureMessage } from "./ReviewService.ts";

describe("ReviewService terminal errors", () => {
  it("reports a shutdown interruption instead of a timeout", () => {
    expect(
      reviewFailureMessage({
        result: {
          code: 1,
          stdout: "",
          stderr: "",
          timedOut: true,
          outputLimitExceeded: false,
        },
        reportedError: null,
        interruptedByShutdown: true,
      }),
    ).toBe("Review interrupted by Modesto shutdown.");
  });

  it("prefers shutdown attribution over provider stream errors", () => {
    expect(
      reviewFailureMessage({
        result: {
          code: 1,
          stdout: "",
          stderr: "provider exited",
          timedOut: false,
          outputLimitExceeded: false,
        },
        reportedError: "provider stream closed",
        interruptedByShutdown: true,
      }),
    ).toBe("Review interrupted by Modesto shutdown.");
  });
});
