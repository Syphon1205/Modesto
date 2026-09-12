import {
  DesktopListeningLibrariesSchema,
  DesktopRequestListeningLibraryInputSchema,
  DesktopRequestListeningLibraryResultSchema,
  ListeningLibraryControlInputSchema,
  ListeningLibraryListInputSchema,
  ListeningLibraryPlaybackSchema,
  ListeningLibraryPlaylistsResultSchema,
  ListeningLibraryTracksInputSchema,
  ListeningLibraryTracksResultSchema,
} from "@modesto/contracts";
import {
  controlNativeListeningLibrary,
  listNativeListeningPlaylists,
  listNativeListeningTracks,
  nativeListeningPlayback,
} from "@modesto/shared/listeningLibraryAppleMusic";
import {
  detectListeningLibrariesOnThisMachine,
  listeningLibraryAppById,
} from "@modesto/shared/listeningLibrary";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as ElectronDialog from "../../electron/ElectronDialog.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

const execFileAsync = promisify(execFile);

export async function probeAppleScriptLibrary(appName: string): Promise<boolean> {
  try {
    await execFileAsync("/usr/bin/osascript", ["-e", `tell application "${appName}" to get name`], {
      timeout: 20_000,
    });
    return true;
  } catch {
    return false;
  }
}

export const listListeningLibraries = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.LIST_LISTENING_LIBRARIES_CHANNEL,
  payload: Schema.Undefined,
  result: DesktopListeningLibrariesSchema,
  handler: Effect.fn("desktop.ipc.listeningLibraries.list")(function* () {
    return { libraries: detectListeningLibrariesOnThisMachine() };
  }),
});

export const requestListeningLibraryAccess = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.REQUEST_LISTENING_LIBRARY_CHANNEL,
  payload: DesktopRequestListeningLibraryInputSchema,
  result: DesktopRequestListeningLibraryResultSchema,
  handler: Effect.fn("desktop.ipc.listeningLibraries.request")(function* (input) {
    const installed = detectListeningLibrariesOnThisMachine().find(
      (library) => library.id === input.id,
    );
    if (!installed?.installed) {
      return {
        id: input.id,
        granted: false,
        installed: false,
        status: "not-installed" as const,
      };
    }

    const spec = listeningLibraryAppById(input.id);
    const label = spec?.label ?? input.id;
    const dialog = yield* ElectronDialog.ElectronDialog;
    const choice = yield* dialog.showMessageBox({
      type: "question",
      buttons: ["Don't Allow", "Allow"],
      defaultId: 1,
      cancelId: 0,
      title: "Library access",
      message: `Allow Modesto to access your ${label} library?`,
      detail: `Modesto found ${label} on this computer. Access lets Music show playlists and songs from that library.`,
    });
    if (choice.response !== 1) {
      return {
        id: input.id,
        granted: false,
        installed: true,
        status: "denied" as const,
      };
    }

    if (process.platform === "darwin" && spec?.appleScriptName) {
      const probed = yield* Effect.promise(() => probeAppleScriptLibrary(spec.appleScriptName!));
      if (!probed) {
        return {
          id: input.id,
          granted: false,
          installed: true,
          status: "denied" as const,
        };
      }
    }

    return {
      id: input.id,
      granted: true,
      installed: true,
      status: "granted" as const,
    };
  }),
});

export const listListeningLibraryPlaylists = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.LIST_LISTENING_LIBRARY_PLAYLISTS_CHANNEL,
  payload: ListeningLibraryListInputSchema,
  result: ListeningLibraryPlaylistsResultSchema,
  handler: Effect.fn("desktop.ipc.listeningLibraries.playlists")(function* (input) {
    return yield* Effect.promise(() => listNativeListeningPlaylists(input.id));
  }),
});

export const listListeningLibraryTracks = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.LIST_LISTENING_LIBRARY_TRACKS_CHANNEL,
  payload: ListeningLibraryTracksInputSchema,
  result: ListeningLibraryTracksResultSchema,
  handler: Effect.fn("desktop.ipc.listeningLibraries.tracks")(function* (input) {
    return yield* Effect.promise(() => listNativeListeningTracks(input.id, input.playlistId));
  }),
});

export const controlListeningLibrary = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.CONTROL_LISTENING_LIBRARY_CHANNEL,
  payload: ListeningLibraryControlInputSchema,
  result: Schema.Struct({ ok: Schema.Boolean }),
  handler: Effect.fn("desktop.ipc.listeningLibraries.control")(function* (input) {
    yield* Effect.promise(() => controlNativeListeningLibrary(input));
    return { ok: true };
  }),
});

export const getListeningLibraryPlayback = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.LISTENING_LIBRARY_PLAYBACK_CHANNEL,
  payload: ListeningLibraryListInputSchema,
  result: ListeningLibraryPlaybackSchema,
  handler: Effect.fn("desktop.ipc.listeningLibraries.playback")(function* (input) {
    return yield* Effect.promise(() => nativeListeningPlayback(input.id));
  }),
});
