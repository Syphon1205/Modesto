import { describe, expect, it } from "vitest";

import { renderCliReviewResult, resolveCliReviewTarget } from "./modestoReviewCli.ts";

describe("modestoReviewCli", () => {
  it("defaults line ranges to the selected start line", () => {
    expect(
      resolveCliReviewTarget({
        target: "file",
        file: "src/auth.ts",
        startLine: 12,
      }),
    ).toEqual({
      type: "selectedCode",
      file: "src/auth.ts",
      startLine: 12,
      endLine: 12,
    });
  });

  it("requires pull request identity and base branch together", () => {
    expect(() => resolveCliReviewTarget({ target: "pull-request", pullRequest: 42 })).toThrow(
      "--pull-request and --base",
    );
  });

  it("rejects invalid selected line ranges", () => {
    expect(() =>
      resolveCliReviewTarget({
        target: "file",
        file: "src/auth.ts",
        startLine: 12,
        endLine: 4,
      }),
    ).toThrow("--end-line cannot precede --start-line");
  });

  it("renders findings with file locations and suggested fixes", () => {
    expect(
      renderCliReviewResult({
        summary: "One issue.",
        findings: [
          {
            severity: "major",
            file: "src/auth.ts",
            startLine: 12,
            endLine: 12,
            title: "Unsafe comparison",
            explanation: "The comparison leaks timing.",
            suggestedFix: "Use timingSafeEqual.",
          },
        ],
      }),
    ).toContain("[MAJOR] Unsafe comparison\nsrc/auth.ts:12");
  });
});
