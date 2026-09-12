import * as Schema from "effect/Schema";

export const LISTENING_SERVICE_IDS = [
  "apple-music",
  "spotify",
  "youtube-music",
  "tidal",
  "soundcloud",
  "amazon-music",
] as const;

export const ListeningServiceIdSchema = Schema.Literals([
  "apple-music",
  "spotify",
  "youtube-music",
  "tidal",
  "soundcloud",
  "amazon-music",
]);
export type ListeningServiceId = typeof ListeningServiceIdSchema.Type;

export const LISTENING_WS_METHODS = {
  listLibraries: "listening.listLibraries",
  listPlaylists: "listening.listPlaylists",
  listTracks: "listening.listTracks",
  control: "listening.control",
  playback: "listening.playback",
} as const;

export const ListeningLibraryPlaylistSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  trackCount: Schema.NullOr(Schema.Number),
});
export type ListeningLibraryPlaylist = typeof ListeningLibraryPlaylistSchema.Type;

export const ListeningLibraryTrackSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  artist: Schema.String,
  album: Schema.String,
  durationSeconds: Schema.Number,
  year: Schema.NullOr(Schema.Number),
  artworkUrl: Schema.NullOr(Schema.String),
});
export type ListeningLibraryTrack = typeof ListeningLibraryTrackSchema.Type;

export const ListeningLibraryPlaylistsResultSchema = Schema.Struct({
  playlists: Schema.Array(ListeningLibraryPlaylistSchema),
  native: Schema.Boolean,
});
export type ListeningLibraryPlaylistsResult = typeof ListeningLibraryPlaylistsResultSchema.Type;

export const ListeningLibraryTracksResultSchema = Schema.Struct({
  tracks: Schema.Array(ListeningLibraryTrackSchema),
  truncated: Schema.Boolean,
});
export type ListeningLibraryTracksResult = typeof ListeningLibraryTracksResultSchema.Type;

export const ListeningLibraryPlaybackSchema = Schema.Union([
  Schema.Struct({ state: Schema.Literal("stopped") }),
  Schema.Struct({
    state: Schema.Literals(["playing", "paused"]),
    title: Schema.String,
    artist: Schema.String,
    album: Schema.String,
    durationSeconds: Schema.Number,
    positionSeconds: Schema.Number,
    trackId: Schema.NullOr(Schema.String),
    artworkUrl: Schema.NullOr(Schema.String),
  }),
]);
export type ListeningLibraryPlayback = typeof ListeningLibraryPlaybackSchema.Type;

export const ListeningLibraryControlActionSchema = Schema.Literals([
  "play",
  "playPlaylist",
  "pause",
  "resume",
  "next",
  "previous",
  "seek",
]);
export type ListeningLibraryControlAction = typeof ListeningLibraryControlActionSchema.Type;

export const ListeningLibraryListInputSchema = Schema.Struct({
  id: ListeningServiceIdSchema,
});
export type ListeningLibraryListInput = typeof ListeningLibraryListInputSchema.Type;

export const ListeningLibraryTracksInputSchema = Schema.Struct({
  id: ListeningServiceIdSchema,
  playlistId: Schema.String,
});
export type ListeningLibraryTracksInput = typeof ListeningLibraryTracksInputSchema.Type;

export const ListeningLibraryControlInputSchema = Schema.Struct({
  id: ListeningServiceIdSchema,
  action: ListeningLibraryControlActionSchema,
  playlistId: Schema.optionalKey(Schema.String),
  trackId: Schema.optionalKey(Schema.String),
  positionSeconds: Schema.optionalKey(Schema.Number),
});
export type ListeningLibraryControlInput = typeof ListeningLibraryControlInputSchema.Type;

export class ListeningLibraryError extends Schema.TaggedErrorClass<ListeningLibraryError>()(
  "ListeningLibraryError",
  {
    message: Schema.String,
  },
) {}
