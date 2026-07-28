import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReviewProgressRail } from "./ReviewProgressRail";

describe("ReviewProgressRail", () => {
  it("announces and renders the real current review stage", () => {
    const markup = renderToStaticMarkup(
      <ReviewProgressRail stage="checking_issues" message="Checking reported issues" />,
    );

    expect(markup).toContain("Review progress: Checking reported issues");
    expect(markup).toContain("Context");
    expect(markup).toContain("Analyze");
    expect(markup).toContain("Check");
    expect(markup).toContain("Complete");
  });
});
