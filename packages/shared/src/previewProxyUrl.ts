// FILE: previewProxyUrl.ts
// Purpose: Map a target URL onto Modesto's same-origin preview proxy, and back.
// Layer: Shared (pure)
//
// The web build cannot automate a cross-origin page: a browser tab may not read
// the DOM of, click inside, or screenshot a frame it does not own. The proxy
// exists to remove the "cross-origin" half of that sentence - it re-serves the
// target from Modesto's own origin, so the automation host can drive it with
// ordinary DOM calls.
//
// The scheme and host live in the PATH rather than a query parameter on
// purpose. A page loaded from `/preview-proxy/t/<token>/https/example.com/a/b`
// resolves its own relative links (`../c`, `/d`) against that prefix, so most
// subresources and in-page navigations stay inside the proxy without any
// rewriting at all. Only absolute URLs need rewriting.

export const PREVIEW_PROXY_PREFIX = "/preview-proxy";

export interface PreviewProxyTarget {
  readonly token: string;
  readonly url: string;
}

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

/** `https://example.com/a?b=1#c` -> `/preview-proxy/t/<token>/https/example.com/a?b=1#c` */
export function encodePreviewProxyPath(input: {
  readonly token: string;
  readonly url: string;
}): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return null;
  }
  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) return null;
  if (input.token.length === 0 || input.token.includes("/")) return null;

  const scheme = parsed.protocol.slice(0, -1);
  // `host` keeps a non-default port, which the target needs to be reachable.
  return `${PREVIEW_PROXY_PREFIX}/t/${input.token}/${scheme}/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Inverse of `encodePreviewProxyPath`. Returns null for anything malformed. */
export function decodePreviewProxyPath(pathAndQuery: string): PreviewProxyTarget | null {
  if (!pathAndQuery.startsWith(`${PREVIEW_PROXY_PREFIX}/t/`)) return null;
  const rest = pathAndQuery.slice(`${PREVIEW_PROXY_PREFIX}/t/`.length);

  const tokenEnd = rest.indexOf("/");
  if (tokenEnd <= 0) return null;
  const token = rest.slice(0, tokenEnd);

  const afterToken = rest.slice(tokenEnd + 1);
  const schemeEnd = afterToken.indexOf("/");
  if (schemeEnd <= 0) return null;
  const scheme = afterToken.slice(0, schemeEnd);
  if (scheme !== "http" && scheme !== "https") return null;

  const afterScheme = afterToken.slice(schemeEnd + 1);
  if (afterScheme.length === 0) return null;
  const hostEnd = afterScheme.search(/[/?#]/);
  const host = hostEnd === -1 ? afterScheme : afterScheme.slice(0, hostEnd);
  if (host.length === 0) return null;
  const tail = hostEnd === -1 ? "/" : afterScheme.slice(hostEnd);

  try {
    return { token, url: new URL(`${scheme}://${host}${tail}`).toString() };
  } catch {
    return null;
  }
}

/**
 * Rewrite one URL found in proxied markup so it stays inside the proxy.
 *
 * Relative URLs are returned untouched - the injected `<base>` already resolves
 * them correctly, and rewriting them by hand would be one more thing to get
 * wrong. Non-navigational schemes (`data:`, `blob:`, `mailto:`, `javascript:`)
 * are left alone because proxying them is meaningless.
 */
export function rewritePreviewProxyUrl(input: {
  readonly value: string;
  readonly token: string;
  readonly baseUrl: string;
}): string {
  const value = input.value.trim();
  if (value.length === 0) return input.value;
  if (/^(data|blob|mailto|javascript|about|tel|sms):/i.test(value)) return input.value;
  if (value.startsWith("#")) return input.value;

  // Protocol-relative and absolute URLs are the only ones that escape `<base>`.
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  const protocolRelative = value.startsWith("//");
  if (!absolute && !protocolRelative) return input.value;

  try {
    const resolved = new URL(value, input.baseUrl);
    const encoded = encodePreviewProxyPath({ token: input.token, url: resolved.toString() });
    return encoded ?? input.value;
  } catch {
    return input.value;
  }
}

/**
 * Whether a host may be proxied.
 *
 * A proxy that will fetch any host on command is a server-side request forgery
 * tool: it reaches the loopback interface, link-local metadata endpoints, and
 * whatever else sits on the server's private network, using the server's own
 * credentials and position. Local development servers are the one case a user
 * legitimately wants, so loopback is allowed and every other private range is
 * not.
 */
export function isPreviewProxyHostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host.length === 0) return false;

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "::1") return true;

  // Cloud metadata services. Named explicitly because reaching one is the
  // single highest-value target of an SSRF and they are easy to typo past a
  // range check.
  if (host === "169.254.169.254" || host === "metadata.google.internal") return false;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const octets = ipv4.slice(1, 5).map((part) => Number.parseInt(part, 10));
    if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) return false;
    const [a, b] = octets as [number, number, number, number];
    if (a === 127) return true; // whole loopback range: a local dev server
    if (a === 10) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 0) return false;
    return true;
  }

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^(f[cd]|fe[89ab])/i.test(host) && host.includes(":")) return false;

  // A bare name with no dot is an internal hostname on the server's network.
  if (!host.includes(".")) return false;

  return true;
}
