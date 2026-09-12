import type { BrowserWindow } from "electron";

/**
 * Shared policy for the main window's Chromium background throttling.
 *
 * Boot starts unthrottled so first paint is not delayed. After first reveal,
 * throttling returns unless an agent-live hold or frame-capture hold is on —
 * PreviewManager and the renderer both feed those holds so they cannot fight.
 */

let mainWindow: BrowserWindow | null = null;
let revealed = false;
let agentLiveHold = false;
let frameCaptureHold = false;

function apply(): void {
  const window = mainWindow;
  if (window === null || window.isDestroyed()) {
    return;
  }
  const shouldThrottle = revealed && !agentLiveHold && !frameCaptureHold;
  window.webContents.setBackgroundThrottling(shouldThrottle);
}

export function bindMainWindowBackgroundThrottling(window: BrowserWindow): void {
  mainWindow = window;
  revealed = false;
  // Boot options already set backgroundThrottling: false; do not poke
  // webContents until first reveal / an explicit hold change.
}

export function clearMainWindowBackgroundThrottling(window?: BrowserWindow): void {
  if (window !== undefined && mainWindow !== window) {
    return;
  }
  mainWindow = null;
  revealed = false;
  agentLiveHold = false;
  frameCaptureHold = false;
}

export function markMainWindowRevealed(): void {
  revealed = true;
  apply();
}

export function setMainWindowAgentLiveHold(live: boolean): void {
  agentLiveHold = live;
  apply();
}

export function setMainWindowFrameCaptureHold(held: boolean): void {
  frameCaptureHold = held;
  apply();
}

export function isMainWindowBackgroundThrottlingBound(window: BrowserWindow): boolean {
  return mainWindow === window;
}

/** Test helpers */
export function __resetMainWindowBackgroundThrottlingForTests(): void {
  mainWindow = null;
  revealed = false;
  agentLiveHold = false;
  frameCaptureHold = false;
}

export function __mainWindowBackgroundThrottlingStateForTests(): {
  readonly revealed: boolean;
  readonly agentLiveHold: boolean;
  readonly frameCaptureHold: boolean;
} {
  return { revealed, agentLiveHold, frameCaptureHold };
}
