import { describe, expect, it } from "vitest";

import { formatThreadErrorMessage } from "./ThreadErrorBanner";

describe("formatThreadErrorMessage", () => {
  it("turns internal provider adapter failures into actionable provider copy", () => {
    expect(
      formatThreadErrorMessage(
        "Provider adapter request failed (claudeAgent) for session/resume: saved session no longer exists",
      ),
    ).toBe("Claude could not continue: saved session no longer exists");
  });

  it("preserves errors that are already written for people", () => {
    expect(formatThreadErrorMessage("Codex is not signed in.")).toBe(
      "Codex is not signed in.",
    );
  });
});
