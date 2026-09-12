/**
 * Detects ChatGPT-style visual payloads and user asks for graphs/images.
 * Pure helpers — no React, no I/O.
 */

import {
  composeHtmlDocument,
  extractCanvasFences,
  extractHtmlArtifact,
  looksLikeHtml,
} from "./canvasLanguages";
import { findArtifactTargets, type ArtifactTarget } from "../components/artifacts/artifactTargets";
import { extractDashboardMarkdown } from "./dashboardSpec";
import mermaidRuntimeUrl from "mermaid/dist/mermaid.min.js?url";

export type VisualArtifactKind = "html" | "image";

export type VisualArtifact =
  | {
      readonly kind: "html";
      readonly html: string;
      readonly reason: string;
      readonly fingerprint: string;
    }
  | {
      readonly kind: "image";
      readonly path: string;
      readonly reason: string;
      readonly fingerprint: string;
    };

const FENCED = /```([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)(?:```|$)/g;

const VISUAL_ASK =
  /\b(?:(?:generate|create|make|draw|render|plot|build|show(?:\s+me)?)\b[\s\S]{0,48}\b(?:chart|graph|plot|histogram|diagram|dashboard|mermaid|svg|image|png|jpeg|jpg|webp|calculator|simulation|widget|interactive)|(?:bar|line|pie|scatter|area|donut)\s+chart\b|(?:chart|graph|plot|histogram|diagram)\s+(?:of|for|showing)\b)/i;

const HTML_VISUAL_SIGNAL =
  /<(?:svg|canvas|table)\b|chart\.js|plotly|d3\.|recharts|highcharts|echarts|mermaid|apexcharts/i;

function fingerprintOf(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function svgDocument(svg: string): string {
  const body = svg.trim().startsWith("<svg")
    ? svg.trim()
    : `<svg xmlns="http://www.w3.org/2000/svg">${svg.trim()}</svg>`;
  return composeHtmlDocument({
    html: `<div style="display:grid;place-items:center;min-height:100vh;padding:1.5rem">${body}</div>`,
    css: `svg { max-width: 100%; height: auto; }`,
  });
}

export function mermaidDocument(source: string): string {
  const escaped = source.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { display:grid; place-items:center; min-height:100vh; margin:0; padding:1.5rem; background:#0b0b0b; color:#f5f5f5; }
  .mermaid { width: min(100%, 52rem); }
</style>
</head>
<body>
<p id="diagram-status" role="status">Rendering diagram…</p>
<pre class="mermaid">${escaped}</pre>
<script src="${mermaidRuntimeUrl}" onerror="document.getElementById('diagram-status').textContent='Unable to load the diagram. Try reloading the preview.'"><\/script>
<script>
  if (typeof mermaid !== "undefined") {
    mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict", suppressErrorRendering: true });
    mermaid.run({ querySelector: '.mermaid' }).then(() => {
      document.getElementById('diagram-status').remove();
    }).catch((error) => {
      console.error('Diagram render failed', error);
      document.getElementById('diagram-status').textContent = 'This diagram could not be rendered. Check its source for syntax errors.';
    });
  }
<\/script>
</body>
</html>
`;
}

function extractFencedBodies(text: string, languages: ReadonlySet<string>): string | null {
  let found: string | null = null;
  for (const match of text.matchAll(FENCED)) {
    const lang = (match[1] ?? "").toLowerCase();
    const body = match[2]?.trim() ?? "";
    if (body.length === 0) continue;
    if (languages.has(lang)) found = body;
  }
  return found;
}

/**
 * True when the user is asking for a chart, graph, diagram, or generated image
 * rather than only talking about those words in passing.
 */
export function isVisualGenerationAsk(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8 || trimmed.length > 4000) return false;
  if (trimmed.startsWith("/")) return false;
  return VISUAL_ASK.test(trimmed);
}

/**
 * Pulls a displayable visual from assistant text: HTML/SVG/mermaid charts,
 * dashboard markdown, or a high-confidence image path.
 */
export function findVisualArtifact(text: string): VisualArtifact | null {
  if (typeof text !== "string" || text.trim().length === 0) return null;

  const mermaid = extractFencedBodies(text, new Set(["mermaid", "mmd"]));
  if (mermaid) {
    const html = mermaidDocument(mermaid);
    return {
      kind: "html",
      html: html.endsWith("\n") ? html : `${html}\n`,
      reason: "mermaid fence",
      fingerprint: fingerprintOf(`mermaid:${mermaid}`),
    };
  }

  const svg = extractFencedBodies(text, new Set(["svg"]));
  if (svg) {
    const html = svgDocument(svg);
    return {
      kind: "html",
      html: html.endsWith("\n") ? html : `${html}\n`,
      reason: "svg fence",
      fingerprint: fingerprintOf(`svg:${svg}`),
    };
  }

  const htmlArtifact = extractHtmlArtifact(text);
  if (
    htmlArtifact &&
    (HTML_VISUAL_SIGNAL.test(htmlArtifact) || looksLikeCompleteVisualHtml(htmlArtifact))
  ) {
    return {
      kind: "html",
      html: htmlArtifact.endsWith("\n") ? htmlArtifact : `${htmlArtifact}\n`,
      reason: "html visual",
      fingerprint: fingerprintOf(`html:${htmlArtifact}`),
    };
  }

  // Generic HTML that is clearly a full document (canvas-style) still counts.
  if (htmlArtifact && (/<!doctype html/i.test(htmlArtifact) || /<html[\s>]/i.test(htmlArtifact))) {
    return {
      kind: "html",
      html: htmlArtifact.endsWith("\n") ? htmlArtifact : `${htmlArtifact}\n`,
      reason: "html document",
      fingerprint: fingerprintOf(`html:${htmlArtifact}`),
    };
  }

  const dashboard = extractDashboardMarkdown(text);
  if (dashboard) {
    return {
      kind: "html",
      html: dashboard,
      reason: "dashboard markdown",
      fingerprint: fingerprintOf(`md:${dashboard}`),
    };
  }

  const image = pickVisualImageTarget(findArtifactTargets(text));
  if (image) {
    return {
      kind: "image",
      path: image.path,
      reason: image.reason,
      fingerprint: fingerprintOf(`image:${image.path}`),
    };
  }

  return null;
}

function looksLikeCompleteVisualHtml(html: string): boolean {
  if (!looksLikeHtml(html) || html.trim().length < 80) return false;
  const fences = extractCanvasFences(html);
  return Boolean(fences.html || fences.css || fences.javascript) || HTML_VISUAL_SIGNAL.test(html);
}

function pickVisualImageTarget(targets: ReadonlyArray<ArtifactTarget>): ArtifactTarget | null {
  for (const target of targets) {
    if (target.preview !== "image") continue;
    const path = target.path.replaceAll("\\", "/").toLowerCase();
    const inOutputDir =
      /(^|\/)(?:canvas|exports|output|outputs|artifacts|charts|plots|images|generated)\//.test(
        path,
      );
    // Linked images, or any image under an output-ish directory.
    if (target.confidence >= 0.9 || (inOutputDir && target.confidence >= 0.75)) {
      return target;
    }
  }
  return null;
}

/**
 * Latest visual in the thread after the most recent user message.
 * Used to open Canvas / file preview as the model streams or finishes.
 */
export function findLatestVisualArtifact(
  messages: ReadonlyArray<{ readonly role: string; readonly text: string }>,
): VisualArtifact | null {
  let lastUser = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUser = index;
      break;
    }
  }
  if (lastUser < 0) return null;
  const assistant = messages
    .slice(lastUser + 1)
    .filter((message) => message.role === "assistant")
    .map((message) => message.text)
    .join("\n\n");
  return findVisualArtifact(assistant);
}
