import {
  composeHtmlDocument,
  extractHtmlArtifact,
  looksLikeHtml,
  markdownToSimpleHtml,
  parseHtmlSlides,
} from "../studio/canvasLanguages";

export interface SlideDeckSlide {
  readonly title: string;
  readonly markdown: string;
  readonly notes: string | null;
}

export interface SlideDeck {
  readonly slides: readonly SlideDeckSlide[];
}

const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const FENCED_DECK = /```[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)(?:```|$)/gi;
const SLIDE_PATH =
  /(?:^|[\s`"'([<])((?:\.{0,2}\/)?(?:[\w.@-]+\/)*slides\/[\w.@-]+\.(?:html|htm|md))/gi;

export const SLIDES_DECK_INSTRUCTIONS = `Build an in-app slide deck in this workspace.

The language is HTML + CSS (JS only if a slide must move). Each slide is a \`<section>\` in one HTML document. One idea per slide: a heading, short copy, and real layout — not a bullet dump.

Put the complete HTML in your reply (\`\`\`html, plus \`\`\`css / \`\`\`js if they are separate) so the Slides panel can present it immediately. Save it under \`slides/<short-slug>.html\`.`;

const SLIDE_CSS = `
  :root {
    --ink: #111111;
    --muted: #6a6964;
    --paper: #f7f6f3;
    --sans: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    --display: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex;
    background: var(--paper);
    color: var(--ink);
    font: 400 18px/1.45 var(--sans);
    -webkit-font-smoothing: antialiased;
  }
  section {
    box-sizing: border-box;
    flex: 1;
    min-height: 100%;
    padding: 3.5rem 3.25rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  h1 {
    font-family: var(--display);
    font-size: clamp(2.2rem, 4.8vw, 3rem);
    font-weight: 600;
    letter-spacing: -0.05em;
    line-height: 1.08;
    margin: 0 0 0.75rem;
  }
  h2 {
    font-family: var(--display);
    font-size: 1.45rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    margin: 0 0 0.55rem;
  }
  p, li {
    margin: 0 0 0.55rem;
    color: var(--muted);
    letter-spacing: -0.015em;
  }
  p em, li em, i, em {
    font-style: italic;
    color: var(--ink);
  }
  p:first-of-type {
    font-style: italic;
    font-size: 1.15rem;
    letter-spacing: -0.02em;
  }
  ul { margin: 0.85rem 0 0; padding-left: 1.15rem; }
  li { color: var(--ink); }
`;

const STARTER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Untitled deck</title>
<style>${SLIDE_CSS}</style>
</head>
<body>
<section></section>
</body>
</html>
`;

export function starterSlideDeckMarkdown(): string {
  return STARTER;
}

export function isStarterSlideDeckMarkdown(markdown: string): boolean {
  return markdown === STARTER;
}

export function isSlideDeckPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  if (/(^|\/)slides\//.test(normalized) && /\.(md|html|htm)$/.test(normalized)) return true;
  return /\.(ppt|pptx|odp|key)$/.test(normalized);
}

function slideTitle(markdown: string): string {
  const heading = /^#\s+(.+)$/m.exec(markdown);
  if (heading?.[1]) return heading[1].trim();
  const line = markdown
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  return line && line.length > 0 ? line.replace(/^#+\s*/, "") : "Slide";
}

function splitNotes(markdown: string): { body: string; notes: string | null } {
  const index = markdown.search(/(?:^|\n)\?\?\?\s*\n/);
  if (index < 0) return { body: markdown.trim(), notes: null };
  const body = markdown.slice(0, index).trim();
  const notes = markdown
    .slice(index)
    .replace(/^\n?\?\?\?\s*\n?/, "")
    .trim();
  return { body, notes: notes.length > 0 ? notes : null };
}

export function extractSlideDeckFrontMatter(markdown: string): {
  readonly frontMatter: string | null;
  readonly rest: string;
} {
  const withoutBom = markdown.replace(/^\uFEFF/, "");
  const match = FRONT_MATTER.exec(withoutBom);
  if (!match) return { frontMatter: null, rest: withoutBom };
  return {
    frontMatter: match[0].replace(/(?:\r?\n)+$/, ""),
    rest: withoutBom.slice(match[0].length),
  };
}

export function serializeSlideMarkdown(slide: Pick<SlideDeckSlide, "markdown" | "notes">): string {
  const body = slide.markdown.trim();
  const notes = slide.notes?.trim();
  if (notes && notes.length > 0) return `${body}\n\n???\n\n${notes}`;
  return body;
}

export function rebuildSlideDeckMarkdown(input: {
  readonly frontMatter?: string | null;
  readonly slides: ReadonlyArray<Pick<SlideDeckSlide, "markdown" | "notes">>;
}): string {
  const body = input.slides
    .map((slide) => serializeSlideMarkdown(slide))
    .filter((chunk) => chunk.length > 0)
    .join("\n\n---\n\n");
  const frontMatter = input.frontMatter?.trimEnd();
  if (frontMatter && frontMatter.length > 0) {
    return body.length > 0 ? `${frontMatter}\n\n${body}\n` : `${frontMatter}\n`;
  }
  return body.length > 0 ? `${body}\n` : "";
}

export function replaceSlideMarkdown(
  deckMarkdown: string,
  index: number,
  slideMarkdown: string,
): string {
  const { frontMatter } = extractSlideDeckFrontMatter(deckMarkdown);
  const deck = parseSlideDeck(deckMarkdown);
  const { body, notes } = splitNotes(slideMarkdown);
  const nextSlide: SlideDeckSlide = {
    title: slideTitle(body.length > 0 ? body : "Slide"),
    markdown: body.length > 0 ? body : "# Slide",
    notes,
  };
  const slides = deck.slides.map((slide, slideIndex) => (slideIndex === index ? nextSlide : slide));
  if (index >= slides.length) slides.push(nextSlide);
  return rebuildSlideDeckMarkdown({ frontMatter, slides });
}

export function suggestSlideDeckPath(markdown: string): string {
  const title = parseSlideDeck(markdown).slides[0]?.title ?? "deck";
  const slug = title
    .normalize("NFKD")
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `slides/${slug.length > 0 ? slug : "deck"}.html`;
}

export function parseMarkdownSlideDeck(markdown: string): SlideDeck {
  const withoutBom = markdown.replace(/^\uFEFF/, "");
  const body = withoutBom.replace(FRONT_MATTER, "");
  const chunks = body.split(/^\s*---\s*$/m).map((chunk) => chunk.trim());
  const slides = chunks
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const { body: slideBody, notes } = splitNotes(chunk);
      return {
        title: slideTitle(slideBody),
        markdown: slideBody,
        notes,
      };
    });
  return {
    slides:
      slides.length > 0 ? slides : [{ title: "New deck", markdown: "# New deck", notes: null }],
  };
}

export function markdownDeckToHtml(markdown: string): string {
  const sections = parseMarkdownSlideDeck(markdown)
    .slides.map((slide) => `<section>\n${markdownToSimpleHtml(slide.markdown)}\n</section>`)
    .join("\n");
  return composeHtmlDocument({ html: sections, css: SLIDE_CSS });
}

export function parseSlideDeck(source: string): SlideDeck {
  if (looksLikeHtml(source)) {
    const slides = parseHtmlSlides(source);
    return {
      slides:
        slides.length > 0
          ? slides.map((slide) => ({ title: slide.title, markdown: slide.html, notes: null }))
          : [{ title: "New deck", markdown: source, notes: null }],
    };
  }
  return parseMarkdownSlideDeck(source);
}

export type ParsedSlidesComposerCommand = {
  readonly kind: "build";
  readonly task: string | null;
};

export function parseSlidesComposerCommand(text: string): ParsedSlidesComposerCommand | null {
  const match = /^\/slides(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match) return null;
  const task = match[1]?.trim() ?? "";
  return { kind: "build", task: task.length > 0 ? task : null };
}

export function defaultSlidesTopic(context: {
  readonly threadTitle?: string | null;
  readonly projectTitle?: string | null;
}): string {
  const thread = context.threadTitle?.trim() || null;
  const project = context.projectTitle?.trim() || null;
  const about = [thread, project].filter((part): part is string => Boolean(part)).join(" — ");
  if (about.length > 0) {
    return `A polished intro/overview presentation about ${about}: what this work is, why it matters, where things stand, and what comes next. Draw from the conversation and the workspace.`;
  }
  return "A polished intro/overview presentation about this thread and project: what the work is, why it matters, where things stand, and what comes next. Draw from the conversation and the workspace.";
}

export function slidesBuildPrompt(task: string): string {
  return `${SLIDES_DECK_INSTRUCTIONS}\n\nTopic:\n${task}`;
}

export function resolveSlidesSendPrompt(
  command: ParsedSlidesComposerCommand,
  context: {
    readonly threadTitle?: string | null;
    readonly projectTitle?: string | null;
  },
): string {
  return slidesBuildPrompt(command.task ?? defaultSlidesTopic(context));
}

export function isSlidesBuildPrompt(text: string): boolean {
  return text.includes("Build an in-app slide deck in this workspace.");
}

function looksLikeSlideDeck(markdown: string): boolean {
  const trimmed = markdown.trim();
  if (trimmed.length < 12) return false;
  const deck = parseMarkdownSlideDeck(trimmed);
  const headed = deck.slides.filter((slide) => /^#\s+/m.test(slide.markdown)).length;
  if (deck.slides.length >= 2 && headed >= 1) return true;
  if (FRONT_MATTER.test(trimmed) && /marp\s*:/i.test(trimmed) && headed >= 1) return true;
  return false;
}

export function extractSlideDeckMarkdown(text: string): string | null {
  if (typeof text !== "string" || text.trim().length === 0) return null;
  const html = extractHtmlArtifact(text);
  if (html && /<section\b/i.test(html) && parseHtmlSlides(html).length > 0) return html;
  const candidates: string[] = [];
  for (const match of text.matchAll(FENCED_DECK)) {
    const body = match[1]?.trim();
    if (body) candidates.push(body);
  }
  const raw = text.trim();
  if (!candidates.includes(raw)) candidates.push(raw);

  let best: { markdown: string; slides: number } | null = null;
  for (const candidate of candidates) {
    if (!looksLikeSlideDeck(candidate)) continue;
    const slides = parseMarkdownSlideDeck(candidate).slides.length;
    if (
      !best ||
      slides > best.slides ||
      (slides === best.slides && candidate.length > best.markdown.length)
    ) {
      best = { markdown: candidate, slides };
    }
  }
  return best ? markdownDeckToHtml(best.markdown) : null;
}

export function findSlideDeckMarkdownPath(text: string): string | null {
  if (typeof text !== "string" || text.length === 0) return null;
  let found: string | null = null;
  for (const match of text.matchAll(SLIDE_PATH)) {
    const path = match[1]?.replace(/^\.\//, "") ?? "";
    if (path.length > 0 && isSlideDeckPath(path)) found = path;
  }
  return found;
}

export function latestSlideDeckMarkdownPath(
  files: ReadonlyArray<{ readonly path: string }>,
): string | null {
  for (let index = files.length - 1; index >= 0; index -= 1) {
    const path = files[index]?.path;
    if (!path) continue;
    const normalized = path.replaceAll("\\", "/");
    if (isSlideDeckPath(normalized) && /\.(md|html|htm)$/i.test(normalized)) {
      return normalized;
    }
  }
  return null;
}

export function resolveSlideDeckFromTranscript(input: {
  readonly messages: ReadonlyArray<{ readonly role: string; readonly text: string }>;
  readonly checkpointFiles?: ReadonlyArray<{ readonly path: string }>;
}): { readonly markdown: string | null; readonly sourcePath: string | null } {
  let latestBuildUserIndex = -1;
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role === "user" && isSlidesBuildPrompt(message.text)) {
      latestBuildUserIndex = index;
      break;
    }
  }
  if (latestBuildUserIndex < 0) {
    return {
      markdown: null,
      sourcePath: latestSlideDeckMarkdownPath(input.checkpointFiles ?? []),
    };
  }
  const later = input.messages.slice(latestBuildUserIndex + 1);
  const assistantTexts = later
    .filter((message) => message.role === "assistant")
    .map((message) => message.text);
  const combinedAssistant = assistantTexts.join("\n\n");
  const extracted =
    extractSlideDeckMarkdown(combinedAssistant) ??
    extractSlideDeckMarkdown(later.at(-1)?.text ?? "");
  const sourcePath =
    latestSlideDeckMarkdownPath(input.checkpointFiles ?? []) ??
    findSlideDeckMarkdownPath(combinedAssistant);
  return { markdown: extracted, sourcePath };
}
