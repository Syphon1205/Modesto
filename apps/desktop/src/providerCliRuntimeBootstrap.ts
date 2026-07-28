// FILE: providerCliRuntimeBootstrap.ts
// Purpose: Download Codex/Claude/OpenCode's native CLI binaries on first run, mirroring
// cursorAgentRuntimeBootstrap.ts for the providers whose npm packages are too large to bundle.
// Layer: Desktop startup utility

import * as FS from "node:fs";
import { chmod, mkdir, readdir, rename, rm } from "node:fs/promises";
import * as Path from "node:path";

import {
  downloadAndVerifyNpmPlatformCliArtifact,
  extractNpmPlatformCliArchive,
  resolveNpmPlatformCliTarget,
  type NpmPlatformCliProvider,
  type NpmPlatformCliTarget,
} from "@modesto/shared/npmPlatformCliRuntime";

const RUNTIME_DIR_NAME_BY_PROVIDER: Record<NpmPlatformCliProvider, string> = {
  claude: "claude-runtime",
  codex: "codex-runtime",
  opencode: "opencode-runtime",
};

const BINARY_NAME_BY_PROVIDER: Record<NpmPlatformCliProvider, string> = {
  claude: "claude",
  codex: "codex",
  opencode: "opencode",
};

function runtimeRootDir(provider: NpmPlatformCliProvider, installRoot: string): string {
  return Path.join(installRoot, RUNTIME_DIR_NAME_BY_PROVIDER[provider]);
}

function versionBinaryPath(
  provider: NpmPlatformCliProvider,
  installRoot: string,
  version: string,
  platform: NodeJS.Platform,
): string {
  const exe = platform === "win32" ? ".exe" : "";
  return Path.join(
    runtimeRootDir(provider, installRoot),
    version,
    "bin",
    `${BINARY_NAME_BY_PROVIDER[provider]}${exe}`,
  );
}

// Pure path computation shared by the bootstrap step and `packagedProviderCliSources()`, so
// both agree on where the binary lives without any shared mutable state.
export function providerCliRuntimeExecutablePath(input: {
  readonly provider: NpmPlatformCliProvider;
  readonly installRoot: string;
  readonly platform?: NodeJS.Platform;
  readonly arch?: NodeJS.Architecture;
}): string | null {
  const platform = input.platform ?? process.platform;
  const target = resolveNpmPlatformCliTarget({
    provider: input.provider,
    platform,
    arch: input.arch ?? process.arch,
  });
  if (!target) return null;
  return versionBinaryPath(input.provider, input.installRoot, target.version, platform);
}

export interface ProviderCliRuntimeStatus {
  readonly status: "installed" | "already-installed" | "unsupported" | "unavailable";
  readonly binaryPath: string | null;
  readonly error?: string;
}

/**
 * Starts an optional provider CLI download outside the desktop startup call stack. Provider
 * availability may depend on a slow or offline network, so it must never delay backend
 * startup or creation of the first window — same contract as the cursor-agent bootstrap.
 */
export function startProviderCliRuntimeBootstrapInBackground(input: {
  readonly provider: NpmPlatformCliProvider;
  readonly installRoot: string;
  readonly onResult: (result: ProviderCliRuntimeStatus) => void | Promise<void>;
  readonly onError: (error: unknown) => void;
  readonly ensureImpl?: typeof ensureProviderCliRuntimeInstalled;
}): void {
  queueMicrotask(() => {
    const ensureImpl = input.ensureImpl ?? ensureProviderCliRuntimeInstalled;
    void ensureImpl({ provider: input.provider, installRoot: input.installRoot }).then(
      input.onResult,
      input.onError,
    );
  });
}

// Downloads, verifies, and extracts a provider CLI into `installRoot` if it isn't already
// present. Never throws: any failure (network, checksum, disk, extraction) degrades to
// `"unavailable"` so the provider simply shows up as "not installed" rather than blocking
// app startup.
export async function ensureProviderCliRuntimeInstalled(input: {
  readonly provider: NpmPlatformCliProvider;
  readonly installRoot: string;
  readonly platform?: NodeJS.Platform;
  readonly arch?: NodeJS.Architecture;
  readonly fetchImpl?: typeof fetch;
  readonly extractImpl?: (input: {
    readonly archivePath: string;
    readonly destinationDir: string;
  }) => Promise<void>;
  readonly resolveTargetImpl?: (input: {
    readonly provider: NpmPlatformCliProvider;
    readonly platform: NodeJS.Platform;
    readonly arch: NodeJS.Architecture;
  }) => NpmPlatformCliTarget | null;
  readonly timeoutMs?: number;
}): Promise<ProviderCliRuntimeStatus> {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const resolveTargetImpl = input.resolveTargetImpl ?? resolveNpmPlatformCliTarget;
  const target = resolveTargetImpl({ provider: input.provider, platform, arch });
  if (!target) return { status: "unsupported", binaryPath: null };

  const runtimeRoot = runtimeRootDir(input.provider, input.installRoot);
  const targetVersionDir = Path.join(runtimeRoot, target.version);
  const targetBinaryPath = versionBinaryPath(
    input.provider,
    input.installRoot,
    target.version,
    platform,
  );

  if (FS.existsSync(targetBinaryPath)) {
    await pruneStaleVersions(runtimeRoot, target.version);
    return { status: "already-installed", binaryPath: targetBinaryPath };
  }

  const extractImpl = input.extractImpl ?? extractNpmPlatformCliArchive;
  const stagingDir = `${targetVersionDir}.staging-${process.pid}`;
  try {
    const archiveFileName = `${target.packageName.replaceAll("/", "__")}-${target.version}.tgz`;
    const archivePath = await downloadAndVerifyNpmPlatformCliArtifact({
      target,
      destinationPath: Path.join(runtimeRoot, ".cache", archiveFileName),
      ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
      ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    });

    await rm(stagingDir, { recursive: true, force: true });
    const stagingPackageDir = Path.join(stagingDir, "package");
    await mkdir(stagingPackageDir, { recursive: true });
    await extractImpl({ archivePath, destinationDir: stagingPackageDir });

    const stagedBinarySourcePath = Path.join(stagingPackageDir, target.binaryPathInPackage);
    if (!FS.existsSync(stagedBinarySourcePath)) {
      throw new Error(
        `Expected ${target.binaryPathInPackage} after extracting ${target.packageName}@${target.version}`,
      );
    }
    const stagingBinDir = Path.join(stagingDir, "bin");
    await mkdir(stagingBinDir, { recursive: true });
    const exe = platform === "win32" ? ".exe" : "";
    const stagedBinaryPath = Path.join(
      stagingBinDir,
      `${BINARY_NAME_BY_PROVIDER[input.provider]}${exe}`,
    );
    await rename(stagedBinarySourcePath, stagedBinaryPath);
    await rm(stagingPackageDir, { recursive: true, force: true });
    if (platform !== "win32") await chmod(stagedBinaryPath, 0o755);

    await rm(targetVersionDir, { recursive: true, force: true });
    await rename(stagingDir, targetVersionDir);
    await pruneStaleVersions(runtimeRoot, target.version);
    return { status: "installed", binaryPath: targetBinaryPath };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    return {
      status: "unavailable",
      binaryPath: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Best-effort: removes version directories left behind by a prior app release's pinned
// version, so the cache doesn't grow unbounded across updates.
async function pruneStaleVersions(runtimeRoot: string, currentVersion: string): Promise<void> {
  try {
    const entries = await readdir(runtimeRoot, { withFileTypes: true });
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isDirectory() && entry.name !== currentVersion && entry.name !== ".cache",
        )
        .map((entry) =>
          rm(Path.join(runtimeRoot, entry.name), { recursive: true, force: true }).catch(() => {}),
        ),
    );
  } catch {
    // Best-effort cleanup only; a missing runtimeRoot or read failure is not an error here.
  }
}
