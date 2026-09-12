// FILE: artifactTargets.ts
// Purpose: Finds the files an assistant turn produced or pointed at, so they
//          can be opened as artifacts instead of staying as text.
// Layer: Work model (pure - no React, no I/O)
//
// This is the mechanic that makes Cowork feel different from a code assistant:
// the agent's outputs are things you collect and open, not lines you scroll
// back to find. Modesto already surfaces *edited* files through diffs; what it
// has never surfaced is a file the agent merely produced or referred to - a
// report, a CSV, an exported chart.
//
// Adapted from OpenWork's `apps/app/src/react-app/domains/session/artifacts/
// open-target.ts` (MIT). See THIRD_PARTY_NOTICES.md. The classification table
// and the idea of scoring a mention by how it was written are theirs; the
// matching and the scores here are rewritten against Modesto's message shape.
//
// Detection is deliberately conservative. A false positive puts a broken chip
// in front of the user and costs more trust than a missed file costs
// convenience, so a bare word that merely looks path-shaped is not enough -
// see `MIN_ARTIFACT_CONFIDENCE`.

import { isSlideDeckPath } from "~/slides/slideDeck";
import { isStudioDocumentPath } from "~/studio/studioKinds";

/** How an artifact should be presented once opened. */
export type ArtifactPreviewKind =
  | "markdown"
  | "sheet"
  | "image"
  | "pdf"
  | "html"
  | "document"
  | "slides"
  | "text"
  | "other";

export interface ArtifactTarget {
  /** The path exactly as it appeared, used as the identity. */
  readonly path: string;
  /** Basename, for display. */
  readonly name: string;
  readonly preview: ArtifactPreviewKind;
  /** 0-1. Higher means the text made a stronger claim that this is a real file. */
  readonly confidence: number;
  /** Why it was detected, for debugging a surprising chip. */
  readonly reason: string;
}

const PREVIEW_BY_EXTENSION: ReadonlyArray<readonly [ArtifactPreviewKind, ReadonlyArray<string>]> = [
  ["markdown", [".md", ".markdown", ".mdx"]],
  ["sheet", [".csv", ".tsv", ".xlsx", ".xls", ".ods"]],
  ["slides", [".ppt", ".pptx", ".odp", ".key"]],
  ["document", [".docx", ".odt", ".rtf"]],
  ["image", [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]],
  ["pdf", [".pdf"]],
  ["html", [".html", ".htm"]],
  [
    "text",
    [
      ".txt",
      ".log",
      ".json",
      ".jsonc",
      ".yaml",
      ".yml",
      ".toml",
      ".xml",
      ".ini",
      ".env",
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".css",
      ".scss",
      ".py",
      ".rb",
      ".go",
      ".rs",
      ".java",
      ".kt",
      ".swift",
      ".c",
      ".h",
      ".cpp",
      ".sh",
      ".sql",
    ],
  ],
];

export function classifyArtifactPreview(path: string): ArtifactPreviewKind {
  if (isSlideDeckPath(path)) return "slides";
  if (isStudioDocumentPath("docs", path) || isStudioDocumentPath("dashboard", path))
    return "document";
  if (isStudioDocumentPath("sheets", path)) return "sheet";
  const extension = extensionOf(path);
  if (extension === "") return "other";
  for (const [kind, extensions] of PREVIEW_BY_EXTENSION) {
    if (extensions.includes(extension)) return kind;
  }
  return "other";
}

function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1) || path;
}

/**
 * Confidence below this is dropped.
 *
 * A bare path-shaped word in prose ("update package.json") is a mention, not an
 * artifact, and turning every one into a chip is how the strip becomes noise.
 * Only paths the text presented *as* files - linked, or written as code -
 * clear this bar.
 */
export const MIN_ARTIFACT_CONFIDENCE = 0.5;

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
const BACKTICKED = /`([^`\n]+)`/g;
/** A path that names a directory, which is a much stronger signal than a bare filename. */
const PATH_WITH_SEPARATOR =
  /(?:^|[\s"'([{])((?:\.{0,2}\/)?(?:[\w.@-]+\/)+[\w.@-]+\.[A-Za-z0-9]{1,10})/g;

function isProbablePath(value: string): boolean {
  if (value.length === 0 || value.length > 400) return false;
  if (/\s/.test(value)) return false;
  // A URL is a browser target, not a workspace artifact.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return false;
  if (value.startsWith("#") || value.startsWith("mailto:")) return false;
  return extensionOf(value) !== "";
}

/** Strips the decorations a path picks up in prose. */
function normalizePath(value: string): string {
  let path = value.trim();
  path = path.replace(/^<|>$/g, "");
  // Trailing sentence punctuation, but never a character a path may end with.
  path = path.replace(/[.,;:!?)\]}'"]+$/g, "");
  // Agents cite locations as `file.tsx:212` or `file.tsx:212:9`. The location
  // is not part of the filename: left in, it produces a second artifact for
  // the same file that could never be opened.
  path = path.replace(/:\d+(?::\d+)?$/, "");
  path = path.replace(/^\.\//, "");
  return path;
}

function record(
  found: Map<string, ArtifactTarget>,
  rawPath: string,
  confidence: number,
  reason: string,
): void {
  const path = normalizePath(rawPath);
  if (!isProbablePath(path)) return;
  const existing = found.get(path);
  // The strongest evidence wins: the same file linked once and mentioned twice
  // is one artifact, at the link's confidence.
  if (existing && existing.confidence >= confidence) return;
  found.set(path, {
    path,
    name: basenameOf(path),
    preview: classifyArtifactPreview(path),
    confidence,
    reason,
  });
}

/**
 * Extracts artifact targets from one assistant message.
 *
 * Scoring reflects how deliberately the text presented the path:
 * a markdown link is an explicit offer to open something, a backticked path
 * with a directory in it is close behind, and a bare mention in prose is
 * below the threshold on its own.
 */
export function findArtifactTargets(text: string): ReadonlyArray<ArtifactTarget> {
  const found = new Map<string, ArtifactTarget>();
  if (typeof text !== "string" || text.length === 0) return [];

  for (const match of text.matchAll(MARKDOWN_LINK)) {
    if (match[1]) record(found, match[1], 0.9, "markdown link");
  }
  for (const match of text.matchAll(BACKTICKED)) {
    const value = match[1] ?? "";
    if (!value) continue;
    record(found, value, value.includes("/") ? 0.75 : 0.55, "written as code");
  }
  for (const match of text.matchAll(PATH_WITH_SEPARATOR)) {
    if (match[1]) record(found, match[1], 0.5, "path with a directory");
  }

  return [...found.values()]
    .filter((target) => target.confidence >= MIN_ARTIFACT_CONFIDENCE)
    .toSorted((left, right) =>
      right.confidence === left.confidence
        ? left.path.localeCompare(right.path)
        : right.confidence - left.confidence,
    );
}

/**
 * Collects artifacts across a thread's assistant messages, newest first.
 *
 * Later messages win on ties so a re-generated file shows at the point it was
 * last produced, which is where the user will look for it.
 */
export function collectThreadArtifacts(
  messages: ReadonlyArray<{ readonly role: string; readonly text: string }>,
  options: { readonly limit?: number } = {},
): ReadonlyArray<ArtifactTarget> {
  const byPath = new Map<string, ArtifactTarget>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const target of findArtifactTargets(message.text)) {
      // Delete before setting: a Map keeps its *first* insertion position, so
      // re-setting a key would leave a regenerated file sitting where it was
      // first produced rather than where it was last.
      byPath.delete(target.path);
      byPath.set(target.path, target);
    }
  }
  const collected = [...byPath.values()].toReversed();
  const limit = options.limit;
  return limit === undefined ? collected : collected.slice(0, limit);
}
