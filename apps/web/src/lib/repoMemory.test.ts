import { describe, expect, it } from "vitest";
import {
  isRepoMemoryCandidatePath,
  listRepoMemoryCandidatePaths,
  normalizeRepoMemoryCandidatePath,
} from "./repoMemory";

describe("repoMemory", () => {
  it("lists known repository memory candidates", () => {
    expect(listRepoMemoryCandidatePaths()).toEqual([
      "AGENTS.md",
      "CLAUDE.md",
      "README.md",
      "ARCHITECTURE.md",
      "docs/adr",
    ]);
  });

  it("recognizes normalized candidate paths", () => {
    expect(isRepoMemoryCandidatePath("AGENTS.md")).toBe(true);
    expect(isRepoMemoryCandidatePath("docs/other")).toBe(false);
    expect(normalizeRepoMemoryCandidatePath("./README.md/")).toBe("README.md");
  });
});
