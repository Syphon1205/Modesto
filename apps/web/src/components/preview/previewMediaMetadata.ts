export interface PreviewMediaMetadata {
  readonly title: string;
  readonly artist: string | null;
  readonly album: string | null;
  readonly artworkUrl: string | null;
  readonly sourceLabel: string;
  readonly hasMediaSessionMetadata: boolean;
}

export const PREVIEW_MEDIA_METADATA_EXPRESSION = `(() => {
  const metadata = navigator.mediaSession?.metadata ?? null;
  const meta = (selector) => document.querySelector(selector)?.getAttribute("content")?.trim() || null;
  const artwork = metadata?.artwork?.length ? metadata.artwork[metadata.artwork.length - 1]?.src : null;
  return {
    title: metadata?.title || meta('meta[property="og:title"]') || document.title || null,
    artist: metadata?.artist || null,
    album: metadata?.album || null,
    artworkUrl: artwork || meta('meta[property="og:image"]') || null,
    source: meta('meta[name="application-name"]') || meta('meta[property="og:site_name"]') || null,
    hasMediaSessionMetadata: Boolean(metadata),
  };
})()`;

const MEDIA_SOURCE_LABELS: ReadonlyArray<readonly [suffix: string, label: string]> = [
  ["music.youtube.com", "YouTube Music"],
  ["open.spotify.com", "Spotify"],
  ["music.apple.com", "Apple Music"],
  ["soundcloud.com", "SoundCloud"],
  ["tidal.com", "TIDAL"],
  ["deezer.com", "Deezer"],
  ["pandora.com", "Pandora"],
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
  ["vimeo.com", "Vimeo"],
  ["twitch.tv", "Twitch"],
];

const AUDIO_SOURCE_SUFFIXES = [
  "music.youtube.com",
  "open.spotify.com",
  "music.apple.com",
  "soundcloud.com",
  "tidal.com",
  "deezer.com",
  "pandora.com",
] as const;

const VIDEO_SOURCE_SUFFIXES = ["youtube.com", "youtu.be", "vimeo.com", "twitch.tv"] as const;

function hostnameForUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const matchesHost = (hostname: string, suffix: string): boolean =>
  hostname === suffix || hostname.endsWith(`.${suffix}`);

export function mediaSourceLabel(url: string | null, pageSource?: string | null): string {
  const hostname = hostnameForUrl(url);
  if (hostname) {
    const known = MEDIA_SOURCE_LABELS.find(([suffix]) => matchesHost(hostname, suffix));
    if (known) return known[1];
  }
  const explicit = pageSource?.trim();
  if (explicit) return explicit.slice(0, 80);
  return hostname ?? "Browser";
}

export function isVideoPlaybackUrl(url: string | null): boolean {
  const hostname = hostnameForUrl(url);
  if (!hostname || matchesHost(hostname, "music.youtube.com")) return false;
  return VIDEO_SOURCE_SUFFIXES.some((suffix) => matchesHost(hostname, suffix));
}

export function isAudioPlaybackUrl(url: string | null): boolean {
  const hostname = hostnameForUrl(url);
  return hostname !== null && AUDIO_SOURCE_SUFFIXES.some((suffix) => matchesHost(hostname, suffix));
}

const boundedString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

function safeArtworkUrl(value: unknown, pageUrl: string | null): string | null {
  const raw = boundedString(value, 2_048);
  if (!raw) return null;
  try {
    const resolved = new URL(raw, pageUrl ?? undefined);
    return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.href : null;
  } catch {
    return null;
  }
}

export function parsePreviewMediaMetadata(
  value: unknown,
  pageUrl: string | null,
  fallbackTitle: string | null,
): PreviewMediaMetadata | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const title = boundedString(record["title"], 240) ?? boundedString(fallbackTitle, 240);
  if (!title) return null;
  return {
    title,
    artist: boundedString(record["artist"], 160),
    album: boundedString(record["album"], 160),
    artworkUrl: safeArtworkUrl(record["artworkUrl"], pageUrl),
    sourceLabel: mediaSourceLabel(pageUrl, boundedString(record["source"], 80)),
    hasMediaSessionMetadata: record["hasMediaSessionMetadata"] === true,
  };
}

export function shouldShowCompactMediaCard(input: {
  readonly audible: boolean;
  readonly pageUrl: string | null;
  readonly metadata: PreviewMediaMetadata | null;
}): boolean {
  return (
    input.audible &&
    input.metadata !== null &&
    !isVideoPlaybackUrl(input.pageUrl) &&
    (input.metadata.hasMediaSessionMetadata || isAudioPlaybackUrl(input.pageUrl))
  );
}
