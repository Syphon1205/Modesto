// FILE: FileEntryIcon.test.tsx
// Purpose: Guards colored file/folder glyph rendering in editor-style file lists.
// Layer: Component rendering tests
// Depends on: FileEntryIcon and React server rendering.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FileEntryIcon } from "./FileEntryIcon";

describe("FileEntryIcon", () => {
  it("tints known file types with their icon color", () => {
    const markup = renderToStaticMarkup(
      <FileEntryIcon pathValue="src/EditorWorkspaceView.tsx" kind="file" />,
    );

    expect(markup).toContain("text-[#61dafb]");
  });

  it("renders folders with the neutral folder color", () => {
    const markup = renderToStaticMarkup(
      <FileEntryIcon pathValue="src/components" kind="directory" />,
    );

    expect(markup).toContain("text-muted-foreground");
  });

  it("renders Swift files with a branded language glyph", () => {
    const markup = renderToStaticMarkup(
      <FileEntryIcon pathValue="Sources/App.swift" kind="file" />,
    );

    expect(markup).toContain('data-language-icon="swift"');
    expect(markup).toContain("#F05138");
  });

  it("honors inherited color in timeline rows", () => {
    const markup = renderToStaticMarkup(
      <FileEntryIcon pathValue="Sources/App.swift" kind="file" colorMode="inherit" />,
    );

    expect(markup).toContain('data-language-icon="swift"');
    expect(markup).toContain('fill="currentColor"');
  });
});
