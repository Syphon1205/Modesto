import { describe, expect, it } from "vite-plus/test";

import {
  findLatestVisualArtifact,
  findVisualArtifact,
  isVisualGenerationAsk,
} from "./visualArtifacts";

describe("visualArtifacts", () => {
  it("detects chart / graph asks without a slash command", () => {
    expect(isVisualGenerationAsk("Make a bar chart of revenue by month")).toBe(true);
    expect(isVisualGenerationAsk("generate a graph of latency")).toBe(true);
    expect(isVisualGenerationAsk("draw a mermaid diagram of the auth flow")).toBe(true);
    expect(isVisualGenerationAsk("chart of monthly active users")).toBe(true);
    expect(isVisualGenerationAsk("Build an interactive savings calculator")).toBe(true);
    expect(isVisualGenerationAsk("Make a physics simulation with sliders")).toBe(true);
    expect(isVisualGenerationAsk("fix the flaky auth test")).toBe(false);
    expect(isVisualGenerationAsk("the chart component is broken")).toBe(false);
    expect(isVisualGenerationAsk("/canvas metrics")).toBe(false);
  });

  it("turns mermaid and svg fences into canvas HTML", () => {
    const mermaid = findVisualArtifact("```mermaid\ngraph TD; A-->B;\n```");
    expect(mermaid?.kind).toBe("html");
    if (mermaid?.kind === "html") {
      expect(mermaid.html).toContain('class="mermaid"');
      expect(mermaid.html).toContain("graph TD");
    }

    const svg = findVisualArtifact(
      '```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>\n```',
    );
    expect(svg?.kind).toBe("html");
    if (svg?.kind === "html") {
      expect(svg.html).toContain("<circle");
      expect(svg.html).toContain("<!DOCTYPE html>");
    }
  });

  it("opens chart.html and linked images from assistant turns", () => {
    const chart = findVisualArtifact(`
\`\`\`html
<!DOCTYPE html><html><body>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<canvas id="c"></canvas>
</body></html>
\`\`\`
`);
    expect(chart?.kind).toBe("html");

    const image = findVisualArtifact("Saved the plot at [revenue](exports/revenue.png).");
    expect(image).toEqual(expect.objectContaining({ kind: "image", path: "exports/revenue.png" }));
  });

  it("reads the latest assistant visual after the last user turn", () => {
    const visual = findLatestVisualArtifact([
      { role: "user", text: "Make a chart of sales" },
      {
        role: "assistant",
        text: '```html\n<!DOCTYPE html><html><body><canvas id="c"></canvas><script src="chart.js"></script></body></html>\n```',
      },
    ]);
    expect(visual?.kind).toBe("html");
  });
});
