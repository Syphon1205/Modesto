import { describe, expect, it } from "vitest";

import { IncomingTaskCompletionReactorLive } from "./IncomingTaskCompletionReactor.ts";

describe("IncomingTaskCompletionReactorLive", () => {
  it("constructs with the Effect APIs available at runtime", () => {
    expect(IncomingTaskCompletionReactorLive).toBeDefined();
  });
});
