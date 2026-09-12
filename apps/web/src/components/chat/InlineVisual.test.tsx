import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { InlineVisual } from "./InlineVisual";
import { inlineVisualDocument, inlineVisualKind } from "../../studio/inlineVisuals";

describe("inline chat visuals", () => {
  it("keeps streaming HTML as source without executing a partial frame", () => {
    const markup = renderToStaticMarkup(
      <InlineVisual source="<button>Try</button>" language="html" isStreaming>
        <pre>partial source</pre>
      </InlineVisual>,
    );
    expect(markup).not.toContain("<iframe");
    expect(markup).toContain("Preparing preview");
    expect(markup).toContain("partial source");
  });
  it("renders finished interactive output in an opaque sandbox with source access", () => {
    const markup = renderToStaticMarkup(
      <InlineVisual
        source="<button onclick='this.textContent=2'>1</button>"
        language="html"
        isStreaming={false}
      >
        <pre>source</pre>
      </InlineVisual>,
    );
    expect(markup).toContain('sandbox="allow-scripts"');
    expect(markup).not.toContain("allow-same-origin");
    expect(markup).toContain('referrerPolicy="no-referrer"');
    expect(markup).toContain("Restart preview");
    expect(markup).toContain("Source");
    expect(markup).toContain("onclick");
  });
  it("leaves regular programming languages alone", () => {
    expect(inlineVisualKind("typescript")).toBeNull();
    expect(inlineVisualDocument("js", "alert(1)")).toBeNull();
    expect(inlineVisualDocument("html", " ")).toBeNull();
  });
  it("escapes diagram text and loads the bundled runtime with strict security", () => {
    const html = inlineVisualDocument("mermaid", "</pre><script>alert(1)</script>");
    expect(html).toContain("&lt;/pre&gt;&lt;script&gt;");
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).toContain('securityLevel: "strict"');
    expect(html).toContain('id="diagram-status"');
  });
  it("wraps SVG output as a responsive document", () => {
    expect(inlineVisualDocument("svg", '<svg><circle r="10"/></svg>')).toContain("max-width: 100%");
  });
});
