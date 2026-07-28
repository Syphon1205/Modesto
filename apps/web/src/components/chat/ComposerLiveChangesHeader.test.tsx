import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

describe("ComposerLiveChangesHeader", () => {
  it("shows live edited filenames, language icons, and incremental diff stats", async () => {
    const { ComposerLiveChangesHeader } = await import("./ComposerLiveChangesHeader");
    const markup = renderToStaticMarkup(
      <ComposerLiveChangesHeader
        fileCount={2}
        additions={12}
        deletions={3}
        files={[
          { path: "apps/web/src/ChatView.tsx", additions: 9, deletions: 2 },
          { path: "apps/server/src/index.ts", additions: 3, deletions: 1 },
        ]}
        onReview={() => {}}
      />,
    );

    expect(markup).toContain("Editing 2 files");
    expect(markup).toContain('data-live-edit-files="true"');
    expect(markup).toContain("ChatView.tsx");
    expect(markup).toContain("index.ts");
    expect(markup).toContain("typescript");
    expect(markup).toContain("+12");
    expect(markup).toContain("-3");
    expect(markup).toContain("Review");
  });

  it("shows an active editing state before diff totals arrive", async () => {
    const { ComposerLiveChangesHeader } = await import("./ComposerLiveChangesHeader");
    const markup = renderToStaticMarkup(
      <ComposerLiveChangesHeader
        fileCount={1}
        additions={0}
        deletions={0}
        files={[{ path: "Sources/LiveMapView.swift", additions: 0, deletions: 0 }]}
      />,
    );

    expect(markup).toContain("Editing LiveMapView.swift");
    expect(markup).toContain("editing…");
    expect(markup).not.toContain("Review");
  });
});
