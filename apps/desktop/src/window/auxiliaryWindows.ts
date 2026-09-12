import type * as Electron from "electron";

const auxiliaryWindows = new WeakSet<Electron.BrowserWindow>();

export function markAuxiliaryWindow(window: Electron.BrowserWindow): void {
  auxiliaryWindows.add(window);
}

export function isAuxiliaryWindow(window: Electron.BrowserWindow): boolean {
  return auxiliaryWindows.has(window);
}
