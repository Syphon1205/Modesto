import { describe, expect, it } from "vitest";

import { extractTurnSources } from "./turnSources";

describe("extractTurnSources", () => {
  it("deduplicates Codex web_search results and open_page URLs", () => {
    const sources = extractTurnSources({
      workEntries: [
        {
          itemType: "web_search",
          data: {
            query: "modesto coding agent",
            action: { type: "open_page", url: "https://www.example.com/docs/" },
            results: [
              { url: "https://example.com/docs", title: "Docs" },
              { url: "https://example.com/docs#section", title: "Docs again" },
              { url: "https://github.com/openai/codex", title: "Codex" },
            ],
          },
        },
      ],
      assistantText: "See also [Docs](https://example.com/docs) and https://github.com/openai/codex.",
    });

    expect(sources.map((source) => source.url)).toEqual([
      "https://example.com/docs",
      "https://github.com/openai/codex",
    ]);
    expect(sources[0]?.title).toBe("Docs");
    expect(sources[0]?.domain).toBe("example.com");
    expect(sources[1]?.title).toBe("Codex");
    expect(sources[1]?.domain).toBe("github.com");
  });

  it("includes WebFetch targets", () => {
    const sources = extractTurnSources({
      workEntries: [
        {
          itemType: "dynamic_tool_call",
          toolName: "WebFetch",
          detail: 'WebFetch: {"url":"https://news.ycombinator.com/item?id=1"}',
        },
      ],
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.sourceKind).toBe("web_fetch");
    expect(sources[0]?.domain).toBe("news.ycombinator.com");
  });
});
