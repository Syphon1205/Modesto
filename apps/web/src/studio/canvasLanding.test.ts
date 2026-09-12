import { describe, expect, it } from "vite-plus/test";

import { shouldShowCanvasLanding } from "./canvasLanding";

describe("shouldShowCanvasLanding", () => {
  it("shows the empty landing until the user starts a canvas", () => {
    expect(
      shouldShowCanvasLanding({
        started: false,
        dashboardIsStarter: true,
        docsIsStarter: true,
        sheetsIsStarter: true,
        slidesIsStarter: true,
      }),
    ).toBe(true);
  });

  it("hides the landing once a canvas is started or real work exists", () => {
    expect(
      shouldShowCanvasLanding({
        started: true,
        dashboardIsStarter: true,
        docsIsStarter: true,
        sheetsIsStarter: true,
        slidesIsStarter: true,
      }),
    ).toBe(false);
    expect(
      shouldShowCanvasLanding({
        started: false,
        dashboardIsStarter: false,
        docsIsStarter: true,
        sheetsIsStarter: true,
        slidesIsStarter: true,
      }),
    ).toBe(false);
  });
});
