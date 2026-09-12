import { describe, expect, it } from "vite-plus/test";

import {
  extractStudioText,
  isStudioDocumentPath,
  parseStudioComposerCommand,
  suggestStudioPath,
} from "./studioKinds";
import { parseDelimitedTable, serializeDelimitedTable } from "./sheetTable";

describe("studio commands", () => {
  it("parses /docs and /sheets", () => {
    expect(parseStudioComposerCommand("/docs")).toEqual({ kind: "docs", task: null });
    expect(parseStudioComposerCommand("/docs write the brief")).toEqual({
      kind: "docs",
      task: "write the brief",
    });
    expect(parseStudioComposerCommand("/spreadsheets launch checklist")).toEqual({
      kind: "sheets",
      task: "launch checklist",
    });
    expect(parseStudioComposerCommand("/sheets launch checklist")).toEqual({
      kind: "sheets",
      task: "launch checklist",
    });
    expect(parseStudioComposerCommand("/slides")).toBeNull();
  });

  it("classifies workspace paths", () => {
    expect(isStudioDocumentPath("docs", "docs/brief.md")).toBe(true);
    expect(isStudioDocumentPath("docs", "docs/brief.html")).toBe(true);
    expect(isStudioDocumentPath("dashboard", "canvas/health.html")).toBe(true);
    expect(isStudioDocumentPath("docs", "docs/slides/deck.md")).toBe(false);
    expect(isStudioDocumentPath("sheets", "sheets/plan.csv")).toBe(true);
    expect(isStudioDocumentPath("sheets", "spreadsheets/plan.csv")).toBe(true);
    expect(suggestStudioPath("sheets", "Title,Owner\nKickoff,Alex")).toBe("spreadsheets/title.csv");
    expect(suggestStudioPath("docs", "# Launch brief\n\nHi")).toBe("docs/launch-brief.html");
  });

  it("extracts csv and turns leftover markdown docs into HTML", () => {
    expect(extractStudioText("sheets", "Here\n\n```csv\nA,B\n1,2\n```\n")).toBe("A,B\n1,2\n");
    const doc = extractStudioText("docs", "```markdown\n# Hello\n\nThere\n```");
    expect(doc).toContain("<h1>Hello</h1>");
    expect(doc).toContain("<p>There</p>");
    expect(extractStudioText("dashboard", "```html\n<section>Hi</section>\n```") ?? "").toContain(
      "<section>Hi</section>",
    );
  });
});

describe("sheet table", () => {
  it("round-trips quoted csv", () => {
    const rows = parseDelimitedTable('Name,Note\n"Ada, Lovelace","Said ""hello"""\n');
    expect(rows[0]).toEqual(["Name", "Note"]);
    expect(rows[1]).toEqual(["Ada, Lovelace", 'Said "hello"']);
    expect(parseDelimitedTable(serializeDelimitedTable(rows))).toEqual(rows);
  });
});
