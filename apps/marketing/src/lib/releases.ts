// FILE: releases.ts
// Purpose: Defines the GitHub release source used by the marketing site download flows.
// Layer: Marketing util
// Exports: repo/release URLs plus the latest-release fetch helper.

const REPO = "Syphon1205/Modesto";
export const REPO_URL = `https://github.com/${REPO}`;

export const RELEASES_URL = `https://github.com/${REPO}/releases`;

const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RECENT_RELEASES_API_URL = `https://api.github.com/repos/${REPO}/releases`;
const CACHE_KEY = "modesto-latest-release";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export type ReleaseAssetKind = "macos-arm64" | "macos-x64" | "windows-x64" | "linux-x64-appimage";

export interface Release {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
}

export interface RecentRelease extends Release {
  id: number;
  name: string | null;
  body: string | null;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}

export async function fetchLatestRelease(): Promise<Release> {
  const storage = typeof sessionStorage === "undefined" ? null : sessionStorage;
  const cached = storage?.getItem(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const response = await fetch(API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub releases request failed: ${response.status}`);
  const data = await response.json();

  if (data?.assets) {
    storage?.setItem(CACHE_KEY, JSON.stringify(data));
  }

  return data;
}

const ASSET_PATTERNS: Record<ReleaseAssetKind, RegExp> = {
  "macos-arm64": /-arm64\.dmg$/i,
  "macos-x64": /-x64\.dmg$/i,
  "windows-x64": /-x64\.exe$/i,
  "linux-x64-appimage": /-x64\.appimage$/i,
};

export function findReleaseAsset(
  assets: ReleaseAsset[] | undefined,
  kind: ReleaseAssetKind,
): ReleaseAsset | null {
  if (!assets) return null;
  const pattern = ASSET_PATTERNS[kind];
  return assets.find((asset) => pattern.test(asset.name)) ?? null;
}

// Matches actual installers (dmg/exe/AppImage/zip) — excludes auto-updater metadata
// (*.yml, *.blockmap) and checksum files, which get hit repeatedly by every already-
// installed app checking for updates and would wildly overcount real installs.
const INSTALLER_ASSET_PATTERN = /\.(dmg|exe|appimage|zip)$/i;

interface ReleaseAssetWithCount {
  name: string;
  download_count: number;
}

interface ReleaseWithAssetCounts {
  draft: boolean;
  assets: ReleaseAssetWithCount[];
}

/**
 * Sums installer download counts across every published release, from the first
 * release to the latest. Used as an honest, if approximate, "people running Modesto"
 * figure — it counts installer downloads, not unique users or active installs.
 */
export async function fetchTotalDownloads(): Promise<number> {
  let total = 0;
  let page = 1;
  const perPage = 100;

  // Repos with a very long release history are paginated; 10 pages (1000 releases)
  // is far more than Modesto will realistically have and keeps this bounded.
  for (let guard = 0; guard < 10; guard += 1) {
    const response = await fetch(`${RECENT_RELEASES_API_URL}?per_page=${perPage}&page=${page}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub releases request failed: ${response.status}`);

    const data = (await response.json()) as ReleaseWithAssetCounts[];
    if (!Array.isArray(data) || data.length === 0) break;

    for (const release of data) {
      if (release.draft) continue;
      for (const asset of release.assets ?? []) {
        if (INSTALLER_ASSET_PATTERN.test(asset.name)) total += asset.download_count ?? 0;
      }
    }

    if (data.length < perPage) break;
    page += 1;
  }

  return total;
}

export async function fetchRecentReleases(limit = 12): Promise<RecentRelease[]> {
  const safeLimit = Math.max(1, Math.min(30, Math.floor(limit)));
  const response = await fetch(`${RECENT_RELEASES_API_URL}?per_page=${safeLimit}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub releases request failed: ${response.status}`);

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("GitHub releases returned an invalid response");

  return data.filter(
    (release): release is RecentRelease =>
      release != null &&
      typeof release.id === "number" &&
      typeof release.tag_name === "string" &&
      typeof release.html_url === "string" &&
      release.draft === false,
  );
}

export function releaseHeroImage(body: string | null): string | null {
  if (!body) return null;
  return body.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)?.[1] ?? null;
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\r/g, "")
    .trim();
}

export function releaseSummary(body: string | null): string {
  if (!body) return "Release notes and downloadable builds are available on GitHub.";
  const paragraphs = body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .split(/\n\s*\n/)
    .map(cleanMarkdown)
    .filter(
      (paragraph) => paragraph && !/^(highlights|downloads|notes|sha-?256)$/i.test(paragraph),
    );

  const summary = paragraphs.find((paragraph) => !paragraph.startsWith("Full Changelog"));
  if (!summary) return "Release notes and downloadable builds are available on GitHub.";
  return summary.length > 260 ? `${summary.slice(0, 257).trimEnd()}…` : summary;
}

export function releaseHighlights(body: string | null, limit = 4): string[] {
  if (!body) return [];
  return body
    .split("\n")
    .filter((line) => /^\s*[-•]\s+/.test(line))
    .map(cleanMarkdown)
    .filter(Boolean)
    .slice(0, limit);
}

export const REPOSITORY_URL = `https://github.com/${REPO}`;

const STATS_URL = `https://api.github.com/repos/${REPO}`;
const STATS_CACHE_KEY = "modesto-repo-stats";

export interface RepoStats {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string } | null;
}

/**
 * Live repository stats for the download page.
 *
 * Deliberately unauthenticated: it is public data and the endpoint allows 60
 * requests/hour per IP, which a marketing page cannot exhaust. Cached in
 * sessionStorage so navigating between pages does not re-spend that budget.
 * Callers must handle rejection — the page has to render without a number.
 */
export async function fetchRepoStats(): Promise<RepoStats> {
  const cached = sessionStorage.getItem(STATS_CACHE_KEY);
  if (cached) return JSON.parse(cached) as RepoStats;

  const response = await fetch(STATS_URL);
  if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
  const data = (await response.json()) as RepoStats;

  if (typeof data?.stargazers_count === "number") {
    sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(data));
  }
  return data;
}
