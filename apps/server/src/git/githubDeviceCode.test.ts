import { describe, expect, it } from "vitest";

import { parseGitHubDeviceCode } from "./githubDeviceCode.ts";

describe("parseGitHubDeviceCode", () => {
  it("extracts and normalizes the code printed by GitHub CLI", () => {
    expect(parseGitHubDeviceCode("First copy your one-time code: ab12-cd34")).toBe("AB12-CD34");
  });

  it("returns null before GitHub CLI emits a code", () => {
    expect(parseGitHubDeviceCode("Opening github.com in your browser...")).toBeNull();
  });
});
