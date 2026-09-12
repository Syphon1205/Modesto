import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { AuthSplitSurface } from "./AuthSplitSurface";

describe("AuthSplitSurface", () => {
  it("paints the CRT panel beside the form", () => {
    const markup = renderToStaticMarkup(
      <AuthSplitSurface>
        <h1>Welcome back</h1>
      </AuthSplitSurface>,
    );
    expect(markup).toContain("data-signin-crt");
    expect(markup).toContain("var(--primary)");
    expect(markup).toContain("Welcome back");
  });
});
