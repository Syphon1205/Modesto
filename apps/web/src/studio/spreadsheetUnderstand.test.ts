import { describe, expect, it } from "vite-plus/test";

import { parseSpreadsheetDocument, serializeSpreadsheetDocument } from "./sheetTable";
import {
  displaySpreadsheetCell,
  evaluateSpreadsheetFormula,
  understandSpreadsheetInput,
} from "./spreadsheetUnderstand";

describe("spreadsheet input understanding", () => {
  it("normalizes status, percent, money, and dates", () => {
    expect(understandSpreadsheetInput("wip")).toEqual({
      stored: "In progress",
      kind: "status",
      fill: "blue",
    });
    expect(understandSpreadsheetInput("done").fill).toBe("green");
    expect(understandSpreadsheetInput("blocked").fill).toBe("red");
    expect(understandSpreadsheetInput("80%")).toMatchObject({
      stored: "80%",
      kind: "percent",
      fill: "green",
    });
    expect(understandSpreadsheetInput("$1,200").kind).toBe("currency");
    expect(understandSpreadsheetInput("2026-09-04").kind).toBe("date");
  });

  it("evaluates sum and cell arithmetic", () => {
    const rows = [
      ["Title", "Amount"],
      ["A", "10"],
      ["B", "5"],
      ["Total", "=SUM(B2:B3)"],
    ];
    expect(evaluateSpreadsheetFormula("=SUM(B2:B3)", rows)).toBe("15");
    expect(evaluateSpreadsheetFormula("=B2+B3", rows)).toBe("15");
    expect(displaySpreadsheetCell("=B2+B3", rows, 1, 3)).toBe("15");
  });

  it("persists fills beside the csv", () => {
    const serialized = serializeSpreadsheetDocument([["Status"], ["Open"]], { "0:1": "amber" });
    expect(serialized.startsWith("#fills:")).toBe(true);
    const parsed = parseSpreadsheetDocument(serialized);
    expect(parsed.rows[1]?.[0]).toBe("Open");
    expect(parsed.fills["0:1"]).toBe("amber");
  });
});
