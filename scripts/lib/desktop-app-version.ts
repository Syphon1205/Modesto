// FILE: desktop-app-version.ts
// Purpose: Validates the version embedded in packaged desktop apps before electron-builder runs.
// Layer: Release/build script

// SemVer 2.0.0 disallows leading zeroes in numeric identifiers. electron-builder can still
// create an artifact when a prerelease identifier is invalid, but electron-updater rejects the
// embedded version during app startup, so packaging must fail first.
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function validateDesktopAppVersion(value: string): string {
  if (!SEMVER_PATTERN.test(value)) {
    throw new Error(
      `Invalid desktop app version '${value}'. Use strict SemVer without leading zeroes in numeric identifiers (for example, '0.1.1-dev.20260717.50').`,
    );
  }
  return value;
}
