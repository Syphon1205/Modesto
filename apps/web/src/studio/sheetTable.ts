export type SpreadsheetFill = "none" | "gray" | "red" | "amber" | "green" | "blue" | "purple";

const FILLS_PREFIX = "#fills:";

export function parseSpreadsheetDocument(text: string): {
  readonly rows: string[][];
  readonly fills: Record<string, SpreadsheetFill>;
} {
  const source = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = source.split("\n");
  let fills: Record<string, SpreadsheetFill> = {};
  const tableLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(FILLS_PREFIX)) {
      try {
        const parsed = JSON.parse(line.slice(FILLS_PREFIX.length)) as Record<
          string,
          SpreadsheetFill
        >;
        if (parsed && typeof parsed === "object") fills = parsed;
      } catch {
        fills = {};
      }
      continue;
    }
    tableLines.push(line);
  }
  return { rows: parseDelimitedTable(tableLines.join("\n")), fills };
}

export function serializeSpreadsheetDocument(
  rows: readonly (readonly string[])[],
  fills: Readonly<Record<string, SpreadsheetFill>>,
): string {
  const table = serializeDelimitedTable(rows);
  const entries = Object.entries(fills).filter(([, fill]) => fill !== "none");
  if (entries.length === 0) return table;
  return `${FILLS_PREFIX}${JSON.stringify(Object.fromEntries(entries))}\n${table}`;
}

export function parseDelimitedTable(text: string): string[][] {
  const source = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const delimiter = source.includes("\t") && !source.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  for (const line of source.split("\n")) {
    if (line.startsWith(FILLS_PREFIX)) continue;
    if (line.length === 0 && rows.length > 0) continue;
    rows.push(splitDelimitedLine(line, delimiter));
  }
  const width = rows.reduce((max, row) => Math.max(max, row.length), 1);
  return rows.length > 0
    ? rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")])
    : [Array.from({ length: 3 }, () => "")];
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function serializeDelimitedTable(rows: readonly (readonly string[])[]): string {
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}
