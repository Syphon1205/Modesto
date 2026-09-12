import { LISTENING_SERVICE_IDS, type ListeningServiceId } from "@modesto/contracts";

export { LISTENING_SERVICE_IDS, type ListeningServiceId };

export interface ListeningService {
  readonly id: ListeningServiceId;
  readonly label: string;
  readonly homeUrl: string;
  readonly hostSuffix: string;
  readonly accent: string;
}

export const LISTENING_SERVICES: ReadonlyArray<ListeningService> = [
  {
    id: "apple-music",
    label: "Apple Music",
    homeUrl: "https://music.apple.com/listen-now",
    hostSuffix: "music.apple.com",
    accent: "#fc3c44",
  },
  {
    id: "spotify",
    label: "Spotify",
    homeUrl: "https://open.spotify.com",
    hostSuffix: "open.spotify.com",
    accent: "#1db954",
  },
  {
    id: "youtube-music",
    label: "YouTube Music",
    homeUrl: "https://music.youtube.com",
    hostSuffix: "music.youtube.com",
    accent: "#ff0033",
  },
  {
    id: "tidal",
    label: "TIDAL",
    homeUrl: "https://listen.tidal.com",
    hostSuffix: "tidal.com",
    accent: "#111111",
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    homeUrl: "https://soundcloud.com/discover",
    hostSuffix: "soundcloud.com",
    accent: "#ff5500",
  },
  {
    id: "amazon-music",
    label: "Amazon Music",
    homeUrl: "https://music.amazon.com",
    hostSuffix: "music.amazon.com",
    accent: "#25d1da",
  },
];

export const DEFAULT_LISTENING_SERVICE_ID: ListeningServiceId = "apple-music";

export function isListeningServiceId(value: unknown): value is ListeningServiceId {
  return typeof value === "string" && (LISTENING_SERVICE_IDS as readonly string[]).includes(value);
}

export function listeningServiceById(id: ListeningServiceId): ListeningService {
  const service = LISTENING_SERVICES.find((candidate) => candidate.id === id);
  return service ?? LISTENING_SERVICES[0]!;
}

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function urlBelongsToListeningService(
  url: string | null | undefined,
  service: ListeningService,
): boolean {
  const hostname = hostnameOf(url);
  if (!hostname) return false;
  return hostname === service.hostSuffix || hostname.endsWith(`.${service.hostSuffix}`);
}

export function searchUrlForListeningService(service: ListeningService, query: string): string {
  const term = query.trim();
  if (term.length === 0) return service.homeUrl;
  const encoded = encodeURIComponent(term);
  switch (service.id) {
    case "apple-music":
      return `https://music.apple.com/search?term=${encoded}`;
    case "spotify":
      return `https://open.spotify.com/search/${encoded}`;
    case "youtube-music":
      return `https://music.youtube.com/search?q=${encoded}`;
    case "tidal":
      return `https://listen.tidal.com/search?q=${encoded}`;
    case "soundcloud":
      return `https://soundcloud.com/search?q=${encoded}`;
    case "amazon-music":
      return `https://music.amazon.com/search/${encoded}`;
  }
}
