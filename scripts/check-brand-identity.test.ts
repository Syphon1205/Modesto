import { describe, expect, it } from "vitest";

import {
  findBrandIdentityViolations,
  findVisualBrandAssetViolations,
} from "./check-brand-identity.ts";

const characters = (...codes: number[]): string => String.fromCharCode(...codes);
const shortName = characters(116, 51);
const firstName = `${shortName}${characters(99, 111, 100, 101)}`;
const secondName = characters(100, 112, 99, 111, 100, 101);

describe("brand identity guard", () => {
  it("detects retired names in paths and text", () => {
    const violations = findBrandIdentityViolations([
      { path: `docs/${firstName}.md`, contents: "Modesto" },
      { path: "source.ts", contents: `const value = "${secondName}:state";` },
    ]);
    expect(violations).toHaveLength(2);
  });

  it("does not match ordinary numeric type names or canonical Modesto text", () => {
    expect(
      findBrandIdentityViolations([
        { path: "source.ts", contents: "const value = new Uint32Array(); // Modesto" },
      ]),
    ).toEqual([]);
  });

  it("preserves upstream legal attribution without allowing unrelated retired brands", () => {
    const notice = `Copyright (c) 2026 T3 Tools Inc.`;
    expect(findBrandIdentityViolations([{ path: "LICENSE", contents: notice }])).toEqual([]);
    expect(findBrandIdentityViolations([{ path: "README.md", contents: notice }])).toHaveLength(1);
    expect(findBrandIdentityViolations([{ path: "LICENSE", contents: secondName }])).toHaveLength(
      1,
    );
  });

  it("preserves stable source identifiers and known MCP and storage compatibility keys", () => {
    expect(
      findBrandIdentityViolations([
        {
          path: "packages/contracts/src/t3ProjectFile.ts",
          contents: 'const T3_PROJECT_FILE = "t3.json";',
        },
        {
          path: "apps/server/src/provider/Layers/CodexAdapter.ts",
          contents: '"mcp_servers.t3-code.url"',
        },
        { path: "apps/web/src/uiStateStore.ts", contents: '"codething:renderer-state:v4"' },
        {
          path: "apps/web/src/themePalette.ts",
          contents: "const T3_CODE_LIGHT_THEME_COLORS = {};",
        },
      ]),
    ).toEqual([]);
    expect(
      findBrandIdentityViolations([
        { path: "apps/web/src/components/Header.tsx", contents: "<h1>T3 Code</h1>" },
        { path: "apps/marketing/src/pages/download.astro", contents: "https://app.t3.codes" },
        { path: "apps/web/src/uiStateStore.ts", contents: '"codething:another-public-brand"' },
      ]),
    ).toHaveLength(3);
  });

  it("permits protocol fixtures and comments while scanning nearby display strings", () => {
    expect(
      findBrandIdentityViolations([
        { path: "source.test.ts", contents: '"T3 Code"' },
        { path: "source.ts", contents: '// Migrated from T3 Code\nconst label = "T3 Code";' },
      ]),
    ).toEqual([{ path: "source.ts", line: 2, text: 'const label = "T3 Code";' }]);
  });

  it("rejects unreviewed marketing screenshots, including restored upstream screenshots", () => {
    expect(
      findVisualBrandAssetViolations(
        [
          { path: "apps/marketing/public/screenshot.webp", contents: new Uint8Array([1]) },
          { path: "apps/marketing/public/updated-screenshot.webp", contents: new Uint8Array([2]) },
        ],
        new Map(),
      ),
    ).toHaveLength(2);
  });

  it("requires user-facing raster assets to match a visually approved digest", () => {
    const approvedContents = new TextEncoder().encode("approved Modesto screenshot");
    const approvedDigest = "2ba6b88ce40b1393ab572e6149c47c8c20fedbd2e68e8a08ac931229e5d2531b";
    const approvedDigests = new Map([["screenshot.jpeg", approvedDigest]]);

    expect(
      findVisualBrandAssetViolations(
        [{ path: "screenshot.jpeg", contents: approvedContents }],
        approvedDigests,
      ),
    ).toEqual([]);
    expect(
      findVisualBrandAssetViolations(
        [{ path: "screenshot.jpeg", contents: new TextEncoder().encode("changed") }],
        approvedDigests,
      ),
    ).toHaveLength(1);
    expect(findVisualBrandAssetViolations([], approvedDigests)).toHaveLength(1);
  });
});
