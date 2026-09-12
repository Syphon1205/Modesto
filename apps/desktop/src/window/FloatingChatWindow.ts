import * as Electron from "electron";

import { getDesktopUrl } from "../electron/ElectronProtocol.ts";
import { isAuxiliaryWindow, markAuxiliaryWindow } from "./auxiliaryWindows.ts";

const FLOAT_WIDTH = 380;
const FLOAT_HEIGHT = 560;
const FLOAT_MIN_WIDTH = 320;
const FLOAT_MIN_HEIGHT = 420;

type HostPlatform = NodeJS.Platform;

let floatingWindow: Electron.BrowserWindow | null = null;
let preloadPath: string | null = null;
let hostPlatform: HostPlatform = process.platform;
let isDevelopment = false;

export function configureFloatingChatWindow(input: {
  readonly preloadPath: string;
  readonly platform: HostPlatform;
  readonly isDevelopment: boolean;
}): void {
  preloadPath = input.preloadPath;
  hostPlatform = input.platform;
  isDevelopment = input.isDevelopment;
}

export function isFloatingChatWindow(window: Electron.BrowserWindow): boolean {
  return isAuxiliaryWindow(window) && floatingWindow === window;
}

function desktopHashUrl(routePath: string): string {
  const path = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${getDesktopUrl(isDevelopment)}#${path}`;
}

function placeOnCurrentDisplay(window: Electron.BrowserWindow): void {
  const cursor = Electron.screen.getCursorScreenPoint();
  const display = Electron.screen.getDisplayNearestPoint(cursor);
  const work = display.workArea;
  const bounds = window.getBounds();
  window.setPosition(
    Math.round(work.x + work.width - bounds.width - 24),
    Math.round(work.y + work.height - bounds.height - 24),
  );
}

export async function openFloatingChatWindow(routePath: string): Promise<void> {
  if (!preloadPath) {
    throw new Error("Floating chat window is not configured.");
  }

  const url = desktopHashUrl(routePath);
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    await floatingWindow.loadURL(url);
    if (floatingWindow.isMinimized()) {
      floatingWindow.restore();
    }
    floatingWindow.show();
    floatingWindow.focus();
    return;
  }

  floatingWindow = new Electron.BrowserWindow({
    width: FLOAT_WIDTH,
    height: FLOAT_HEIGHT,
    minWidth: FLOAT_MIN_WIDTH,
    minHeight: FLOAT_MIN_HEIGHT,
    title: "Chat",
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    fullscreenable: false,
    maximizable: false,
    minimizable: true,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: "#111111",
    ...(hostPlatform === "darwin"
      ? {
          type: "panel" as const,
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 14, y: 14 },
        }
      : { frame: true }),
    webPreferences: {
      preload: preloadPath,
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  markAuxiliaryWindow(floatingWindow);

  floatingWindow.setAlwaysOnTop(true, hostPlatform === "darwin" ? "floating" : "normal");
  if (hostPlatform === "darwin") {
    floatingWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
  }

  floatingWindow.once("closed", () => {
    floatingWindow = null;
  });

  placeOnCurrentDisplay(floatingWindow);
  await floatingWindow.loadURL(url);
  floatingWindow.show();
}

export function closeFloatingChatWindow(): void {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    floatingWindow = null;
    return;
  }
  floatingWindow.close();
  floatingWindow = null;
}
