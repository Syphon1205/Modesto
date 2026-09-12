import { createEnvironmentRpcCommand } from "@modesto/client-runtime/state/runtime";
import { LISTENING_WS_METHODS } from "@modesto/contracts";

import { connectionAtomRuntime } from "../connection/runtime";

export const listeningListLibraries = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:listening:libraries",
  tag: LISTENING_WS_METHODS.listLibraries,
});

export const listeningListPlaylists = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:listening:playlists",
  tag: LISTENING_WS_METHODS.listPlaylists,
});

export const listeningListTracks = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:listening:tracks",
  tag: LISTENING_WS_METHODS.listTracks,
});

export const listeningControl = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:listening:control",
  tag: LISTENING_WS_METHODS.control,
});

export const listeningPlayback = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:listening:playback",
  tag: LISTENING_WS_METHODS.playback,
});
