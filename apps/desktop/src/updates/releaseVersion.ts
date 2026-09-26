// FILE: releaseVersion.ts
// Purpose: Translates updater-safe SemVer carrier versions into Modesto's public patch notation.

const PATCH_CARRIER_PATTERN = /^(\d+)\.(\d+)\.(\d+)-patch\.([1-9]\d*)$/;

/**
 * Public mini-patches use A.B.C.N. Electron requires SemVer, so packages carry
 * A.B.(C+1)-patch.N internally. Keep that transport detail out of the UI.
 */
export function toPublicDesktopVersion(version: string): string {
  const match = PATCH_CARRIER_PATTERN.exec(version);
  if (!match) return version;

  const carrierPatch = Number(match[3]);
  if (carrierPatch === 0) return version;
  return `${match[1]}.${match[2]}.${carrierPatch - 1}.${match[4]}`;
}
