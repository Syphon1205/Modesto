// FILE: release-smoke.ts
// Purpose: Smoke-tests release version alignment and merged macOS updater manifests.
// Layer: Release verification script
// Depends on: update-release-package-versions.ts and merge-mac-update-manifests.ts.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MODESTO_DESKTOP_UPDATE_CHANNEL,
  MODESTO_PRODUCTION_BUNDLE_ID,
} from "@modesto/shared/desktopIdentity";

import { resolveDesktopReleaseVersion } from "./lib/desktop-app-version.ts";
import { DESKTOP_STAGE_DEPENDENCY_OVERRIDES } from "./lib/desktop-stage-dependency-overrides.ts";
import {
  readReleaseUpdatePolicyConfig,
  resolveReleaseUpdatePolicy,
} from "./lib/release-update-policy.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const workspaceFiles = [
  "package.json",
  "bun.lock",
  "apps/server/package.json",
  "apps/desktop/package.json",
  "apps/web/package.json",
  "apps/marketing/package.json",
  "packages/contracts/package.json",
  "packages/effect-acp/package.json",
  "packages/shared/package.json",
  "scripts/package.json",
] as const;

function copyWorkspaceManifestFixture(targetRoot: string): void {
  for (const relativePath of workspaceFiles) {
    const sourcePath = resolve(repoRoot, relativePath);
    const destinationPath = resolve(targetRoot, relativePath);
    mkdirSync(dirname(destinationPath), { recursive: true });
    cpSync(sourcePath, destinationPath);
  }
  cpSync(resolve(repoRoot, "patches"), resolve(targetRoot, "patches"), { recursive: true });
}

function writeMacManifestFixtures(targetRoot: string): { arm64Path: string; x64Path: string } {
  const assetDirectory = resolve(targetRoot, "release-assets");
  mkdirSync(assetDirectory, { recursive: true });

  const arm64Path = resolve(assetDirectory, "latest-mac.yml");
  const x64Path = resolve(assetDirectory, "latest-mac-x64.yml");

  writeFileSync(
    arm64Path,
    `version: 9.9.9-smoke.0
files:
  - url: Modesto-9.9.9-smoke.0-arm64.zip
    sha512: arm64zip
    size: 125621344
  - url: Modesto-9.9.9-smoke.0-arm64.dmg
    sha512: arm64dmg
    size: 131754935
path: Modesto-9.9.9-smoke.0-arm64.zip
sha512: arm64zip
releaseDate: '2026-03-08T10:32:14.587Z'
`,
  );

  writeFileSync(
    x64Path,
    `version: 9.9.9-smoke.0
files:
  - url: Modesto-9.9.9-smoke.0-x64.zip
    sha512: x64zip
    size: 132000112
  - url: Modesto-9.9.9-smoke.0-x64.dmg
    sha512: x64dmg
    size: 138148807
path: Modesto-9.9.9-smoke.0-x64.zip
sha512: x64zip
releaseDate: '2026-03-08T10:36:07.540Z'
`,
  );

  return { arm64Path, x64Path };
}

function assertContains(haystack: string, needle: string, message: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(message);
  }
}

function writeJsonFile(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * The four published packages must all carry the same version.
 *
 * They feed different consumers and nothing else cross-checks them:
 *   - `apps/server`  - the version a local/unflagged desktop build packages
 *                      with (`build-desktop-artifact.ts` falls back to it when
 *                      `--build-version` is absent), and the server half of
 *                      the client/server version-skew check.
 *   - `apps/web`     - `APP_VERSION` (via `apps/web/vite.config.ts`), i.e. the
 *                      version shown in About and the client half of the skew
 *                      check.
 *   - `apps/desktop` - the packaged Electron app's own manifest version.
 *   - `packages/contracts` - the shared wire contract.
 *
 * A drift here is quiet and nasty: the app can report one version while the
 * updater compares another, so a release either looks like a downgrade or
 * never gets offered. The T3 foundation swap landed all four on T3's `0.0.33`
 * and they had to be moved back onto Modesto's line by hand - exactly the
 * mistake this guard exists to catch next time.
 */
function verifyPublishedPackageVersionsAgree(): void {
  const versionedPackages = [
    "apps/server",
    "apps/web",
    "apps/desktop",
    "packages/contracts",
  ] as const;

  const versionsByPackage = versionedPackages.map((packageDir) => {
    const manifest = JSON.parse(
      readFileSync(resolve(repoRoot, packageDir, "package.json"), "utf8"),
    ) as { version?: string };
    return [packageDir, manifest.version] as const;
  });

  const missing = versionsByPackage.filter(([, version]) => !version);
  if (missing.length > 0) {
    throw new Error(
      `Published packages must declare a version; missing in ${missing.map(([dir]) => dir).join(", ")}.`,
    );
  }

  const distinctVersions = new Set(versionsByPackage.map(([, version]) => version));
  if (distinctVersions.size !== 1) {
    throw new Error(
      `Published package versions disagree: ${versionsByPackage
        .map(([dir, version]) => `${dir}@${version ?? "<missing>"}`)
        .join(", ")}.`,
    );
  }

  const [version] = [...distinctVersions];
  // Reuse the same validator packaging uses, so a version this repo could not
  // actually ship fails here rather than deep inside electron-builder.
  resolveDesktopReleaseVersion(version as string);
}

function verifyCanonicalIdentity(): void {
  const serverPackage = JSON.parse(
    readFileSync(resolve(repoRoot, "apps/server/package.json"), "utf8"),
  ) as { name?: string; bin?: Record<string, string> };
  if (serverPackage.name !== "@modesto/cli") {
    throw new Error(`Expected CLI package @modesto/cli, got ${serverPackage.name ?? "<missing>"}.`);
  }
  // `./dist/bin.mjs` is this tree's CLI entrypoint, used consistently by the
  // package's own `start` script, the WSL server tree, and the SSH tunnel.
  // This guard was carried over from the pre-migration tree, where the
  // entrypoint was `./dist/index.mjs`, and was never updated - so it failed on
  // every CI run and would have blocked cutting any release at all.
  const CLI_ENTRYPOINT = "./dist/bin.mjs";
  if (
    Object.keys(serverPackage.bin ?? {}).length !== 1 ||
    serverPackage.bin?.modesto !== CLI_ENTRYPOINT
  ) {
    throw new Error(
      `Expected the CLI to expose only the modesto command at ${CLI_ENTRYPOINT}, got ${JSON.stringify(serverPackage.bin ?? {})}.`,
    );
  }
  if (MODESTO_PRODUCTION_BUNDLE_ID !== "com.fabweavr.modesto") {
    throw new Error(`Unexpected production bundle ID: ${MODESTO_PRODUCTION_BUNDLE_ID}.`);
  }
  if (MODESTO_DESKTOP_UPDATE_CHANNEL !== "modesto") {
    throw new Error(`Unexpected desktop update channel: ${MODESTO_DESKTOP_UPDATE_CHANNEL}.`);
  }

  const releasePolicy = readReleaseUpdatePolicyConfig(repoRoot);
  const resolvedPolicy = resolveReleaseUpdatePolicy("9.9.9", releasePolicy);
  if (
    resolvedPolicy.lane !== "clean" ||
    !resolvedPolicy.makeLatest ||
    resolvedPolicy.mirrorToStableChannel
  ) {
    throw new Error("Expected stable clean Modesto releases to publish on GitHub Latest.");
  }
}

function verifyReleaseWorkflowSafety(): void {
  const workflow = readFileSync(resolve(repoRoot, ".github/workflows/release.yml"), "utf8");
  assertContains(
    workflow,
    "publish_release:\n        description:",
    "Expected a manual publication opt-in input.",
  );
  assertContains(
    workflow,
    "default: false\n        type: boolean",
    "Expected manual release runs to default to build-only mode.",
  );
  assertContains(
    workflow,
    "publish_release: ${{ steps.release_mode.outputs.publish_release }}",
    "Expected preflight to expose the resolved publication mode.",
  );
  assertContains(
    workflow,
    "if: ${{ needs.preflight.outputs.publish_release == 'true' }}",
    "Expected GitHub publication to require explicit publication mode.",
  );
  assertContains(
    workflow,
    "needs.preflight.outputs.publish_release == 'true' && needs.preflight.outputs.is_prerelease == 'false' && vars.MODESTO_PUBLISH_CLI == '1'",
    "Expected CLI publication to require explicit publication mode and a stable release.",
  );
  assertContains(
    workflow,
    'prepare-release-update-feed.ts release-assets "${{ needs.preflight.outputs.update_channel }}"',
    "Expected release artifacts to use their resolved stable or development update channel.",
  );
  assertContains(
    workflow,
    "needs.preflight.outputs.publish_release == 'true' && vars.MODESTO_FINALIZE_RELEASE == '1'",
    "Expected release finalization to require explicit publication mode.",
  );
  assertContains(
    workflow,
    "Public macOS releases must be signed and notarized.",
    "Expected public macOS releases to fail closed when Apple credentials are unavailable.",
  );
  assertContains(
    workflow,
    "MODESTO_RELEASE_REPOSITORY: Syphon1205/Modesto",
    "Expected releases and updater metadata to target the Syphon1205 distribution repository.",
  );
  assertContains(
    workflow,
    "Publishing from a separate private source repository requires RELEASE_REPOSITORY_TOKEN",
    "Expected cross-repository publication to fail closed without distribution access.",
  );
  assertContains(
    workflow,
    "Refusing to publish an unsigned or unnotarized macOS build.",
    "Expected macOS artifact jobs to prevent unsigned publication.",
  );
  // The workflow is stricter than this guard originally assumed: unsigned
  // Windows builds are allowed only for build-only validation runs, and a
  // publish without Azure Trusted Signing fails closed. Assert the posture the
  // workflow actually has - the old wording ("Windows signing is optional")
  // stopped existing when that hardening landed, leaving this guard failing on
  // every CI run in both this tree and the pre-migration one.
  assertContains(
    workflow,
    "Refusing to publish an unsigned Windows installer.",
    "Expected public Windows releases to fail closed when signing credentials are unavailable.",
  );
  assertContains(
    workflow,
    "Windows signing disabled for this build-only validation",
    "Expected unsigned Windows builds to remain possible for build-only validation runs.",
  );
}

function verifyDesktopStageProductionInstall(targetRoot: string): void {
  const stageInstallRoot = resolve(targetRoot, "desktop-stage-install");
  mkdirSync(stageInstallRoot, { recursive: true });

  writeJsonFile(resolve(stageInstallRoot, "package.json"), {
    private: true,
    dependencies: {
      "@pierre/diffs": "^1.1.0-beta.16",
    },
    overrides: DESKTOP_STAGE_DEPENDENCY_OVERRIDES,
  });

  execFileSync("bun", ["install", "--production"], {
    cwd: stageInstallRoot,
    stdio: "inherit",
  });

  const diffsPackageJson = JSON.parse(
    readFileSync(resolve(stageInstallRoot, "node_modules/@pierre/diffs/package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const themePackageJson = JSON.parse(
    readFileSync(resolve(stageInstallRoot, "node_modules/@pierre/theme/package.json"), "utf8"),
  ) as { version?: string };
  const expectedThemeVersion = diffsPackageJson.dependencies?.["@pierre/theme"];
  if (!expectedThemeVersion || themePackageJson.version !== expectedThemeVersion) {
    throw new Error(
      `Expected @pierre/theme ${expectedThemeVersion ?? "<missing>"} for @pierre/diffs, got ${themePackageJson.version ?? "<missing>"}.`,
    );
  }
}

const tempRoot = mkdtempSync(join(tmpdir(), "modesto-release-smoke-"));

try {
  verifyPublishedPackageVersionsAgree();
  verifyCanonicalIdentity();
  verifyReleaseWorkflowSafety();
  copyWorkspaceManifestFixture(tempRoot);

  execFileSync(
    process.execPath,
    [
      resolve(repoRoot, "scripts/update-release-package-versions.ts"),
      "9.9.9-smoke.0",
      "--root",
      tempRoot,
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
    },
  );

  execFileSync("bun", ["install", "--lockfile-only", "--ignore-scripts"], {
    cwd: tempRoot,
    stdio: "inherit",
  });

  const lockfile = readFileSync(resolve(tempRoot, "bun.lock"), "utf8");
  assertContains(
    lockfile,
    `"version": "9.9.9-smoke.0"`,
    "Expected bun.lock to contain the smoke version.",
  );

  const { arm64Path, x64Path } = writeMacManifestFixtures(tempRoot);
  execFileSync(
    process.execPath,
    [resolve(repoRoot, "scripts/merge-mac-update-manifests.ts"), arm64Path, x64Path],
    {
      cwd: repoRoot,
      stdio: "inherit",
    },
  );

  const mergedManifest = readFileSync(arm64Path, "utf8");
  assertContains(
    mergedManifest,
    "Modesto-9.9.9-smoke.0-arm64.zip",
    "Merged manifest is missing the arm64 asset.",
  );
  assertContains(
    mergedManifest,
    "Modesto-9.9.9-smoke.0-x64.zip",
    "Merged manifest is missing the x64 asset.",
  );

  verifyDesktopStageProductionInstall(tempRoot);

  console.log("Release smoke checks passed.");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
