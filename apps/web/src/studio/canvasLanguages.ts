const FENCED = /```([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)(?:```|$)/g;

export type CanvasSourceLanguage = "html" | "css" | "javascript" | "markdown" | "csv";

export type ExtractedCanvasFences = {
  readonly html: string | null;
  readonly css: string | null;
  readonly javascript: string | null;
  readonly markdown: string | null;
  readonly csv: string | null;
};

export function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return true;
  if (/<section\b[\s\S]*<\/section>/i.test(trimmed)) return true;
  return /^<[a-z][\w-]*[\s>]/i.test(trimmed) && /<\/[a-z][\w-]*>/i.test(trimmed);
}

export function sourceLanguageLabel(text: string): "HTML" | "Markdown" | "CSV" {
  if (looksLikeHtml(text)) return "HTML";
  const trimmed = text.trim();
  if (trimmed.includes(",") && !trimmed.startsWith("#") && !looksLikeHtml(trimmed)) {
    const first = trimmed.split("\n")[0] ?? "";
    if (first.includes(",") && !first.startsWith("|")) return "CSV";
  }
  return "Markdown";
}

export function extractCanvasFences(text: string): ExtractedCanvasFences {
  let html: string | null = null;
  let css: string | null = null;
  let javascript: string | null = null;
  let markdown: string | null = null;
  let csv: string | null = null;
  for (const match of text.matchAll(FENCED)) {
    const lang = (match[1] ?? "").toLowerCase();
    const body = match[2]?.trim() ?? "";
    if (body.length === 0) continue;
    if (lang === "html" || lang === "htm") html = body;
    else if (lang === "css") css = body;
    else if (lang === "js" || lang === "javascript" || lang === "ts") javascript = body;
    else if (lang === "md" || lang === "markdown") markdown = body;
    else if (lang === "csv" || lang === "tsv") csv = body;
  }
  return { html, css, javascript, markdown, csv };
}

export function composeHtmlDocument(input: {
  readonly html: string;
  readonly css?: string | null;
  readonly javascript?: string | null;
}): string {
  const html = input.html.trim();
  const css = input.css?.trim() ?? "";
  const javascript = input.javascript?.trim() ?? "";
  if (/^<!doctype html/i.test(html) || /^<html[\s>]/i.test(html)) {
    return injectIntoHtmlDocument(html, css, javascript);
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  html, body { margin: 0; min-height: 100%; }
  body { background: #fafafa; color: #111; }
${css}
</style>
</head>
<body>
${html}
${javascript.length > 0 ? `<script>\n${javascript}\n</script>` : ""}
</body>
</html>
`;
}

export function extractHtmlArtifact(text: string): string | null {
  const fences = extractCanvasFences(text);
  if (fences.html || fences.css || fences.javascript) {
    return composeHtmlDocument({
      html: fences.html ?? '<div id="root"></div>',
      css: fences.css,
      javascript: fences.javascript,
    });
  }
  const trimmed = text.trim();
  if (looksLikeHtml(trimmed) && trimmed.length > 40) return trimmed;
  return null;
}

export type HtmlSlide = {
  readonly title: string;
  readonly html: string;
};

export function parseHtmlSlides(source: string): readonly HtmlSlide[] {
  const sections = [...source.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)].map(
    (match) => match[0],
  );
  if (sections.length === 0) {
    return looksLikeHtml(source) ? [{ title: htmlSlideTitle(source), html: source }] : [];
  }
  return sections.map((html, index) => ({
    title: htmlSlideTitle(html) || `Slide ${index + 1}`,
    html,
  }));
}

export function htmlDocumentForSlide(source: string, index: number): string {
  const slides = parseHtmlSlides(source);
  const slide = slides[index] ?? slides[0];
  if (!slide) return composeHtmlDocument({ html: source });
  if (slides.length <= 1 && /^<!doctype html/i.test(source.trim())) return source;
  const styles = [...source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)]
    .map((match) => match[0])
    .join("\n");
  return composeHtmlDocument({
    html: `${styles}\n${slide.html}`,
  });
}

const DOCUMENT_CSS = `
  body { margin: 0; background: #f7f6f3; color: #161616; }
  .doc { max-width: 40rem; margin: 0 auto; padding: 2.75rem 1.75rem 3.5rem; }
  h1 { font-size: 2rem; letter-spacing: -0.04em; margin: 0 0 0.85rem; }
  h2 { font-size: 1.25rem; letter-spacing: -0.03em; margin: 1.75rem 0 0.5rem; }
  h3 { font-size: 1.05rem; margin: 1.4rem 0 0.4rem; }
  p, li { font-size: 1.02rem; line-height: 1.65; color: #3f3f3f; }
  p { margin: 0 0 0.9rem; }
  ul { margin: 0 0 1rem; padding-left: 1.2rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
`;

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function markdownToSimpleHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (!inList) return;
    out.push("</ul>");
    inList = false;
  };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1]?.length ?? 1;
      out.push(`<h${level}>${formatInlineMarkdown(heading[2] ?? "")}</h${level}>`);
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${formatInlineMarkdown(bullet[1] ?? "")}</li>`);
      continue;
    }
    if (line.trim().length === 0) {
      closeList();
      continue;
    }
    closeList();
    out.push(`<p>${formatInlineMarkdown(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

export function documentPreviewHtml(text: string): string {
  const trimmed = text.trim();
  if (looksLikeHtml(trimmed)) {
    return /^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
      ? trimmed
      : composeHtmlDocument({ html: trimmed });
  }
  return composeHtmlDocument({
    html: `<article class="doc">${markdownToSimpleHtml(trimmed)}</article>`,
    css: DOCUMENT_CSS,
  });
}

function formatInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function htmlSlideTitle(html: string): string {
  const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);
  if (heading?.[1]) return heading[1].replace(/<[^>]+>/g, "").trim();
  return "Slide";
}

function injectIntoHtmlDocument(html: string, css: string, javascript: string): string {
  let next = html;
  if (css.length > 0 && !/<style[\s>]/i.test(next)) {
    next = next.includes("</head>")
      ? next.replace("</head>", `<style>\n${css}\n</style>\n</head>`)
      : `<style>\n${css}\n</style>\n${next}`;
  }
  if (javascript.length > 0 && !/<script[\s>]/i.test(next)) {
    next = next.includes("</body>")
      ? next.replace("</body>", `<script>\n${javascript}\n</script>\n</body>`)
      : `${next}\n<script>\n${javascript}\n</script>`;
  }
  return next;
}
