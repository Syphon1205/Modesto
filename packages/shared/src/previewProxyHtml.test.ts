import { describe, expect, it } from "vite-plus/test";

import {
  preparePreviewProxyHtml,
  previewProxyBasePath,
  rewritePreviewProxyMarkup,
  stripPreviewProxyHeaders,
} from "./previewProxyHtml.ts";

const TOKEN = "tok123";
const BASE_URL = "https://example.com/dir/page";

const rewrite = (html: string) =>
  rewritePreviewProxyMarkup({ html, token: TOKEN, baseUrl: BASE_URL });

describe("stripPreviewProxyHeaders", () => {
  it("removes the headers that would stop us framing or scripting the page", () => {
    const out = stripPreviewProxyHeaders({
      "Content-Security-Policy": "default-src 'none'",
      "X-Frame-Options": "DENY",
      "content-type": "text/html",
    });
    expect(out).toEqual({ "content-type": "text/html" });
  });

  it("removes content-length, which no longer matches after rewriting", () => {
    expect(stripPreviewProxyHeaders({ "Content-Length": "10" })).toEqual({});
  });

  it("matches header names case-insensitively", () => {
    expect(stripPreviewProxyHeaders({ "X-FRAME-OPTIONS": "DENY" })).toEqual({});
  });

  it("keeps everything else", () => {
    expect(stripPreviewProxyHeaders({ "set-cookie": "a=1", vary: "Accept" })).toEqual({
      "set-cookie": "a=1",
      vary: "Accept",
    });
  });
});

describe("rewritePreviewProxyMarkup", () => {
  it("rewrites absolute href and src onto the proxy", () => {
    expect(rewrite('<a href="https://other.com/x">')).toBe(
      `<a href="/preview-proxy/t/${TOKEN}/https/other.com/x">`,
    );
    expect(rewrite('<script src="https://cdn.com/a.js">')).toBe(
      `<script src="/preview-proxy/t/${TOKEN}/https/cdn.com/a.js">`,
    );
  });

  it("leaves relative urls to the base tag", () => {
    const html = '<a href="/a"><img src="b.png">';
    expect(rewrite(html)).toBe(html);
  });

  it("handles single-quoted attributes", () => {
    expect(rewrite("<a href='https://other.com/x'>")).toBe(
      `<a href='/preview-proxy/t/${TOKEN}/https/other.com/x'>`,
    );
  });

  it("rewrites form actions", () => {
    expect(rewrite('<form action="https://other.com/post">')).toBe(
      `<form action="/preview-proxy/t/${TOKEN}/https/other.com/post">`,
    );
  });

  it("rewrites every candidate in a srcset, preserving descriptors", () => {
    expect(rewrite('<img srcset="https://cdn.com/a.png 1x, https://cdn.com/b.png 2x">')).toBe(
      `<img srcset="/preview-proxy/t/${TOKEN}/https/cdn.com/a.png 1x, /preview-proxy/t/${TOKEN}/https/cdn.com/b.png 2x">`,
    );
  });

  it("leaves data and javascript urls alone", () => {
    const html = '<img src="data:image/png;base64,AA"><a href="javascript:void 0">';
    expect(rewrite(html)).toBe(html);
  });
});

describe("preparePreviewProxyHtml", () => {
  const prepare = (html: string) =>
    preparePreviewProxyHtml({
      html,
      token: TOKEN,
      baseUrl: BASE_URL,
      proxyBasePath: `/preview-proxy/t/${TOKEN}/https/example.com/dir/`,
      agentScript: "AGENT();",
    });

  it("injects base and agent into the head", () => {
    const out = prepare("<html><head><title>t</title></head><body>x</body></html>");
    expect(out).toContain(`<base href="/preview-proxy/t/${TOKEN}/https/example.com/dir/">`);
    expect(out).toContain('<script data-modesto-preview-agent="1">AGENT();</script>');
    expect(out.indexOf("AGENT();")).toBeLessThan(out.indexOf("<title>"));
  });

  it("drops the page's own base tag, which would send relative urls out of the proxy", () => {
    const out = prepare('<html><head><base href="https://example.com/other/"></head></html>');
    expect(out).not.toContain('base href="https://example.com/other/"');
    expect(out).toContain(`<base href="/preview-proxy/t/${TOKEN}/https/example.com/dir/">`);
  });

  it("creates a head when the document has none", () => {
    const out = prepare("<html><body>x</body></html>");
    expect(out).toContain("<head>");
    expect(out).toContain("AGENT();");
  });

  it("still carries the agent for a bare fragment", () => {
    const out = prepare("<div>x</div>");
    expect(out).toContain("AGENT();");
    expect(out).toContain("<div>x</div>");
  });

  it("rewrites absolute urls in the same pass", () => {
    const out = prepare('<html><head></head><body><a href="https://other.com/x"></body></html>');
    expect(out).toContain(`href="/preview-proxy/t/${TOKEN}/https/other.com/x"`);
  });

  it("escapes the base path so it cannot break out of the attribute", () => {
    const out = preparePreviewProxyHtml({
      html: "<html><head></head></html>",
      token: TOKEN,
      baseUrl: BASE_URL,
      proxyBasePath: '/a"><script>evil()</script>',
      agentScript: "AGENT();",
    });
    expect(out).not.toContain("<script>evil()</script>");
    expect(out).toContain("&quot;");
  });
});

describe("previewProxyBasePath", () => {
  it("returns the document's directory", () => {
    expect(previewProxyBasePath("/preview-proxy/t/x/https/example.com/dir/page")).toBe(
      "/preview-proxy/t/x/https/example.com/dir/",
    );
  });

  it("ignores query and fragment", () => {
    expect(previewProxyBasePath("/a/b?c=1#d")).toBe("/a/");
  });

  it("keeps a directory path as-is", () => {
    expect(previewProxyBasePath("/a/b/")).toBe("/a/b/");
  });
});
