import { describe, expect, it } from "vitest";

import {
  classifyArtifactPreview,
  collectThreadArtifacts,
  findArtifactTargets,
} from "./artifactTargets";

const paths = (text: string) => findArtifactTargets(text).map((target) => target.path);

describe("finding artifacts in an assistant message", () => {
  it("finds a markdown-linked file", () => {
    const [target] = findArtifactTargets("I wrote [the report](reports/q4.md) for you.");

    expect(target?.path).toBe("reports/q4.md");
    expect(target?.name).toBe("q4.md");
    expect(target?.preview).toBe("markdown");
    expect(target?.reason).toBe("markdown link");
  });

  it("finds a backticked path", () => {
    expect(paths("Saved to `out/summary.csv`.")).toEqual(["out/summary.csv"]);
  });

  it("finds a bare path that names a directory", () => {
    expect(paths("Results are in exports/data.json now.")).toEqual(["exports/data.json"]);
  });

  it("ignores a bare filename mentioned in prose", () => {
    // "update package.json" is a mention, not an offer to open something.
    // Turning every one into a chip is how the strip becomes noise.
    expect(paths("Remember to update package.json before shipping.")).toEqual([]);
  });

  it("keeps a bare filename when it was written as code", () => {
    expect(paths("Edit `package.json` and retry.")).toEqual(["package.json"]);
  });

  it("ignores URLs, which are browser targets rather than workspace files", () => {
    expect(paths("See [docs](https://example.com/guide.html) for details.")).toEqual([]);
    expect(paths("Fetch `https://example.com/a.json` first.")).toEqual([]);
  });

  it("ignores anchors and mail links", () => {
    expect(paths("Jump to [section](#results.md)")).toEqual([]);
  });

  it("reports one artifact per file, at its strongest evidence", () => {
    const targets = findArtifactTargets(
      "Wrote reports/q4.md. See [the report](reports/q4.md) or open `reports/q4.md`.",
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]?.reason).toBe("markdown link");
    expect(targets[0]?.confidence).toBeGreaterThan(0.8);
  });

  it("strips a file:line citation, which is not part of the filename", () => {
    // Agents cite locations constantly. Left in, `a.tsx:212` becomes a second
    // artifact for the same file that could never be opened - caught live.
    expect(paths("Fixed `app/run/[id].tsx:212` for you.")).toEqual(["app/run/[id].tsx"]);
    expect(paths("See `src/a.ts:12:5`.")).toEqual(["src/a.ts"]);
  });

  it("collapses a cited location and the bare path into one artifact", () => {
    const targets = findArtifactTargets("Edited `src/a.ts:12`, see [it](src/a.ts).");

    expect(targets).toHaveLength(1);
    expect(targets[0]?.path).toBe("src/a.ts");
  });

  it("strips sentence punctuation that trails a path", () => {
    expect(paths("Everything landed in build/out.html, finally.")).toEqual(["build/out.html"]);
  });

  it("ranks stronger evidence first", () => {
    const targets = findArtifactTargets("Linked [a](docs/a.md) and mentioned `notes/b.txt`.");

    expect(targets.map((target) => target.path)).toEqual(["docs/a.md", "notes/b.txt"]);
  });

  it("returns nothing for text with no files", () => {
    expect(findArtifactTargets("All done - the tests pass.")).toEqual([]);
    expect(findArtifactTargets("")).toEqual([]);
  });

  it("ignores a path-shaped string with no extension", () => {
    expect(paths("Look in `src/components` for it.")).toEqual([]);
  });
});

describe("classifyArtifactPreview", () => {
  it("maps extensions to how the file should be shown", () => {
    expect(classifyArtifactPreview("a/b.md")).toBe("markdown");
    expect(classifyArtifactPreview("slides/pitch.md")).toBe("slides");
    expect(classifyArtifactPreview("docs/brief.md")).toBe("document");
    expect(classifyArtifactPreview("canvas/health.md")).toBe("document");
    expect(classifyArtifactPreview("sheets/plan.csv")).toBe("sheet");
    expect(classifyArtifactPreview("docs/slides/deck.md")).toBe("slides");
    expect(classifyArtifactPreview("a/b.csv")).toBe("sheet");
    expect(classifyArtifactPreview("a/b.xlsx")).toBe("sheet");
    expect(classifyArtifactPreview("a/b.png")).toBe("image");
    expect(classifyArtifactPreview("a/b.pdf")).toBe("pdf");
    expect(classifyArtifactPreview("a/b.html")).toBe("html");
    expect(classifyArtifactPreview("a/b.docx")).toBe("document");
    expect(classifyArtifactPreview("a/b.pptx")).toBe("slides");
    expect(classifyArtifactPreview("a/b.ts")).toBe("text");
  });

  it("is case-insensitive about the extension", () => {
    expect(classifyArtifactPreview("REPORT.MD")).toBe("markdown");
  });

  it("falls back to other for anything unrecognized", () => {
    expect(classifyArtifactPreview("a/b.bin")).toBe("other");
    expect(classifyArtifactPreview("Makefile")).toBe("other");
    // A dotfile is not an extension.
    expect(classifyArtifactPreview(".gitignore")).toBe("other");
  });
});

const assistant = (text: string) => ({ role: "assistant", text });

describe("collecting a thread's artifacts", () => {
  it("gathers artifacts across assistant messages, newest first", () => {
    const collected = collectThreadArtifacts([
      assistant("Wrote [one](out/a.md)."),
      assistant("Wrote [two](out/b.csv)."),
    ]);

    expect(collected.map((target) => target.path)).toEqual(["out/b.csv", "out/a.md"]);
  });

  it("ignores user messages", () => {
    // A path the user typed is a request, not something the agent produced.
    expect(collectThreadArtifacts([{ role: "user", text: "read [x](docs/x.md)" }])).toEqual([]);
  });

  it("shows a regenerated file where it was last produced", () => {
    const collected = collectThreadArtifacts([
      assistant("Wrote [a](out/a.md)."),
      assistant("Wrote [b](out/b.md)."),
      assistant("Regenerated [a](out/a.md)."),
    ]);

    expect(collected.map((target) => target.path)).toEqual(["out/a.md", "out/b.md"]);
  });

  it("honours a limit", () => {
    const collected = collectThreadArtifacts([assistant("[a](o/a.md) [b](o/b.md) [c](o/c.md)")], {
      limit: 2,
    });

    expect(collected).toHaveLength(2);
  });
});
