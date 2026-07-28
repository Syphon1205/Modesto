import { describe, expect, it } from "vitest";

import { parseCodeRabbitAuthStatus } from "./ReviewProviderAdapters.ts";

describe("parseCodeRabbitAuthStatus", () => {
  it("recognizes the current agent-mode signed-in response", () => {
    expect(
      parseCodeRabbitAuthStatus(
        '{"type":"status","phase":"auth","status":"authenticated","authenticated":true}',
      ),
    ).toBe("yes");
  });

  it("recognizes the current agent-mode signed-out response", () => {
    expect(
      parseCodeRabbitAuthStatus(
        '{"type":"status","phase":"auth","status":"not_authenticated","authenticated":false}',
      ),
    ).toBe("no");
  });

  it("does not claim authentication for unknown output", () => {
    expect(parseCodeRabbitAuthStatus("CodeRabbit CLI")).toBe("unknown");
  });
});
