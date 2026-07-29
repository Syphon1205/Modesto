import { describe, expect, it } from "vitest";

import {
  normalizeLangGraphDeploymentUrl,
  parseLangGraphAssistants,
} from "./LangGraphService";

describe("LangGraphService helpers", () => {
  it("normalizes deployment roots without accepting embedded credentials", () => {
    expect(normalizeLangGraphDeploymentUrl("https://example.langgraph.app/")).toBe(
      "https://example.langgraph.app",
    );
    expect(normalizeLangGraphDeploymentUrl("http://127.0.0.1:2024/")).toBe(
      "http://127.0.0.1:2024",
    );
    expect(() => normalizeLangGraphDeploymentUrl("ftp://example.com")).toThrow("http or https");
    expect(() => normalizeLangGraphDeploymentUrl("https://token@example.com")).toThrow(
      "cannot include credentials",
    );
  });

  it("projects valid assistants and skips malformed entries", () => {
    expect(
      parseLangGraphAssistants([
        {
          assistant_id: "assistant-1",
          graph_id: "research",
          name: "Research",
          description: "Research graph",
        },
        { assistant_id: 42, graph_id: "invalid" },
      ]),
    ).toEqual([
      {
        assistantId: "assistant-1",
        graphId: "research",
        name: "Research",
        description: "Research graph",
      },
    ]);
    expect(parseLangGraphAssistants({})).toBeNull();
  });
});
