import { describe, expect, it } from "vite-plus/test";

import type { PreviewSessionSnapshot } from "@modesto/contracts";

import {
  environmentDiffStats,
  environmentProjectLabel,
  previewOpenTabs,
  previewSessionTitle,
} from "./RightPanelEnvironments.logic";

describe("environmentProjectLabel", () => {
  it("uses the last path segment of the workspace", () => {
    expect(
      environmentProjectLabel({
        title: "Modesto",
        workspaceRoot: "/Users/example/projects/modesto-app",
      }),
    ).toBe("modesto-app");
  });

  it("falls back to the project title", () => {
    expect(environmentProjectLabel({ title: "Modesto", workspaceRoot: null })).toBe("Modesto");
    expect(environmentProjectLabel({ title: "  ", workspaceRoot: null })).toBeNull();
  });
});

describe("environmentDiffStats", () => {
  it("passes through working-tree insertions and deletions", () => {
    expect(environmentDiffStats({ insertions: 85290, deletions: 2117 })).toEqual({
      insertions: 85290,
      deletions: 2117,
    });
    expect(environmentDiffStats(null)).toBeNull();
  });
});

describe("preview open tabs", () => {
  const session = (
    overrides: Partial<PreviewSessionSnapshot> & Pick<PreviewSessionSnapshot, "navStatus">,
  ): PreviewSessionSnapshot => ({
    threadId: "thread-1",
    tabId: "tab-1",
    canGoBack: false,
    canGoForward: false,
    updatedAt: "2026-09-08T00:00:00.000Z",
    ...overrides,
  });

  it("prefers the page title, then the host", () => {
    expect(
      previewSessionTitle(
        session({
          navStatus: { _tag: "Success", url: "http://localhost:5813/", title: "Modesto" },
        }),
      ),
    ).toBe("Modesto");
    expect(
      previewSessionTitle(
        session({
          navStatus: { _tag: "Success", url: "http://localhost:5813/", title: "" },
        }),
      ),
    ).toBe("localhost:5813");
    expect(previewSessionTitle(session({ navStatus: { _tag: "Idle" } }))).toBe("Browser");
  });

  it("lists each preview session as an open tab", () => {
    expect(
      previewOpenTabs({
        "tab-1": session({
          tabId: "tab-1",
          navStatus: { _tag: "Success", url: "http://localhost:5813/", title: "Modesto" },
        }),
      }),
    ).toEqual([{ tabId: "tab-1", title: "Modesto" }]);
  });
});
