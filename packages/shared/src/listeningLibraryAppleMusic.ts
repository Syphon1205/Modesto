import { spawn } from "node:child_process";
import type { ListeningServiceId } from "@modesto/contracts";

import {
  cachedListeningArtworkUrl,
  commitStagedArtwork,
  importArtworkBin,
  stageArtworkDir,
} from "./listeningLibraryArtworkStore.ts";
import { supportsNativeListeningLibrary } from "./listeningLibraryDetect.ts";

export const LISTENING_LIBRARY_PLAYLIST_ID = /^[A-Za-z0-9]+$/;
export const APPLE_MUSIC_LIBRARY_PLAYLIST_ID = "library";
export const APPLE_MUSIC_TRACK_LIMIT = 80;

const PLAYLISTS_SCRIPT = `
on run
  tell application "Music"
    set out to "library" & tab & "Library" & linefeed
    set theIds to persistent ID of user playlists
    set theNames to name of user playlists
    repeat with i from 1 to (count of theIds)
      set out to out & (item i of theIds) & tab & (item i of theNames) & linefeed
    end repeat
    return out
  end tell
end run
`;

const TRACKS_SCRIPT = `
on flatten(s)
  set t to s as text
  set AppleScript's text item delimiters to {tab, return, linefeed}
  set pieces to every text item of t
  set AppleScript's text item delimiters to " "
  return pieces as text
end flatten

on run argv
  set playlistId to item 1 of argv
  set lim to item 2 of argv as integer
  tell application "Music"
    if playlistId is "library" then
      set p to library playlist 1
    else
      set p to first user playlist whose persistent ID is playlistId
    end if
    set c to count of tracks of p
    if c < 1 then return ""
    if c < lim then set lim to c
    set out to ""
    repeat with i from 1 to lim
      set t to track i of p
      set out to out & (persistent ID of t) & tab & my flatten(name of t) & tab & my flatten(artist of t) & tab & my flatten(album of t) & tab & (duration of t as integer) & tab & (year of t as integer) & linefeed
    end repeat
    if c > lim then set out to out & "__TRUNCATED__" & linefeed
    return out
  end tell
end run
`;

const CONTROL_SCRIPT = `
on run argv
  set action to item 1 of argv
  tell application "Music"
    if action is "pause" then
      pause
      return "ok"
    end if
    if action is "resume" then
      play
      return "ok"
    end if
    if action is "next" then
      next track
      return "ok"
    end if
    if action is "previous" then
      previous track
      return "ok"
    end if
    if action is "playPlaylist" then
      set playlistId to item 2 of argv
      if playlistId is "library" then
        play library playlist 1
      else
        play (first user playlist whose persistent ID is playlistId)
      end if
      return "ok"
    end if
    if action is "play" then
      set trackId to item 2 of argv
      set playlistId to item 3 of argv
      set t to missing value
      if playlistId is not "library" then
        try
          set p to first user playlist whose persistent ID is playlistId
          set t to first track of p whose persistent ID is trackId
        end try
      end if
      if t is missing value then
        set t to first track of library playlist 1 whose persistent ID is trackId
      end if
      play t
      return "ok"
    end if
    if action is "seek" then
      set player position to (item 2 of argv as real)
      return "ok"
    end if
  end tell
  error "Unknown action"
end run
`;

const PLAYBACK_SCRIPT = `
on flatten(s)
  set t to s as text
  set AppleScript's text item delimiters to {tab, return, linefeed}
  set pieces to every text item of t
  set AppleScript's text item delimiters to " "
  return pieces as text
end flatten

on run
  tell application "Music"
    set st to player state as text
    if st is "stopped" then return "stopped"
    set t to current track
    return st & tab & my flatten(name of t) & tab & my flatten(artist of t) & tab & my flatten(album of t) & tab & (duration of t as integer) & tab & (player position as real) & tab & (persistent ID of t)
  end tell
end run
`;

const ARTWORK_PLAYLIST_SCRIPT = `
on flatten(s)
  set t to s as text
  set AppleScript's text item delimiters to {tab, return, linefeed}
  set pieces to every text item of t
  set AppleScript's text item delimiters to " "
  return pieces as text
end flatten

on writeArt(dest, d)
  set f to open for access POSIX file dest with write permission
  set eof of f to 0
  write d to f
  close access f
end writeArt

on run argv
  set playlistId to item 1 of argv
  set destDir to item 2 of argv
  set lim to item 3 of argv as integer
  tell application "Music"
    if playlistId is "library" then
      set p to library playlist 1
    else
      set p to first user playlist whose persistent ID is playlistId
    end if
    set c to count of tracks of p
  end tell
  set seen to {}
  set out to ""
  set n to 0
  repeat with i from 1 to c
    if n ≥ lim then exit repeat
    tell application "Music"
      set t to track i of p
      set art to my flatten(artist of t)
      set alb to my flatten(album of t)
      set artCount to count of artworks of t
      if artCount > 0 then
        set d to raw data of artwork 1 of t
      end if
    end tell
    set albumKey to art & tab & alb
    if seen does not contain albumKey then
      copy albumKey to end of seen
      if artCount > 0 then
        set n to n + 1
        my writeArt(destDir & "/" & n & ".bin", d)
        set out to out & n & tab & art & tab & alb & linefeed
      end if
    end if
  end repeat
  return out
end run
`;

const ARTWORK_CURRENT_SCRIPT = `
on flatten(s)
  set t to s as text
  set AppleScript's text item delimiters to {tab, return, linefeed}
  set pieces to every text item of t
  set AppleScript's text item delimiters to " "
  return pieces as text
end flatten

on writeArt(dest, d)
  set f to open for access POSIX file dest with write permission
  set eof of f to 0
  write d to f
  close access f
end writeArt

on run argv
  set dest to item 1 of argv
  tell application "Music"
    if player state is stopped then return ""
    set t to current track
    if (count of artworks of t) is 0 then return ""
    set d to raw data of artwork 1 of t
    set info to my flatten(artist of t) & tab & my flatten(album of t)
  end tell
  my writeArt(dest, d)
  return info
end run
`;

export interface ListeningLibraryPlaylist {
  readonly id: string;
  readonly name: string;
  readonly trackCount: number | null;
}

export interface ListeningLibraryTrack {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly durationSeconds: number;
  readonly year: number | null;
  readonly artworkUrl: string | null;
}

export interface ListeningLibraryTrackList {
  readonly tracks: readonly ListeningLibraryTrack[];
  readonly truncated: boolean;
}

export type ListeningLibraryPlayback =
  | { readonly state: "stopped" }
  | {
      readonly state: "playing" | "paused";
      readonly title: string;
      readonly artist: string;
      readonly album: string;
      readonly durationSeconds: number;
      readonly positionSeconds: number;
      readonly trackId: string | null;
      readonly artworkUrl: string | null;
    };

export function parseListeningLibraryPlaylists(raw: string): ListeningLibraryPlaylist[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const record = entry as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.name !== "string") return [];
      if (
        record.id !== APPLE_MUSIC_LIBRARY_PLAYLIST_ID &&
        !LISTENING_LIBRARY_PLAYLIST_ID.test(record.id)
      ) {
        return [];
      }
      return [
        {
          id: record.id,
          name: record.name,
          trackCount:
            typeof record.trackCount === "number" && Number.isFinite(record.trackCount)
              ? record.trackCount
              : null,
        },
      ];
    });
  }
  const playlists: ListeningLibraryPlaylist[] = [];
  for (const line of trimmed.split("\n")) {
    const [id, ...nameParts] = line.split("\t");
    const name = nameParts.join("\t").trim();
    if (!id || !name) continue;
    if (id !== APPLE_MUSIC_LIBRARY_PLAYLIST_ID && !LISTENING_LIBRARY_PLAYLIST_ID.test(id)) continue;
    playlists.push({ id, name, trackCount: null });
  }
  return playlists;
}

export function parseListeningLibraryTracks(raw: string): ListeningLibraryTrackList {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) return { tracks: [], truncated: false };
    const record = parsed as Record<string, unknown>;
    const tracks: ListeningLibraryTrack[] = [];
    if (Array.isArray(record.tracks)) {
      for (const entry of record.tracks) {
        if (typeof entry !== "object" || entry === null) continue;
        const track = entry as Record<string, unknown>;
        if (typeof track.id !== "string" || typeof track.title !== "string") continue;
        tracks.push({
          id: track.id,
          title: track.title,
          artist: typeof track.artist === "string" ? track.artist : "",
          album: typeof track.album === "string" ? track.album : "",
          durationSeconds:
            typeof track.durationSeconds === "number" && Number.isFinite(track.durationSeconds)
              ? Math.max(0, track.durationSeconds)
              : 0,
          year: parseListeningYear(track.year),
          artworkUrl: typeof track.artworkUrl === "string" ? track.artworkUrl : null,
        });
      }
    }
    return { tracks, truncated: record.truncated === true };
  }
  const tracks: ListeningLibraryTrack[] = [];
  let truncated = false;
  for (const line of trimmed.split("\n")) {
    if (line === "__TRUNCATED__") {
      truncated = true;
      continue;
    }
    const [id, title, artist, album, duration, year] = line.split("\t");
    if (!id || !title) continue;
    tracks.push({
      id,
      title,
      artist: artist ?? "",
      album: album ?? "",
      durationSeconds: Number(duration) || 0,
      year: parseListeningYear(year),
      artworkUrl: null,
    });
  }
  return { tracks, truncated };
}

export function parseListeningLibraryPlayback(raw: string): ListeningLibraryPlayback {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) return { state: "stopped" };
    const record = parsed as Record<string, unknown>;
    if (record.state !== "playing" && record.state !== "paused") return { state: "stopped" };
    return {
      state: record.state,
      title: typeof record.title === "string" ? record.title : "Unknown",
      artist: typeof record.artist === "string" ? record.artist : "",
      album: typeof record.album === "string" ? record.album : "",
      durationSeconds:
        typeof record.durationSeconds === "number" && Number.isFinite(record.durationSeconds)
          ? Math.max(0, record.durationSeconds)
          : 0,
      positionSeconds:
        typeof record.positionSeconds === "number" && Number.isFinite(record.positionSeconds)
          ? Math.max(0, record.positionSeconds)
          : 0,
      trackId: typeof record.trackId === "string" ? record.trackId : null,
      artworkUrl: typeof record.artworkUrl === "string" ? record.artworkUrl : null,
    };
  }
  if (trimmed === "stopped" || trimmed.length === 0) return { state: "stopped" };
  const [state, title, artist, album, duration, position, trackId] = trimmed.split("\t");
  if (state !== "playing" && state !== "paused") return { state: "stopped" };
  return {
    state,
    title: title || "Unknown",
    artist: artist ?? "",
    album: album ?? "",
    durationSeconds: Number(duration) || 0,
    positionSeconds: Number(position) || 0,
    trackId: trackId && LISTENING_LIBRARY_PLAYLIST_ID.test(trackId) ? trackId : null,
    artworkUrl: null,
  };
}

function parseListeningYear(value: unknown): number | null {
  const year = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(year) || year < 1) return null;
  return Math.floor(year);
}

export function formatListeningTrackDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

let musicLock: Promise<void> = Promise.resolve();

function withMusicLock<T>(run: () => Promise<T>): Promise<T> {
  const next = musicLock.then(run, run);
  musicLock = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function osascriptError(cause: unknown): Error {
  if (cause && typeof cause === "object" && "stderr" in cause) {
    const stderr = String((cause as { stderr: unknown }).stderr).trim();
    if (stderr.length > 0) return new Error(stderr);
  }
  return cause instanceof Error ? cause : new Error("Music did not respond.");
}

async function runAppleScript(
  script: string,
  args: readonly string[] = [],
  timeout = 15_000,
  options?: { readonly serialize?: boolean },
): Promise<string> {
  const run = () =>
    new Promise<string>((resolve, reject) => {
      const child = spawn("/usr/bin/osascript", ["-", ...args], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        finish(() => reject(new Error("Music took too long to respond.")));
      }, timeout);
      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.on("error", (cause) => {
        finish(() => reject(osascriptError(cause)));
      });
      child.on("close", (code) => {
        const errText = Buffer.concat(stderr).toString("utf8").trim();
        if (code === 0) {
          finish(() => resolve(Buffer.concat(stdout).toString("utf8").trim()));
          return;
        }
        finish(() => reject(new Error(errText || "Music did not respond.")));
      });
      child.stdin.end(script);
    });
  if (options?.serialize === false) return run();
  return withMusicLock(run);
}

export async function listAppleMusicPlaylists(): Promise<readonly ListeningLibraryPlaylist[]> {
  return parseListeningLibraryPlaylists(await runAppleScript(PLAYLISTS_SCRIPT));
}

function withTrackArtwork(track: ListeningLibraryTrack): ListeningLibraryTrack {
  return {
    ...track,
    artworkUrl: track.artworkUrl ?? cachedListeningArtworkUrl(track),
  };
}

async function extractPlaylistArtwork(
  playlistId: string,
  tracks: readonly ListeningLibraryTrack[],
): Promise<void> {
  if (tracks.every((track) => cachedListeningArtworkUrl(track))) return;
  const dir = stageArtworkDir();
  try {
    const index = await runAppleScript(
      ARTWORK_PLAYLIST_SCRIPT,
      [playlistId, dir, String(APPLE_MUSIC_TRACK_LIMIT)],
      30_000,
      { serialize: false },
    );
    commitStagedArtwork(index, dir);
  } catch {
    // Covers are decorative; the song list still has to render.
  }
}

async function extractCurrentArtwork(lookup: {
  readonly artist: string;
  readonly album: string;
  readonly title: string;
}): Promise<string | null> {
  const cached = cachedListeningArtworkUrl(lookup);
  if (cached) return cached;
  const dir = stageArtworkDir();
  const staged = `${dir}/current.bin`;
  try {
    const index = await runAppleScript(ARTWORK_CURRENT_SCRIPT, [staged], 10_000, {
      serialize: false,
    });
    if (index.length > 0) {
      const [artist, ...albumParts] = index.split("\t");
      importArtworkBin(staged, {
        artist: artist ?? lookup.artist,
        album: albumParts.join("\t").trim() || lookup.album,
        title: lookup.title,
      });
    }
  } catch {
    // Now-playing art is best-effort.
  }
  return cachedListeningArtworkUrl(lookup);
}

export async function listAppleMusicTracks(playlistId: string): Promise<ListeningLibraryTrackList> {
  if (
    playlistId !== APPLE_MUSIC_LIBRARY_PLAYLIST_ID &&
    !LISTENING_LIBRARY_PLAYLIST_ID.test(playlistId)
  ) {
    return { tracks: [], truncated: false };
  }
  const listed = parseListeningLibraryTracks(
    await runAppleScript(TRACKS_SCRIPT, [playlistId, String(APPLE_MUSIC_TRACK_LIMIT)], 20_000),
  );
  void extractPlaylistArtwork(playlistId, listed.tracks);
  return { ...listed, tracks: listed.tracks.map(withTrackArtwork) };
}

export async function controlAppleMusic(input: {
  readonly action: "play" | "playPlaylist" | "pause" | "resume" | "next" | "previous" | "seek";
  readonly playlistId?: string;
  readonly trackId?: string;
  readonly positionSeconds?: number;
}): Promise<void> {
  if (input.action === "seek") {
    const position = input.positionSeconds;
    if (typeof position !== "number" || !Number.isFinite(position)) {
      throw new Error("Missing position.");
    }
    await runAppleScript(CONTROL_SCRIPT, ["seek", String(Math.max(0, position))], 8_000, {
      serialize: false,
    });
    return;
  }
  if (input.action === "play") {
    const playlistId = input.playlistId ?? APPLE_MUSIC_LIBRARY_PLAYLIST_ID;
    const trackId = input.trackId;
    if (!trackId || !LISTENING_LIBRARY_PLAYLIST_ID.test(trackId)) {
      throw new Error("Missing track.");
    }
    if (
      playlistId !== APPLE_MUSIC_LIBRARY_PLAYLIST_ID &&
      !LISTENING_LIBRARY_PLAYLIST_ID.test(playlistId)
    ) {
      throw new Error("Missing playlist.");
    }
    await runAppleScript(CONTROL_SCRIPT, ["play", trackId, playlistId], 8_000, {
      serialize: false,
    });
    return;
  }
  if (input.action === "playPlaylist") {
    const playlistId = input.playlistId ?? APPLE_MUSIC_LIBRARY_PLAYLIST_ID;
    if (
      playlistId !== APPLE_MUSIC_LIBRARY_PLAYLIST_ID &&
      !LISTENING_LIBRARY_PLAYLIST_ID.test(playlistId)
    ) {
      throw new Error("Missing playlist.");
    }
    await runAppleScript(CONTROL_SCRIPT, ["playPlaylist", playlistId], 8_000, { serialize: false });
    return;
  }
  await runAppleScript(CONTROL_SCRIPT, [input.action], 8_000, { serialize: false });
}

export async function appleMusicPlayback(): Promise<ListeningLibraryPlayback> {
  const playback = parseListeningLibraryPlayback(
    await runAppleScript(PLAYBACK_SCRIPT, [], 8_000, { serialize: false }),
  );
  if (playback.state === "stopped") return playback;
  const artworkUrl = cachedListeningArtworkUrl(playback);
  if (!artworkUrl) {
    void extractCurrentArtwork(playback);
  }
  return { ...playback, artworkUrl };
}

export function preferredListeningPlaylistId(
  playlists: readonly ListeningLibraryPlaylist[],
): string | null {
  const favorite =
    playlists.find((playlist) => playlist.name === "Favorite Songs") ??
    playlists.find((playlist) => playlist.name === "Recently Added") ??
    playlists.find((playlist) => playlist.id !== APPLE_MUSIC_LIBRARY_PLAYLIST_ID);
  return favorite?.id ?? playlists[0]?.id ?? null;
}

export async function listNativeListeningPlaylists(id: ListeningServiceId): Promise<{
  readonly playlists: readonly ListeningLibraryPlaylist[];
  readonly native: boolean;
}> {
  if (!supportsNativeListeningLibrary(id)) return { playlists: [], native: false };
  return { playlists: await listAppleMusicPlaylists(), native: true };
}

export async function listNativeListeningTracks(
  id: ListeningServiceId,
  playlistId: string,
): Promise<ListeningLibraryTrackList> {
  if (!supportsNativeListeningLibrary(id)) return { tracks: [], truncated: false };
  return listAppleMusicTracks(playlistId);
}

export async function controlNativeListeningLibrary(input: {
  readonly id: ListeningServiceId;
  readonly action: "play" | "playPlaylist" | "pause" | "resume" | "next" | "previous" | "seek";
  readonly playlistId?: string;
  readonly trackId?: string;
  readonly positionSeconds?: number;
}): Promise<void> {
  if (!supportsNativeListeningLibrary(input.id)) {
    throw new Error(`${input.id} does not expose a local library on this computer.`);
  }
  await controlAppleMusic(input);
}

export async function nativeListeningPlayback(
  id: ListeningServiceId,
): Promise<ListeningLibraryPlayback> {
  if (!supportsNativeListeningLibrary(id)) return { state: "stopped" };
  return appleMusicPlayback();
}
