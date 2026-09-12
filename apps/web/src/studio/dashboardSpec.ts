import { displaySpreadsheetCell } from "./spreadsheetUnderstand";

export interface DashboardMetric {
  readonly label: string;
  readonly value: string;
}

export interface DashboardChart {
  readonly title: string;
  readonly points: readonly { readonly label: string; readonly value: number }[];
}

export interface DashboardSpec {
  readonly title: string;
  readonly metrics: readonly DashboardMetric[];
  readonly chart: DashboardChart | null;
}

const FENCED = /```(?:md|markdown)?[ \t]*\r?\n([\s\S]*?)(?:```|$)/i;

export function starterDashboardMarkdown(): string {
  return `# Canvas

A live dashboard for this thread.

## Metrics
- Open | 3
- In progress | 2
- Done | 8

## Chart
| Status | Count |
| Open | 3 |
| In progress | 2 |
| Done | 8 |
`;
}

export function isDashboardPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  return normalized.endsWith(".md") && /(^|\/)canvas\//.test(normalized);
}

export function extractDashboardMarkdown(text: string): string | null {
  if (text.includes("Build an in-app canvas in this workspace.")) {
    const fence = FENCED.exec(text);
    if (fence?.[1]?.trim()) return `${fence[1].trim()}\n`;
  }
  const fence = FENCED.exec(text);
  if (fence?.[1] && /^#\s+/m.test(fence[1]) && /##\s+Metrics/i.test(fence[1])) {
    return `${fence[1].trim()}\n`;
  }
  if (/^#\s+/m.test(text) && /##\s+(Metrics|Chart)/i.test(text)) {
    return `${text.trim()}\n`;
  }
  return null;
}

export function parseDashboardSpec(markdown: string): DashboardSpec {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || "Dashboard";
  const metrics: DashboardMetric[] = [];
  for (const match of markdown.matchAll(/^[-*]\s+([^|\n]+)\|\s*(.+)$/gm)) {
    const label = match[1]?.trim() ?? "";
    const value = match[2]?.trim() ?? "";
    if (label.length > 0 && value.length > 0) metrics.push({ label, value });
  }
  const table = markdown.match(/\|([^\n]+)\|\n\|[-| :]+?\|\n((?:\|[^\n]+\|\n?)+)/);
  let chart: DashboardChart | null = null;
  if (table) {
    const headers = splitRow(table[1] ?? "");
    const rows = (table[2] ?? "")
      .trim()
      .split("\n")
      .map(splitRow)
      .filter((row) => row.length >= 2);
    const points = rows
      .map((row) => ({
        label: row[0] ?? "",
        value: Number(String(row[1] ?? "").replaceAll(/[$,%\s]/g, "")),
      }))
      .filter((point) => point.label.length > 0 && Number.isFinite(point.value));
    if (points.length > 0) {
      chart = { title: headers[1]?.trim() || headers[0]?.trim() || "Chart", points };
    }
  }
  return { title, metrics: metrics.slice(0, 8), chart };
}

function splitRow(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

export function dashboardSpecFromSpreadsheet(
  rows: readonly (readonly string[])[],
): DashboardSpec | null {
  if (rows.length < 2) return null;
  const header = rows[0] ?? [];
  const labelIndex = 0;
  let valueIndex = header.findIndex((cell, index) => index > 0 && looksNumericColumn(rows, index));
  if (valueIndex < 0) {
    valueIndex = header.findIndex((_, index) => index > 0);
  }
  if (valueIndex < 0) return null;
  const points = rows.slice(1).flatMap((row, index) => {
    const label = row[labelIndex]?.trim() ?? "";
    const displayed = displaySpreadsheetCell(row[valueIndex] ?? "", rows, valueIndex, index + 1);
    const value = Number(displayed.replaceAll(/[$,%\s]/g, ""));
    return label.length > 0 && Number.isFinite(value) ? [{ label, value }] : [];
  });
  const statusIndex = header.findIndex((cell) => /status/i.test(cell));
  const metrics: DashboardMetric[] = [];
  if (statusIndex >= 0) {
    const counts = new Map<string, number>();
    for (const row of rows.slice(1)) {
      const status = row[statusIndex]?.trim();
      if (!status) continue;
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    for (const [label, count] of counts) metrics.push({ label, value: String(count) });
  }
  if (points.length === 0 && metrics.length === 0) return null;
  return {
    title: header[0]?.trim() || "Spreadsheet",
    metrics: metrics.slice(0, 6),
    chart:
      points.length > 0
        ? { title: header[valueIndex]?.trim() || "Values", points: points.slice(0, 12) }
        : null,
  };
}

function looksNumericColumn(rows: readonly (readonly string[])[], index: number): boolean {
  let hits = 0;
  for (const row of rows.slice(1)) {
    const value = Number(
      String(row[index] ?? "")
        .replaceAll(/[$,%\s=%]/g, "")
        .replace(/^[A-Z]+\d+$/i, ""),
    );
    if (Number.isFinite(value) && String(row[index] ?? "").length > 0) hits += 1;
  }
  return hits >= Math.max(1, rows.length - 2);
}
