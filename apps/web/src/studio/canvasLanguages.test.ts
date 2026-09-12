import { describe, expect, it } from "vite-plus/test";

import {
  composeHtmlDocument,
  documentPreviewHtml,
  extractHtmlArtifact,
  htmlDocumentForSlide,
  looksLikeHtml,
  parseHtmlSlides,
} from "./canvasLanguages";

describe("canvas languages", () => {
  it("composes split html/css/js fences into one document", () => {
    const html = extractHtmlArtifact(`
\`\`\`html
<button id="go">Go</button>
\`\`\`
\`\`\`css
button { color: red; }
\`\`\`
\`\`\`js
document.getElementById("go")?.focus();
\`\`\`
`);
    expect(html).toContain('<button id="go">Go</button>');
    expect(html).toContain("button { color: red; }");
    expect(html).toContain("document.getElementById");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("splits HTML decks on section tags", () => {
    const source = composeHtmlDocument({
      html: "<section><h1>One</h1></section><section><h1>Two</h1></section>",
    });
    const slides = parseHtmlSlides(source);
    expect(slides.map((slide) => slide.title)).toEqual(["One", "Two"]);
    expect(htmlDocumentForSlide(source, 1)).toContain("<h1>Two</h1>");
    expect(looksLikeHtml(source)).toBe(true);
  });

  it("turns leftover markdown into a designed HTML document", () => {
    const html = documentPreviewHtml("# Brief\n\nHello **there**.");
    expect(html).toContain("<h1>Brief</h1>");
    expect(html).toContain("<strong>there</strong>");
    expect(html).toContain("<!DOCTYPE html>");
  });
});
