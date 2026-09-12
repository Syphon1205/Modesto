import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import * as NodeOs from "node:os";
import * as NodePath from "node:path";

import {
  detectListeningArtworkExtension,
  LISTENING_ARTWORK_ID,
  listeningArtworkId,
  listeningArtworkUrl,
  parseAppleMusicArtworkIndex,
  type ListeningArtworkLookup,
} from "./listeningLibraryArtwork.ts";

export function listeningArtworkCacheDir(): string {
  const home = process.env.MODESTO_HOME?.trim();
  if (home) return NodePath.join(home, "caches", "listening-artwork");
  return NodePath.join(NodeOs.tmpdir(), "modesto-listening-artwork");
}

export function resolveListeningArtworkFile(id: string): string | null {
  if (!LISTENING_ARTWORK_ID.test(id)) return null;
  const dir = listeningArtworkCacheDir();
  for (const ext of ["jpg", "png"] as const) {
    const file = NodePath.join(dir, `${id}.${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

export function cachedListeningArtworkUrl(input: ListeningArtworkLookup): string | null {
  return resolveListeningArtworkFile(listeningArtworkId(input)) ? listeningArtworkUrl(input) : null;
}

export function stageArtworkDir(): string {
  const dir = listeningArtworkCacheDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

function persistArtworkBytes(lookup: ListeningArtworkLookup, bytes: Uint8Array): void {
  const ext = detectListeningArtworkExtension(bytes);
  if (!ext) return;
  writeFileSync(
    NodePath.join(listeningArtworkCacheDir(), `${listeningArtworkId(lookup)}.${ext}`),
    bytes,
  );
}

export function importArtworkBin(indexPath: string, lookup: ListeningArtworkLookup): void {
  if (!existsSync(indexPath)) return;
  const bytes = new Uint8Array(readFileSync(indexPath));
  try {
    unlinkSync(indexPath);
  } catch {
    // Staging file is best-effort.
  }
  persistArtworkBytes(lookup, bytes);
}

export function commitStagedArtwork(rawIndex: string, dir: string): void {
  for (const row of parseAppleMusicArtworkIndex(rawIndex)) {
    importArtworkBin(NodePath.join(dir, `${row.index}.bin`), {
      artist: row.artist,
      album: row.album,
      title: "",
    });
  }
}
