// FILE: notificationSurface.ts
// Purpose: Shared visual tokens for transient and inline notification surfaces.
// Layer: UI styling helper
// Exports: notification surface class names used by toast and status banners.

// `--notification-fg` keeps the text/icon/control color tied to the same
// token the rest of the app's flat surfaces use (popover foreground), so it
// is near-black in light themes and near-white in dark themes automatically —
// without depending on the `.dark` class. Children reference it via
// `text-[var(--notification-fg)]` so the contrast fix lives in one place for
// both toasts and inline notification banners.
const NOTIFICATION_FOREGROUND_CLASS_NAME =
  "text-[var(--notification-fg)] [--notification-fg:var(--popover-foreground)]";

// Flat, opaque `bg-popover`/`border-border` — the same chrome as the app's
// other solid panels (e.g. dialog.tsx's solid surface variant) — rather than
// a translucent, accent-tinted, blurred card. `[-webkit-app-region:no-drag]`
// keeps the card (and every control inside it, notably the dismiss "X")
// clickable in the desktop app: toasts can render over Electron's draggable
// titlebar region, and without this the OS captures clicks in that band for
// window dragging and the X stops working.
export const COMPACT_NOTIFICATION_SURFACE_CLASS_NAME = `w-max max-w-[min(calc(100vw-2rem),28rem)] rounded-xl border border-border bg-popover ${NOTIFICATION_FOREGROUND_CLASS_NAME} shadow-lg/20 before:hidden [-webkit-app-region:no-drag]`;

export const EXPANDED_NOTIFICATION_SURFACE_CLASS_NAME = `w-full rounded-2xl border border-border bg-popover ${NOTIFICATION_FOREGROUND_CLASS_NAME} shadow-lg/20 before:hidden [-webkit-app-region:no-drag]`;

export const NOTIFICATION_ICON_CLASS_NAME = "text-[var(--notification-fg)]/85";
