import { describe, expect, it } from "vite-plus/test";

import {
  decodePreviewProxyPath,
  encodePreviewProxyPath,
  isPreviewProxyHostAllowed,
  rewritePreviewProxyUrl,
  PREVIEW_PROXY_PREFIX,
} from "./previewProxyUrl.ts";

const TOKEN = "tok123";

describe("encodePreviewProxyPath", () => {
  it("puts scheme and host in the path so relative links stay inside the proxy", () => {
    expect(encodePreviewProxyPath({ token: TOKEN, url: "https://example.com/a/b" })).toBe(
      `${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/https/example.com/a/b`,
    );
  });

  it("keeps the query and fragment", () => {
    expect(encodePreviewProxyPath({ token: TOKEN, url: "https://example.com/a?b=1#c" })).toBe(
      `${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/https/example.com/a?b=1#c`,
    );
  });

  it("keeps a non-default port, without which the target is unreachable", () => {
    expect(encodePreviewProxyPath({ token: TOKEN, url: "http://localhost:5733/x" })).toBe(
      `${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/http/localhost:5733/x`,
    );
  });

  it("refuses a non-http scheme", () => {
    expect(encodePreviewProxyPath({ token: TOKEN, url: "file:///etc/passwd" })).toBeNull();
    expect(encodePreviewProxyPath({ token: TOKEN, url: "data:text/html,hi" })).toBeNull();
  });

  it("refuses a token that would break the path grammar", () => {
    expect(encodePreviewProxyPath({ token: "a/b", url: "https://example.com/" })).toBeNull();
    expect(encodePreviewProxyPath({ token: "", url: "https://example.com/" })).toBeNull();
  });

  it("refuses a malformed url", () => {
    expect(encodePreviewProxyPath({ token: TOKEN, url: "not a url" })).toBeNull();
  });
});

describe("decodePreviewProxyPath", () => {
  it("round-trips an encoded path", () => {
    const url = "https://example.com/a/b?c=1";
    const encoded = encodePreviewProxyPath({ token: TOKEN, url })!;
    expect(decodePreviewProxyPath(encoded)).toEqual({ token: TOKEN, url });
  });

  it("round-trips a port", () => {
    const url = "http://localhost:5733/x";
    const encoded = encodePreviewProxyPath({ token: TOKEN, url })!;
    expect(decodePreviewProxyPath(encoded)).toEqual({ token: TOKEN, url });
  });

  it("defaults a bare host to the root path", () => {
    expect(decodePreviewProxyPath(`${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/https/example.com`)).toEqual({
      token: TOKEN,
      url: "https://example.com/",
    });
  });

  it("rejects paths outside the proxy", () => {
    expect(decodePreviewProxyPath("/assets/x.png")).toBeNull();
    expect(decodePreviewProxyPath(`${PREVIEW_PROXY_PREFIX}/https/example.com`)).toBeNull();
  });

  it("rejects an unsupported scheme segment", () => {
    expect(decodePreviewProxyPath(`${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/file/etc/passwd`)).toBeNull();
  });

  it("rejects a missing token or host", () => {
    expect(decodePreviewProxyPath(`${PREVIEW_PROXY_PREFIX}/t//https/example.com`)).toBeNull();
    expect(decodePreviewProxyPath(`${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/https/`)).toBeNull();
  });
});

describe("rewritePreviewProxyUrl", () => {
  const baseUrl = "https://example.com/page";

  it("rewrites an absolute url onto the proxy", () => {
    expect(
      rewritePreviewProxyUrl({ value: "https://cdn.other.com/x.js", token: TOKEN, baseUrl }),
    ).toBe(`${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/https/cdn.other.com/x.js`);
  });

  it("rewrites a protocol-relative url", () => {
    expect(rewritePreviewProxyUrl({ value: "//cdn.other.com/x.js", token: TOKEN, baseUrl })).toBe(
      `${PREVIEW_PROXY_PREFIX}/t/${TOKEN}/https/cdn.other.com/x.js`,
    );
  });

  it("leaves relative urls alone, because the injected base tag resolves them", () => {
    for (const value of ["/a/b", "../c", "d.png", "?q=1"]) {
      expect(rewritePreviewProxyUrl({ value, token: TOKEN, baseUrl })).toBe(value);
    }
  });

  it("leaves non-navigational schemes alone", () => {
    for (const value of [
      "data:image/png;base64,AAAA",
      "blob:https://example.com/1",
      "mailto:a@b.com",
      "javascript:void 0",
      "#anchor",
    ]) {
      expect(rewritePreviewProxyUrl({ value, token: TOKEN, baseUrl })).toBe(value);
    }
  });

  it("returns the original value when the url cannot be parsed", () => {
    expect(rewritePreviewProxyUrl({ value: "http://[bad", token: TOKEN, baseUrl })).toBe(
      "http://[bad",
    );
  });
});

describe("isPreviewProxyHostAllowed", () => {
  it("allows ordinary public hosts", () => {
    expect(isPreviewProxyHostAllowed("example.com")).toBe(true);
    expect(isPreviewProxyHostAllowed("sub.example.co.uk")).toBe(true);
  });

  it("allows loopback, which is how local dev servers are previewed", () => {
    expect(isPreviewProxyHostAllowed("localhost")).toBe(true);
    expect(isPreviewProxyHostAllowed("app.localhost")).toBe(true);
    expect(isPreviewProxyHostAllowed("127.0.0.1")).toBe(true);
    expect(isPreviewProxyHostAllowed("127.0.0.53")).toBe(true);
    expect(isPreviewProxyHostAllowed("::1")).toBe(true);
  });

  it("blocks private ranges, so the proxy cannot reach the server's network", () => {
    for (const host of ["10.0.0.5", "172.16.4.1", "172.31.255.255", "192.168.1.1", "0.0.0.0"]) {
      expect(isPreviewProxyHostAllowed(host)).toBe(false);
    }
  });

  it("blocks cloud metadata endpoints", () => {
    expect(isPreviewProxyHostAllowed("169.254.169.254")).toBe(false);
    expect(isPreviewProxyHostAllowed("metadata.google.internal")).toBe(false);
  });

  it("blocks ipv6 unique-local and link-local", () => {
    expect(isPreviewProxyHostAllowed("fd00::1")).toBe(false);
    expect(isPreviewProxyHostAllowed("[fe80::1]")).toBe(false);
  });

  it("blocks bare internal hostnames", () => {
    expect(isPreviewProxyHostAllowed("intranet")).toBe(false);
    expect(isPreviewProxyHostAllowed("")).toBe(false);
  });

  it("allows a public host outside 172.16/12 that merely starts with 172", () => {
    expect(isPreviewProxyHostAllowed("172.32.0.1")).toBe(true);
    expect(isPreviewProxyHostAllowed("172.15.0.1")).toBe(true);
  });
});
