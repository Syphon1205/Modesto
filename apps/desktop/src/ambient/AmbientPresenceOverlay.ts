import type { DesktopAmbientPresenceBubble } from "@modesto/contracts";
import * as Electron from "electron";
import * as path from "node:path";

import { AMBIENT_PRESENCE_STATE_CHANNEL } from "../ipc/channels.ts";

// A single fixed-size orb, not a variably-tall stack of per-thread buttons -
// the always-on-top overlay used to grow with the number of active threads,
// which read as a notification tray pinned to the corner rather than an
// ambient presence. One orb, always the same footprint; a badge communicates
// "there's more than this."
const OVERLAY_SIZE = 68;
const OVERLAY_MARGIN = 16;

type HostPlatform = NodeJS.Platform;

let overlayWindow: Electron.BrowserWindow | null = null;
let latestBubbles: ReadonlyArray<DesktopAmbientPresenceBubble> = [];
let preloadPath: string | null = null;
let hostPlatform: HostPlatform = process.platform;

/**
 * Two tints per phase, matching the web orb's `TONE_WASH` exactly (see
 * apps/web/src/components/ambient/AmbientOrb.tsx) - the desktop overlay is a
 * separate Electron bundle with no access to that browser-only React module,
 * so the palette is kept here as a second copy rather than shared. Also drawn
 * from the brand's own wash palette (see apps/marketing/public/announcements/
 * *.svg's wash1/wash2/wash3): green for active/success, gold for waiting.
 */
const PHASE_WASH: Record<DesktopAmbientPresenceBubble["phase"], readonly [string, string]> = {
  starting: ["#5aa679", "#6cb083"],
  running: ["#5aa679", "#6cb083"],
  waiting_for_approval: ["#e0b25e", "#eec488"],
  waiting_for_input: ["#e0b25e", "#eec488"],
  completed: ["#7cbf94", "#9ad1ac"],
  failed: ["#c9603f", "#b3523a"],
  stale: ["#6b7168", "#52564f"],
};
const WASH_INK = "#0d0e0c";
/** Phases whose orb should breathe - the same set as the web orb's `ambientOrbPulses`. */
const PULSING_PHASES = new Set<DesktopAmbientPresenceBubble["phase"]>([
  "starting",
  "running",
  "waiting_for_approval",
  "waiting_for_input",
  "failed",
]);

export function configureAmbientPresenceOverlay(input: {
  readonly dirname: string;
  readonly platform: HostPlatform;
}): void {
  preloadPath = path.join(input.dirname, "ambient-presence-preload.cjs");
  hostPlatform = input.platform;
}

export function buildAmbientPresenceDataUrl(): string {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"
    >
    <meta name="color-scheme" content="dark">
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-app-region: drag;
      }
      /* One orb, not a stack of per-thread buttons - see the module header.
         A soft watercolor wash instead of a glass chip with a hard outline
         ring - see AmbientOrb.tsx's header for the brand technique this is
         ported from (feTurbulence -> feDisplacementMap -> feGaussianBlur
         over layered ellipses). No microphone, no speech - this is a status
         and navigation layer only. */
      button#orb {
        -webkit-app-region: no-drag;
        position: relative;
        width: 52px;
        height: 52px;
        padding: 0;
        border-radius: 999px;
        border: 0;
        color: #f8fafc;
        cursor: pointer;
        background: transparent;
        transition: transform 0.15s ease;
      }
      button#orb:hover {
        transform: scale(1.05);
      }
      button#orb.pulsing {
        animation: pulse 3.2s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.06); opacity: 0.92; }
      }
      #wash {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border-radius: 999px;
        overflow: hidden;
      }
      /* Two washes of the same two tone colors, in different arrangements -
         one slowly crossfades over the other while both independently drift
         (different rotate/scale periods so neither reads as a fixed loop).
         This is what keeps the orb feeling painted and alive instead of a
         single static picture that only pulses on and off. */
      #wash-look-1 {
        transform-origin: 32px 32px;
        animation: drift-1 17s ease-in-out infinite alternate;
      }
      #wash-look-2 {
        transform-origin: 32px 32px;
        animation:
          drift-2 23s ease-in-out infinite alternate,
          cross-fade 9s ease-in-out infinite alternate;
      }
      @keyframes drift-1 {
        0% { transform: rotate(-3deg) scale(1); }
        100% { transform: rotate(4deg) scale(1.045); }
      }
      @keyframes drift-2 {
        0% { transform: rotate(5deg) scale(1.03); }
        100% { transform: rotate(-4deg) scale(0.98); }
      }
      @keyframes cross-fade {
        0% { opacity: 0.15; }
        100% { opacity: 0.85; }
      }
      #badge {
        display: none;
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.7);
        color: #f8fafc;
        font-size: 10px;
        font-weight: 600;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      #badge.visible { display: flex; }
    </style>
  </head>
  <body>
    <button type="button" id="orb">
      <svg id="wash" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <filter id="wash-filter" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.09 0.12" numOctaves="3" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="13" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id="wash-filter-2" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.1 0.08" numOctaves="3" seed="19" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="15" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <circle cx="32" cy="32" r="32" fill="${WASH_INK}" />
        <g id="wash-look-1">
          <ellipse id="wash-a1" cx="28" cy="30" rx="30" ry="27" filter="url(#wash-filter)" opacity="0.85" />
          <ellipse id="wash-b1" cx="40" cy="38" rx="27" ry="25" filter="url(#wash-filter)" opacity="0.65" />
          <ellipse id="wash-a1b" cx="30" cy="22" rx="18" ry="15" filter="url(#wash-filter)" opacity="0.5" />
        </g>
        <g id="wash-look-2">
          <ellipse id="wash-b2" cx="38" cy="26" rx="26" ry="24" filter="url(#wash-filter-2)" opacity="0.8" />
          <ellipse id="wash-a2" cx="24" cy="40" rx="24" ry="22" filter="url(#wash-filter-2)" opacity="0.6" />
        </g>
      </svg>
      <span id="badge"></span>
    </button>
    <script>
      const orb = document.getElementById("orb");
      const badge = document.getElementById("badge");
      const washA1 = document.getElementById("wash-a1");
      const washA1b = document.getElementById("wash-a1b");
      const washB1 = document.getElementById("wash-b1");
      const washA2 = document.getElementById("wash-a2");
      const washB2 = document.getElementById("wash-b2");
      let latestRoutePath = null;
      function render(state) {
        const bubbles = state.bubbles || [];
        if (bubbles.length === 0) {
          orb.style.display = "none";
          latestRoutePath = null;
          return;
        }
        orb.style.display = "";
        // Already sorted by priority (waiting-on-you first) on the web side -
        // the dominant bubble is simply the first one.
        const dominant = bubbles[0];
        latestRoutePath = dominant.routePath;
        washA1.setAttribute("fill", dominant.washA);
        washA1b.setAttribute("fill", dominant.washA);
        washB1.setAttribute("fill", dominant.washB);
        washA2.setAttribute("fill", dominant.washA);
        washB2.setAttribute("fill", dominant.washB);
        orb.title = bubbles.length > 1
          ? bubbles.length + " active — " + dominant.title
          : dominant.title + " — " + dominant.subtitle;

        orb.classList.toggle("pulsing", Boolean(dominant.pulsing));

        if (bubbles.length > 1) {
          badge.textContent = String(bubbles.length);
          badge.classList.add("visible");
        } else {
          badge.classList.remove("visible");
        }
      }
      orb.addEventListener("click", () => {
        if (!latestRoutePath) return;
        window.ambientPresenceOverlay?.navigate(latestRoutePath);
      });
      window.ambientPresenceOverlay?.onState(render);      window.ambientPresenceOverlay?.onState(render);
    </script>
  </body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function placeOverlay(windowRef: Electron.BrowserWindow): void {
  // Fixed size regardless of how many threads are active - see the module
  // header. Only the corner anchor point needs recomputing (e.g. after a
  // display change), not the window's dimensions.
  const display = Electron.screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const x = Math.round(workArea.x + workArea.width - OVERLAY_SIZE - OVERLAY_MARGIN);
  const y = Math.round(workArea.y + OVERLAY_MARGIN + 36);
  windowRef.setBounds({ x, y, width: OVERLAY_SIZE, height: OVERLAY_SIZE }, false);
}

function pushState(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const payload = {
    bubbles: latestBubbles.map((bubble) =>
      Object.assign({}, bubble, {
        washA: PHASE_WASH[bubble.phase][0],
        washB: PHASE_WASH[bubble.phase][1],
        pulsing: PULSING_PHASES.has(bubble.phase),
      }),
    ),
  };
  overlayWindow.webContents.send(AMBIENT_PRESENCE_STATE_CHANNEL, payload);
  placeOverlay(overlayWindow);
}

export async function openAmbientPresenceOverlay(): Promise<void> {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    pushState();
    overlayWindow.showInactive();
    return;
  }
  if (!preloadPath) {
    throw new Error("Ambient presence overlay is not configured.");
  }

  const windowRef = new Electron.BrowserWindow({
    width: OVERLAY_SIZE,
    height: OVERLAY_SIZE,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    ...(hostPlatform === "darwin" ? { type: "panel" as const } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  windowRef.setAlwaysOnTop(true, hostPlatform === "darwin" ? "floating" : "normal");
  if (hostPlatform === "darwin") {
    windowRef.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
  }

  windowRef.on("closed", () => {
    if (overlayWindow === windowRef) {
      overlayWindow = null;
    }
  });

  overlayWindow = windowRef;
  placeOverlay(windowRef);
  await windowRef.loadURL(buildAmbientPresenceDataUrl());
  pushState();
  windowRef.showInactive();
}

export async function closeAmbientPresenceOverlay(): Promise<void> {
  const current = overlayWindow;
  overlayWindow = null;
  if (!current || current.isDestroyed()) return;
  current.close();
}

export async function setAmbientPresenceBubbles(
  bubbles: ReadonlyArray<DesktopAmbientPresenceBubble>,
): Promise<void> {
  latestBubbles = bubbles;
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  pushState();
}
