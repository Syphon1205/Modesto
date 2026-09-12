export interface ListeningArtworkLookup {
  readonly artist: string;
  readonly album: string;
  readonly title: string;
}

export const LISTENING_ARTWORK_PATH_PREFIX = "/api/listening/artwork";
export const LISTENING_ARTWORK_ID = /^[a-f0-9]{32}$/;

export function listeningArtworkLookupKey(input: ListeningArtworkLookup): string {
  const artist = input.artist.trim().toLowerCase();
  const album = input.album.trim().toLowerCase();
  const title = input.title.trim().toLowerCase();
  if (artist && album) return `album:${artist}|${album}`;
  return `song:${artist}|${title}`;
}

export function listeningArtworkId(input: ListeningArtworkLookup): string {
  const key = listeningArtworkLookupKey(input);
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    a ^= code;
    a = Math.imul(a, 16777619);
    b = Math.imul(b, 33) ^ code;
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}${(
    Math.imul(a, b) >>> 0
  )
    .toString(16)
    .padStart(8, "0")}${((a ^ b) >>> 0).toString(16).padStart(8, "0")}`;
}

export function listeningArtworkUrl(input: ListeningArtworkLookup): string {
  return `${LISTENING_ARTWORK_PATH_PREFIX}/${listeningArtworkId(input)}`;
}

export function parseAppleMusicArtworkIndex(raw: string): Array<{
  readonly index: string;
  readonly artist: string;
  readonly album: string;
}> {
  const rows: Array<{ index: string; artist: string; album: string }> = [];
  for (const line of raw.trim().split("\n")) {
    if (!line) continue;
    const [index, artist, ...albumParts] = line.split("\t");
    if (!index || !/^\d+$/.test(index)) continue;
    rows.push({
      index,
      artist: artist ?? "",
      album: albumParts.join("\t").trim(),
    });
  }
  return rows;
}

export function detectListeningArtworkExtension(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  return null;
}
