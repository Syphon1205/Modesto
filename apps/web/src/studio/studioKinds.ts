import {
  documentPreviewHtml,
  extractCanvasFences,
  extractHtmlArtifact,
  looksLikeHtml,
} from "./canvasLanguages";

export type StudioKind = "docs" | "sheets" | "dashboard";

export const DOCS_BUILD_MARKER = "Build an in-app document in this workspace.";
export const SHEETS_BUILD_MARKER = "Build an in-app spreadsheet in this workspace.";
export const DASHBOARD_BUILD_MARKER = "Build an in-app canvas in this workspace.";

const DOCS_STARTER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Untitled document</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100%; background: transparent; }
</style>
</head>
<body></body>
</html>
`;

const SHEETS_STARTER = `Title,Owner,Status,Progress
`;

const DASHBOARD_STARTER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Canvas</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; min-height: 100%; background: transparent; }
</style>
</head>
<body></body>
</html>
`;

export function starterStudioText(kind: StudioKind): string {
  if (kind === "docs") return DOCS_STARTER;
  if (kind === "dashboard") return DASHBOARD_STARTER;
  return SHEETS_STARTER;
}

export function isStarterStudioText(kind: StudioKind, text: string): boolean {
  return text === starterStudioText(kind);
}

export function isStudioDocumentPath(kind: StudioKind, path: string): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  if (kind === "docs") {
    return (
      /(^|\/)docs\//.test(normalized) &&
      !/(^|\/)slides\//.test(normalized) &&
      /\.(md|html|htm|css|js)$/.test(normalized)
    );
  }
  if (kind === "dashboard") {
    return /(^|\/)canvas\//.test(normalized) && /\.(md|html|htm|css|js)$/.test(normalized);
  }
  return /(^|\/)(?:sheets|spreadsheets)\//.test(normalized) && /\.(csv|tsv)$/.test(normalized);
}

export function suggestStudioPath(kind: StudioKind, text: string): string {
  const first =
    kind === "sheets"
      ? (text.split("\n")[0]?.split(",")[0] ?? "sheet")
      : (/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] ??
        /^#\s+(.+)$/m.exec(text)?.[1] ??
        (kind === "dashboard" ? "dashboard" : "document"));
  const slug = first
    .normalize("NFKD")
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  if (kind === "sheets") return `spreadsheets/${slug.length > 0 ? slug : "spreadsheet"}.csv`;
  if (kind === "dashboard") return `canvas/${slug.length > 0 ? slug : "dashboard"}.html`;
  return `docs/${slug.length > 0 ? slug : "document"}.html`;
}

export function studioBuildInstructions(kind: StudioKind): string {
  if (kind === "docs") {
    return `${DOCS_BUILD_MARKER}

The language is HTML + CSS (JS only if the page must do something). Write a complete document: title, hierarchy, readable measure, real layout. Do not write Markdown.

Put the source in your reply (\`\`\`html, plus \`\`\`css / \`\`\`js if they are separate) so the Docs panel can show it immediately. Save it under \`docs/<short-slug>.html\`.`;
  }
  if (kind === "dashboard") {
    return `${DASHBOARD_BUILD_MARKER}

This is the Modesto design canvas — HTML, CSS, and JavaScript, like a live artifact. When the user asks for a chart, graph, plot, or diagram, render it as a real visual in the canvas (Chart.js / SVG / canvas API / CSS), not ASCII or a description. For a generated image or plot file, save it under \`exports/<short-slug>.png\` (or .svg) and also link it in your reply so the app can open it.

Put a complete HTML document in your reply (\`\`\`html, with \`\`\`css / \`\`\`js if split). Also save it under \`canvas/<short-slug>.html\`.`;
  }
  return `${SHEETS_BUILD_MARKER}

This is Modesto Spreadsheets — CSV is the language, plus Excel-style formulas in cells (\`=SUM(D2:D4)\`, \`=B2+B3\`). Write a header row and data rows. Status can be natural language; Progress can be percents or formulas.

Put the CSV in your reply (\`\`\`csv). Also save it under \`spreadsheets/<short-slug>.csv\`.`;
}

export function defaultStudioTopic(
  kind: StudioKind,
  context: { readonly threadTitle?: string | null; readonly projectTitle?: string | null },
): string {
  const about = [context.threadTitle?.trim(), context.projectTitle?.trim()]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(" — ");
  const subject = about.length > 0 ? about : "this thread and project";
  if (kind === "docs") {
    return `A designed working document about ${subject}: purpose, current state, decisions, and next steps. Use HTML/CSS so it reads like a real page.`;
  }
  if (kind === "dashboard") {
    return `A designed interactive dashboard about ${subject}: metrics, a chart or visual, and one useful interaction. HTML, CSS, and JS.`;
  }
  return `A useful spreadsheet about ${subject}: columns someone can fill in, a header row, starter rows, and formulas where they help.`;
}

export function studioBuildPrompt(kind: StudioKind, task: string): string {
  return `${studioBuildInstructions(kind)}\n\nTopic:\n${task}`;
}

export function isStudioBuildPrompt(kind: StudioKind, text: string): boolean {
  if (kind === "docs") return text.includes(DOCS_BUILD_MARKER);
  if (kind === "dashboard") return text.includes(DASHBOARD_BUILD_MARKER);
  return text.includes(SHEETS_BUILD_MARKER);
}

export type ParsedStudioComposerCommand = {
  readonly kind: StudioKind;
  readonly task: string | null;
};

export function parseStudioComposerCommand(text: string): ParsedStudioComposerCommand | null {
  const match = /^\/(docs|doc|spreadsheets|spreadsheet|sheets|sheet)(?:\s+([\s\S]*))?$/i.exec(
    text.trim(),
  );
  if (!match) return null;
  const name = match[1]?.toLowerCase() ?? "";
  const kind: StudioKind = name === "docs" || name === "doc" ? "docs" : "sheets";
  const task = match[2]?.trim() ?? "";
  return { kind, task: task.length > 0 ? task : null };
}

export function resolveStudioSendPrompt(
  command: ParsedStudioComposerCommand,
  context: { readonly threadTitle?: string | null; readonly projectTitle?: string | null },
): string {
  return studioBuildPrompt(command.kind, command.task ?? defaultStudioTopic(command.kind, context));
}

export function extractStudioText(kind: StudioKind, text: string): string | null {
  const fences = extractCanvasFences(text);
  if (kind === "sheets") {
    if (fences.csv?.trim()) return fences.csv.trimEnd() + "\n";
  } else {
    const html = extractHtmlArtifact(text);
    if (html) return html.endsWith("\n") ? html : `${html}\n`;
    if (kind === "docs" && fences.markdown?.trim()) {
      return `${documentPreviewHtml(fences.markdown)}\n`;
    }
    if (fences.markdown?.trim()) return fences.markdown.trim() + "\n";
  }
  const generic = fences.html
    ? null
    : [...text.matchAll(/```[ \t]*\r?\n([\s\S]*?)(?:```|$)/g)].find(
        (match) => (match[1] ?? "").trim().length > 0,
      );
  if (generic?.[1]?.trim()) {
    const body = generic[1].trim();
    if (kind === "sheets" && body.includes(",")) return `${body}\n`;
    if (kind === "docs" && (looksLikeHtml(body) || /^#\s+/m.test(body))) {
      return `${documentPreviewHtml(body)}\n`;
    }
    if (kind !== "sheets" && (looksLikeHtml(body) || /^#\s+/m.test(body))) return `${body}\n`;
  }
  if (kind === "dashboard" && /##\s+(Metrics|Chart)/i.test(text) && !looksLikeHtml(text)) {
    return `${text.trim()}\n`;
  }
  if (kind === "docs" && /^#\s+/m.test(text) && !text.includes("Build an in-app slide deck")) {
    return `${documentPreviewHtml(text.trim())}\n`;
  }
  if (kind === "sheets") {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes(",") && !line.startsWith("#") && !line.startsWith("```"));
    if (lines.length >= 2) return `${lines.join("\n")}\n`;
  }
  return null;
}

export function latestStudioPath(
  kind: StudioKind,
  files: ReadonlyArray<{ readonly path: string }>,
): string | null {
  for (let index = files.length - 1; index >= 0; index -= 1) {
    const path = files[index]?.path;
    if (path && isStudioDocumentPath(kind, path)) return path.replaceAll("\\", "/");
  }
  return null;
}
