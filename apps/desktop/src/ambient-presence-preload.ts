// @effect-diagnostics globalDate:off - This isolated Electron preload does not run inside an Effect runtime.
import { contextBridge, ipcRenderer } from "electron";

import {
  AMBIENT_PRESENCE_NAVIGATE_CHANNEL,
  AMBIENT_PRESENCE_STATE_CHANNEL,
} from "./ipc/channels.ts";

contextBridge.exposeInMainWorld("ambientPresenceOverlay", {
  onState: (listener: (state: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      listener(state);
    };
    ipcRenderer.on(AMBIENT_PRESENCE_STATE_CHANNEL, wrappedListener);
    return () => ipcRenderer.removeListener(AMBIENT_PRESENCE_STATE_CHANNEL, wrappedListener);
  },
  navigate: (routePath: string) => {
    if (typeof routePath !== "string" || routePath.length === 0) return;
    void ipcRenderer.invoke(AMBIENT_PRESENCE_NAVIGATE_CHANNEL, { routePath });
  },
});
