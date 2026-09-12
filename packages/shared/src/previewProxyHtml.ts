// FILE: previewProxyHtml.ts
// Purpose: Turn a fetched page into one Modesto can frame and automate.
// Layer: Shared (pure)
//
// Three edits, each for a specific reason:
//
//   1. A `<base>` tag pointing back into the proxy, so every relative URL the
//      page already contains resolves inside the proxy without being rewritten.
//   2. Absolute URLs in navigational and subresource attributes rewritten onto
//      the proxy, since `<base>` cannot reach those.
//   3. The automation agent script injected as early as possible, so the host
//      can drive the page as soon as it parses.
//
// This is deliberately regex-based rather than a full parse. The rewrite only
// has to be good enough to keep a page inside the proxy, a real parser would
// have to re-serialize the document (changing it in ways the page can detect),
// and a malformed match degrades to "this one URL escapes the proxy" rather
// than to a broken document.

import { rewritePreviewProxyUrl } from "./previewProxyUrl.ts";

/** Headers that would stop the proxied page being framed or scripted by us. */
export const PREVIEW_PROXY_STRIPPED_HEADERS: ReadonlyArray<string> = [
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  // The page is re-served from our origin; the target's transport and isolation
  // policies describe a different origin and only break the frame here.
  "strict-transport-security",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  "content-encoding",
  "content-length",
];

export function stripPreviewProxyHeaders(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  const stripped = new Set(PREVIEW_PROXY_STRIPPED_HEADERS);
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (stripped.has(name.toLowerCase())) continue;
    out[name] = value;
  }
  return out;
}

/** Attributes whose value is a single URL. */
const URL_ATTRIBUTES = ["href", "src", "action", "poster", "formaction", "data-src"];

const ATTRIBUTE_PATTERN = new RegExp(
  `\\b(${URL_ATTRIBUTES.join("|")})\\s*=\\s*("([^"]*)"|'([^']*)')`,
  "gi",
);

/** `srcset` holds a comma-separated list of "url descriptor" pairs. */
const SRCSET_PATTERN = /\b(srcset|imagesrcset)\s*=\s*("([^"]*)"|'([^']*)')/gi;

function rewriteSrcset(value: string, token: string, baseUrl: string): string {
  return value
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (trimmed.length === 0) return candidate;
      const spaceIndex = trimmed.search(/\s/);
      const url = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
      const descriptor = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex);
      return `${rewritePreviewProxyUrl({ value: url, token, baseUrl })}${descriptor}`;
    })
    .join(", ");
}

/**
 * Rewrite absolute URLs in markup onto the proxy.
 *
 * Exported separately from `preparePreviewProxyHtml` so a caller can rewrite a
 * fragment (an XHR-loaded partial, say) without re-injecting base and agent.
 */
export function rewritePreviewProxyMarkup(input: {
  readonly html: string;
  readonly token: string;
  readonly baseUrl: string;
}): string {
  const withAttributes = input.html.replace(
    ATTRIBUTE_PATTERN,
    (match, attribute: string, _quoted: string, doubleQuoted?: string, singleQuoted?: string) => {
      const value = doubleQuoted ?? singleQuoted ?? "";
      const rewritten = rewritePreviewProxyUrl({
        value,
        token: input.token,
        baseUrl: input.baseUrl,
      });
      if (rewritten === value) return match;
      const quote = doubleQuoted === undefined ? "'" : '"';
      return `${attribute}=${quote}${rewritten}${quote}`;
    },
  );

  return withAttributes.replace(
    SRCSET_PATTERN,
    (match, attribute: string, _quoted: string, doubleQuoted?: string, singleQuoted?: string) => {
      const value = doubleQuoted ?? singleQuoted ?? "";
      const rewritten = rewriteSrcset(value, input.token, input.baseUrl);
      if (rewritten === value) return match;
      const quote = doubleQuoted === undefined ? "'" : '"';
      return `${attribute}=${quote}${rewritten}${quote}`;
    },
  );
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The full document transform: strip the page's own `<base>`, add ours, rewrite
 * absolute URLs, and inject the agent.
 *
 * The page's own `<base>` has to go first - leaving it would send every
 * relative URL straight back out of the proxy, which is the one thing the base
 * tag is here to prevent.
 */
export function preparePreviewProxyHtml(input: {
  readonly html: string;
  readonly token: string;
  /** Absolute URL the document was fetched from. */
  readonly baseUrl: string;
  /** Path within the proxy the document is being served at. */
  readonly proxyBasePath: string;
  /** Script source injected into the document head, without `<script>` tags. */
  readonly agentScript: string;
}): string {
  const withoutBase = input.html.replace(/<base\b[^>]*>/gi, "");
  const rewritten = rewritePreviewProxyMarkup({
    html: withoutBase,
    token: input.token,
    baseUrl: input.baseUrl,
  });

  const injection =
    `<base href="${escapeHtmlAttribute(input.proxyBasePath)}">` +
    `<script data-modesto-preview-agent="1">${input.agentScript}</script>`;

  const headMatch = /<head\b[^>]*>/i.exec(rewritten);
  if (headMatch) {
    const at = headMatch.index + headMatch[0].length;
    return rewritten.slice(0, at) + injection + rewritten.slice(at);
  }

  const htmlMatch = /<html\b[^>]*>/i.exec(rewritten);
  if (htmlMatch) {
    const at = htmlMatch.index + htmlMatch[0].length;
    return `${rewritten.slice(0, at)}<head>${injection}</head>${rewritten.slice(at)}`;
  }

  // A fragment or a document with no html element at all still has to carry the
  // agent, or the host has nothing to talk to.
  return `<head>${injection}</head>${rewritten}`;
}

/**
 * The directory the proxied document should resolve relative URLs against.
 *
 * `<base>` resolves against the directory of its href, so a document served at
 * `/proxy/.../a/b` must advertise `/proxy/.../a/` - advertising the document
 * path itself would resolve `c` to `/proxy/.../a/c` only by accident of the
 * trailing segment.
 */
export function previewProxyBasePath(proxyPath: string): string {
  const withoutQuery = proxyPath.split(/[?#]/)[0] ?? proxyPath;
  const lastSlash = withoutQuery.lastIndexOf("/");
  return lastSlash === -1 ? `${withoutQuery}/` : withoutQuery.slice(0, lastSlash + 1);
}
