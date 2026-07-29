// FILE: desktop-app-version.ts
// Purpose: Validates the version embedded in packaged desktop apps before electron-builder runs.
// Layer: Release/build script

// SemVer 2.0.0 disallows leading zeroes in numeric identifiers. electron-builder can still
// create an artifact when a prerelease identifier is invalid, but electron-updater rejects the
// embedded version during app startup, so packaging must fail first.
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const FOUR_PART_PATCH_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.([1-9]\d*)$/;

export interface ResolvedDesktopReleaseVersion {
  /** Version shown to people and used in tags and artifact filenames. */
  readonly releaseVersion: string;
  /** Strict SemVer used by Electron and electron-updater for precedence. */
  readonly appVersion: string;
  /** Native CFBundleVersion/FileVersion value. */
  readonly buildVersion: string;
}

export function validateDesktopAppVersion(value: string): string {
  if (!SEMVER_PATTERN.test(value)) {
    throw new Error(
      `Invalid desktop app version '${value}'. Use strict SemVer without leading zeroes in numeric identifiers (for example, '0.1.1-dev.20260717.50').`,
    );
  }
  return value;
}

export function resolveDesktopReleaseVersion(value: string): ResolvedDesktopReleaseVersion {
  if (SEMVER_PATTERN.test(value)) {
    return {
      releaseVersion: value,
      appVersion: value,
      buildVersion: value,
    };
  }

  const patchMatch = FOUR_PART_PATCH_PATTERN.exec(value);
  if (!patchMatch) {
    validateDesktopAppVersion(value);
    throw new Error(`Invalid desktop release version '${value}'.`);
  }

  const major = Number(patchMatch[1]);
  const minor = Number(patchMatch[2]);
  const patch = Number(patchMatch[3]);
  const patchIteration = Number(patchMatch[4]);
  return {
    releaseVersion: value,
    // Reserve the next SemVer patch core as the carrier for this marketing-version
    // patch lane. Stable A.B.(C+1) still sorts after every A.B.C.N build.
    appVersion: `${major}.${minor}.${patch + 1}-patch.${patchIteration}`,
    buildVersion: value,
  };
}
