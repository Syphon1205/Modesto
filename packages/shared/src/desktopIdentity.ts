// FILE: desktopIdentity.ts
// Purpose: Defines the canonical desktop application identity across packaging and runtime.

export const MODESTO_DESKTOP_SCHEME = "modesto";
export const MODESTO_DESKTOP_ORIGIN = `${MODESTO_DESKTOP_SCHEME}://app`;
export const MODESTO_DESKTOP_ENTRY_URL = `${MODESTO_DESKTOP_ORIGIN}/index.html`;
export const MODESTO_DESKTOP_UPDATE_CHANNEL = "modesto";
export const MODESTO_DESKTOP_DEVELOPMENT_UPDATE_CHANNEL = "modesto-dev";
export const MODESTO_PRODUCTION_BUNDLE_ID = "com.fabweavr.modesto";
export const MODESTO_DEVELOPMENT_BUNDLE_ID = `${MODESTO_PRODUCTION_BUNDLE_ID}.dev`;

export function modestoBundleId(isDevelopment: boolean): string {
  return isDevelopment ? MODESTO_DEVELOPMENT_BUNDLE_ID : MODESTO_PRODUCTION_BUNDLE_ID;
}
