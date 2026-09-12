import * as Effect from "effect/Effect";

import * as DesktopIpc from "./DesktopIpc.ts";
import { getClientSettings, setClientSettings } from "./methods/clientSettings.ts";
import {
  clearConnectionCatalog,
  getConnectionCatalog,
  setConnectionCatalog,
} from "./methods/connectionCatalog.ts";
import { getMicrophoneStatus, requestMicrophone } from "./methods/microphone.ts";
import {
  listListeningLibraries,
  listListeningLibraryPlaylists,
  listListeningLibraryTracks,
  controlListeningLibrary,
  getListeningLibraryPlayback,
  requestListeningLibraryAccess,
} from "./methods/listeningLibraries.ts";
import {
  closeAmbientPresence,
  navigateAmbientPresence,
  openAmbientPresence,
  setAmbientPresenceBubbles,
} from "./methods/ambientPresence.ts";
import { closeFloatingChat, openFloatingChat } from "./methods/floatingChat.ts";
import { setRendererActivityLive } from "./methods/rendererActivity.ts";
import {
  captureAppshotNow,
  getAppshotPermissionStatus,
  openAppshotPrivacySettings,
} from "./methods/appshots.ts";
import { openApplication } from "./methods/openApplication.ts";
import {
  getAdvertisedEndpoints,
  getServerExposureState,
  setServerExposureMode,
  setTailscaleServeEnabled,
} from "./methods/serverExposure.ts";
import {
  bootstrapSshBearerSession,
  disconnectSshEnvironment,
  discoverSshHosts,
  ensureSshEnvironment,
  fetchSshEnvironmentDescriptor,
  fetchSshSessionState,
  issueSshWebSocketTicket,
  resolveSshPasswordPrompt,
} from "./methods/sshEnvironment.ts";
import {
  checkForUpdate,
  downloadUpdate,
  getUpdateState,
  installUpdate,
  setUpdateChannel,
} from "./methods/updates.ts";
import {
  getAppBranding,
  getLocalEnvironmentBootstraps,
  getLocalEnvironmentBearerToken,
  getSystemLocale,
  getWindowFullscreenState,
  openExternal,
  probeRemoteEditors,
  pickFolder,
  pickProjectFavicon,
  pickThemeFiles,
  setTheme,
  showContextMenu,
} from "./methods/window.ts";
import * as PreviewIpc from "./methods/preview.ts";
import { getWslState, setWslBackendEnabled, setWslDistro, setWslOnly } from "./methods/wsl.ts";

export const installDesktopIpcHandlers = Effect.fn("desktop.ipc.installHandlers")(function* () {
  const ipc = yield* DesktopIpc.DesktopIpc;
  yield* PreviewIpc.installPreviewEventForwarding();

  yield* ipc.handleSync(getAppBranding);
  yield* ipc.handleSync(getSystemLocale);
  yield* ipc.handleSync(getWindowFullscreenState);
  yield* ipc.handleSync(getLocalEnvironmentBootstraps);
  yield* ipc.handle(getLocalEnvironmentBearerToken);

  yield* ipc.handle(getClientSettings);
  yield* ipc.handle(setClientSettings);
  yield* ipc.handle(getMicrophoneStatus);
  yield* ipc.handle(requestMicrophone);
  yield* ipc.handle(listListeningLibraries);
  yield* ipc.handle(requestListeningLibraryAccess);
  yield* ipc.handle(listListeningLibraryPlaylists);
  yield* ipc.handle(listListeningLibraryTracks);
  yield* ipc.handle(controlListeningLibrary);
  yield* ipc.handle(getListeningLibraryPlayback);
  yield* ipc.handle(openAmbientPresence);
  yield* ipc.handle(closeAmbientPresence);
  yield* ipc.handle(setAmbientPresenceBubbles);
  yield* ipc.handle(navigateAmbientPresence);
  yield* ipc.handle(openApplication);
  yield* ipc.handle(openFloatingChat);
  yield* ipc.handle(closeFloatingChat);
  yield* ipc.handle(setRendererActivityLive);
  yield* ipc.handle(captureAppshotNow);
  yield* ipc.handle(getAppshotPermissionStatus);
  yield* ipc.handle(openAppshotPrivacySettings);
  yield* ipc.handle(getConnectionCatalog);
  yield* ipc.handle(setConnectionCatalog);
  yield* ipc.handle(clearConnectionCatalog);

  yield* ipc.handle(discoverSshHosts);
  yield* ipc.handle(ensureSshEnvironment);
  yield* ipc.handle(disconnectSshEnvironment);
  yield* ipc.handle(fetchSshEnvironmentDescriptor);
  yield* ipc.handle(bootstrapSshBearerSession);
  yield* ipc.handle(fetchSshSessionState);
  yield* ipc.handle(issueSshWebSocketTicket);
  yield* ipc.handle(resolveSshPasswordPrompt);

  yield* ipc.handle(getServerExposureState);
  yield* ipc.handle(setServerExposureMode);
  yield* ipc.handle(setTailscaleServeEnabled);
  yield* ipc.handle(getAdvertisedEndpoints);

  yield* ipc.handle(getWslState);
  yield* ipc.handle(setWslBackendEnabled);
  yield* ipc.handle(setWslDistro);
  yield* ipc.handle(setWslOnly);

  yield* ipc.handle(pickFolder);
  yield* ipc.handle(pickProjectFavicon);
  yield* ipc.handle(pickThemeFiles);
  yield* ipc.handle(setTheme);
  yield* ipc.handle(showContextMenu);
  yield* ipc.handle(openExternal);
  yield* ipc.handle(probeRemoteEditors);
  yield* ipc.handle(getUpdateState);
  yield* ipc.handle(setUpdateChannel);
  yield* ipc.handle(downloadUpdate);
  yield* ipc.handle(installUpdate);
  yield* ipc.handle(checkForUpdate);
  for (const previewMethod of PreviewIpc.methods) {
    yield* ipc.handle(previewMethod);
  }
});
