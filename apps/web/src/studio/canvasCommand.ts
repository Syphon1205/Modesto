import {
  defaultSlidesTopic,
  SLIDES_DECK_INSTRUCTIONS,
  slidesBuildPrompt,
} from "../slides/slideDeck";
import {
  defaultStudioTopic,
  studioBuildInstructions,
  studioBuildPrompt,
  type StudioKind,
} from "./studioKinds";

export type CanvasMode = "slides" | "docs" | "spreadsheets" | "dashboard";

export const CANVAS_BUILD_MARKER = "Build an in-app canvas in this workspace.";

export type ParsedCanvasComposerCommand = {
  readonly mode: CanvasMode;
  readonly task: string | null;
};

const MODE_ALIASES: Readonly<Record<string, CanvasMode>> = {
  slide: "slides",
  slides: "slides",
  deck: "slides",
  doc: "docs",
  docs: "docs",
  document: "docs",
  sheet: "spreadsheets",
  sheets: "spreadsheets",
  spreadsheet: "spreadsheets",
  spreadsheets: "spreadsheets",
  dash: "dashboard",
  dashboard: "dashboard",
  dashboards: "dashboard",
};

export function parseCanvasComposerCommand(text: string): ParsedCanvasComposerCommand | null {
  const trimmed = text.trim();
  const canvas = /^\/canvas(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (canvas) {
    const rest = canvas[1]?.trim() ?? "";
    if (rest.length === 0) return { mode: "dashboard", task: null };
    const first = rest.split(/\s+/, 1)[0]?.toLowerCase() ?? "";
    const mode = MODE_ALIASES[first];
    if (mode) {
      const task = rest.slice(first.length).trim();
      return { mode, task: task.length > 0 ? task : null };
    }
    return { mode: "dashboard", task: rest };
  }
  const legacy =
    /^\/(slides|docs|doc|spreadsheets|spreadsheet|sheets|sheet)(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (!legacy) return null;
  const mode = MODE_ALIASES[legacy[1]?.toLowerCase() ?? ""] ?? "dashboard";
  const task = legacy[2]?.trim() ?? "";
  return { mode, task: task.length > 0 ? task : null };
}

export function canvasBuildInstructions(mode: CanvasMode): string {
  if (mode === "slides") return SLIDES_DECK_INSTRUCTIONS;
  if (mode === "docs") return studioBuildInstructions("docs");
  if (mode === "spreadsheets") return studioBuildInstructions("sheets");
  return `${CANVAS_BUILD_MARKER}

This is one Canvas with four views, each with its own language:

- Dashboard: HTML + CSS + JS (a designed, interactive artifact — not a Markdown list)
- Slides: HTML \`<section>\` slides with CSS (Markdown \`---\` decks are a fallback)
- Docs: HTML/CSS pages (Markdown only if the user wants a plain brief)
- Spreadsheets: CSV + Excel-style formulas (\`=SUM\`, \`=B2+B3\`)

Build the Dashboard first as a complete HTML document. Put \`\`\`html (and \`\`\`css / \`\`\`js if split) in your reply so the Canvas preview updates live. Save it under \`canvas/<short-slug>.html\`. Add \`spreadsheets/<short-slug>.csv\` or \`slides/<short-slug>.html\` only when those views are needed. When the user asks for a chart, graph, plot, or diagram, render a real visual (Chart.js / SVG / canvas) — not ASCII. For a generated image or plot file, save under \`exports/<short-slug>.png\` (or .svg) and link it in your reply.`;
}

export function defaultCanvasTopic(
  mode: CanvasMode,
  context: { readonly threadTitle?: string | null; readonly projectTitle?: string | null },
): string {
  if (mode === "slides") return defaultSlidesTopic(context);
  if (mode === "docs") return defaultStudioTopic("docs", context);
  if (mode === "spreadsheets") return defaultStudioTopic("sheets", context);
  const about = [context.threadTitle?.trim(), context.projectTitle?.trim()]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(" — ");
  const subject = about.length > 0 ? about : "this thread and project";
  return `A designed interactive dashboard about ${subject}: metrics, a visual, and one useful interaction. HTML, CSS, and JS.`;
}

export function resolveCanvasSendPrompt(
  command: ParsedCanvasComposerCommand,
  context: { readonly threadTitle?: string | null; readonly projectTitle?: string | null },
): string {
  const topic = command.task ?? defaultCanvasTopic(command.mode, context);
  if (command.mode === "slides") return slidesBuildPrompt(topic);
  if (command.mode === "docs") return studioBuildPrompt("docs", topic);
  if (command.mode === "spreadsheets") return studioBuildPrompt("sheets", topic);
  return `${canvasBuildInstructions("dashboard")}\n\nTopic:\n${topic}`;
}

export function isCanvasBuildPrompt(text: string): boolean {
  return text.includes(CANVAS_BUILD_MARKER);
}

export function studioKindForCanvasMode(mode: CanvasMode): StudioKind | null {
  if (mode === "docs") return "docs";
  if (mode === "spreadsheets") return "sheets";
  if (mode === "dashboard") return "dashboard";
  return null;
}
