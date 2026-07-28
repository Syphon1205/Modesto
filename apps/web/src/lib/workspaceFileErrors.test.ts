import { describe, expect, it } from "vitest";

import { formatWorkspaceFileReadError } from "./workspaceFileErrors";

describe("formatWorkspaceFileReadError", () => {
  it("replaces raw realpath ENOENT errors with a friendly message", () => {
    const message = formatWorkspaceFileReadError(
      new Error(
        "workspaceFileSystem.realpath failed for /Users/tanner/Desktop/TransitNEXT: ENOENT: no such file or directory, realpath '/Users/tanner/Desktop/TransitNEXT/AGENTS.md'",
      ),
      { filePath: "AGENTS.md", workspaceRoot: "/Users/tanner/Desktop/TransitNEXT" },
    );

    expect(message).toBe(
      "AGENTS.md is not in this workspace. It may have been deleted, moved, or never created.",
    );
  });
});
