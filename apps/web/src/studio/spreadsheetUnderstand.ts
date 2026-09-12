import { columnLetter, type SpreadsheetFill } from "./sheetTable";

export type { SpreadsheetFill };

export type SpreadsheetValueKind =
  | "empty"
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "boolean"
  | "date"
  | "status"
  | "formula";

export const SPREADSHEET_FILLS: readonly SpreadsheetFill[] = [
  "none",
  "gray",
  "red",
  "amber",
  "green",
  "blue",
  "purple",
];

const STATUS_ALIASES: ReadonlyArray<{
  readonly match: RegExp;
  readonly label: string;
  readonly fill: SpreadsheetFill;
}> = [
  {
    match: /^(done|complete|completed|closed|shipped|yes|y|true|ok|passed)$/i,
    label: "Done",
    fill: "green",
  },
  { match: /^(open|todo|new|not started)$/i, label: "Open", fill: "amber" },
  { match: /^(wip|in progress|progress|doing|started)$/i, label: "In progress", fill: "blue" },
  { match: /^(blocked|stuck|risk|no|n|false|failed|fail)$/i, label: "Blocked", fill: "red" },
  { match: /^(review|waiting|hold|paused)$/i, label: "Review", fill: "purple" },
];

export function understandSpreadsheetInput(raw: string): {
  readonly stored: string;
  readonly kind: SpreadsheetValueKind;
  readonly fill: SpreadsheetFill;
} {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { stored: "", kind: "empty", fill: "none" };
  if (trimmed.startsWith("=")) return { stored: trimmed, kind: "formula", fill: "none" };

  const status = STATUS_ALIASES.find((entry) => entry.match.test(trimmed));
  if (status) return { stored: status.label, kind: "status", fill: status.fill };

  const currency = /^\$?\s*-?[\d,]+(?:\.\d{1,2})?$/.exec(trimmed.replaceAll(" ", ""));
  if (currency && /[$,]/.test(trimmed)) {
    const amount = Number(trimmed.replaceAll(/[$,\s]/g, ""));
    if (Number.isFinite(amount)) {
      return {
        stored: formatCurrency(amount),
        kind: "currency",
        fill: amount < 0 ? "red" : "none",
      };
    }
  }

  const percent = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(trimmed);
  if (percent) {
    const value = Number(percent[1]);
    if (Number.isFinite(value)) {
      return {
        stored: `${trimNumber(value)}%`,
        kind: "percent",
        fill: value >= 80 ? "green" : value >= 40 ? "amber" : "red",
      };
    }
  }

  if (/^(true|false)$/i.test(trimmed)) {
    const on = trimmed.toLowerCase() === "true";
    return { stored: on ? "True" : "False", kind: "boolean", fill: on ? "green" : "red" };
  }

  const date = parseLooseDate(trimmed);
  if (date) return { stored: date, kind: "date", fill: "none" };

  const numeric = Number(trimmed.replaceAll(",", ""));
  if (
    trimmed.length > 0 &&
    Number.isFinite(numeric) &&
    /^-?[\d.]+$/.test(trimmed.replaceAll(",", ""))
  ) {
    return { stored: trimNumber(numeric), kind: "number", fill: numeric < 0 ? "red" : "none" };
  }

  return { stored: raw, kind: "text", fill: "none" };
}

export function inferSpreadsheetFill(raw: string): SpreadsheetFill {
  return understandSpreadsheetInput(raw).fill;
}

export function spreadsheetFillClassName(fill: SpreadsheetFill): string {
  switch (fill) {
    case "gray":
      return "bg-muted";
    case "red":
      return "bg-red-500/15 dark:bg-red-400/20";
    case "amber":
      return "bg-amber-500/20 dark:bg-amber-400/20";
    case "green":
      return "bg-emerald-500/15 dark:bg-emerald-400/20";
    case "blue":
      return "bg-sky-500/15 dark:bg-sky-400/20";
    case "purple":
      return "bg-violet-500/15 dark:bg-violet-400/20";
    default:
      return "";
  }
}

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function parseLooseDate(value: string): string | null {
  if (!/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function parseCellAddress(address: string): { column: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(address.trim());
  if (!match) return null;
  const letters = match[1]?.toUpperCase() ?? "";
  const row = Number(match[2]);
  if (!Number.isFinite(row) || row < 1) return null;
  let column = 0;
  for (const char of letters) {
    column = column * 26 + (char.charCodeAt(0) - 64);
  }
  return { column: column - 1, row: row - 1 };
}

function cellNumber(rows: readonly (readonly string[])[], column: number, row: number): number {
  const raw = rows[row]?.[column] ?? "";
  if (raw.startsWith("=")) {
    const evaluated = evaluateSpreadsheetFormula(raw, rows, new Set([`${column}:${row}`]));
    return Number(String(evaluated).replaceAll(/[$,%\s]/g, ""));
  }
  const understood = understandSpreadsheetInput(raw);
  const numeric = Number(understood.stored.replaceAll(/[$,%\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function rangeValues(
  rows: readonly (readonly string[])[],
  start: string,
  end: string,
  seen: Set<string>,
): number[] {
  const a = parseCellAddress(start);
  const b = parseCellAddress(end);
  if (!a || !b) return [];
  const values: number[] = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row += 1) {
    for (
      let column = Math.min(a.column, b.column);
      column <= Math.max(a.column, b.column);
      column += 1
    ) {
      const key = `${column}:${row}`;
      if (seen.has(key)) continue;
      const raw = rows[row]?.[column] ?? "";
      if (raw.startsWith("=")) {
        const nested = evaluateSpreadsheetFormula(raw, rows, new Set(seen).add(key));
        const numeric = Number(String(nested).replaceAll(/[$,%\s]/g, ""));
        if (Number.isFinite(numeric)) values.push(numeric);
      } else {
        values.push(cellNumber(rows, column, row));
      }
    }
  }
  return values;
}

export function evaluateSpreadsheetFormula(
  formula: string,
  rows: readonly (readonly string[])[],
  seen: Set<string> = new Set(),
): string {
  const body = formula.trim().replace(/^=/, "").trim();
  const func = /^(SUM|AVG|AVERAGE|COUNT|MIN|MAX)\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)$/i.exec(
    body,
  );
  if (func) {
    const values = rangeValues(rows, func[2] ?? "", func[3] ?? "", seen);
    const name = func[1]?.toUpperCase();
    if (name === "COUNT") return String(values.length);
    if (values.length === 0) return "0";
    if (name === "MIN") return trimNumber(Math.min(...values));
    if (name === "MAX") return trimNumber(Math.max(...values));
    const total = values.reduce((sum, value) => sum + value, 0);
    if (name === "AVG" || name === "AVERAGE") return trimNumber(total / values.length);
    return trimNumber(total);
  }
  const single = parseCellAddress(body);
  if (single) return rows[single.row]?.[single.column] ?? "";

  const tokens = body
    .split(/([+-])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (tokens.length >= 1) {
    let total = 0;
    let sign = 1;
    let parsedAny = false;
    for (const token of tokens) {
      if (token === "+") {
        sign = 1;
        continue;
      }
      if (token === "-") {
        sign = -1;
        continue;
      }
      const ref = parseCellAddress(token);
      const numeric = ref
        ? cellNumber(rows, ref.column, ref.row)
        : Number(token.replaceAll(",", ""));
      if (!Number.isFinite(numeric)) return "#VALUE";
      total += sign * numeric;
      parsedAny = true;
    }
    if (parsedAny) return trimNumber(total);
  }
  return "#VALUE";
}

export function displaySpreadsheetCell(
  raw: string,
  rows: readonly (readonly string[])[],
  column: number,
  row: number,
): string {
  if (!raw.startsWith("=")) return understandSpreadsheetInput(raw).stored;
  return evaluateSpreadsheetFormula(raw, rows, new Set([`${column}:${row}`]));
}

export function cellAddress(column: number, row: number): string {
  return `${columnLetter(column)}${row + 1}`;
}
