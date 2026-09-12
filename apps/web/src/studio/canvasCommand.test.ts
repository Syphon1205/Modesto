import { describe, expect, it } from "vite-plus/test";

import { parseCanvasComposerCommand, resolveCanvasSendPrompt } from "./canvasCommand";
import { parseDashboardSpec } from "./dashboardSpec";

describe("canvas command", () => {
  it("parses /canvas and legacy aliases", () => {
    expect(parseCanvasComposerCommand("/canvas")).toEqual({ mode: "dashboard", task: null });
    expect(parseCanvasComposerCommand("/canvas slides pitch")).toEqual({
      mode: "slides",
      task: "pitch",
    });
    expect(parseCanvasComposerCommand("/canvas launch metrics")).toEqual({
      mode: "dashboard",
      task: "launch metrics",
    });
    expect(parseCanvasComposerCommand("/spreadsheets checklist")).toEqual({
      mode: "spreadsheets",
      task: "checklist",
    });
    expect(parseCanvasComposerCommand("/plan")).toBeNull();
  });

  it("sends a dashboard build prompt for bare /canvas", () => {
    const prompt = resolveCanvasSendPrompt(
      { mode: "dashboard", task: null },
      { threadTitle: "Launch", projectTitle: "Modesto" },
    );
    expect(prompt).toContain("Build an in-app canvas in this workspace.");
    expect(prompt).toContain("Launch");
  });
});

describe("dashboard spec", () => {
  it("parses metrics and a chart table", () => {
    const spec = parseDashboardSpec(`# Health

## Metrics
- Open | 3
- Done | 8

## Chart
| Status | Count |
| ------ | ----- |
| Open | 3 |
| Done | 8 |
`);
    expect(spec.title).toBe("Health");
    expect(spec.metrics).toEqual([
      { label: "Open", value: "3" },
      { label: "Done", value: "8" },
    ]);
    expect(spec.chart?.points).toEqual([
      { label: "Open", value: 3 },
      { label: "Done", value: 8 },
    ]);
  });
});
