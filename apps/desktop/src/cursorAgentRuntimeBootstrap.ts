// FILE: cursorAgentRuntimeBootstrap.ts
// Purpose: Download Cursor's `cursor-agent` CLI on first run and stage it for provider-tools PATH pickup.
// Layer: Desktop startup utility

import * as FS from "node:fs";
import { chmod, mkdir, readdir, rename, rm } from "node:fs/promises";
import * as Path from "node:path";

import {
  downloadAndVerifyCursorAgentArtifact,
  extractCursorAgentArchive,
  resolveCursorAgentRuntimeArtifact,
  type CursorAgentRuntimeArtifact,
} from "@modesto/shared/cursorAgentRuntime";

const RUNTIME_DIR_NAME = "cursor-agent-runtime";
const CURSOR_AGENT_BINARY_NAME = "cursor-agent";

function runtimeRootDir(installRoot: string): string {
  return Path.join(installRoot, RUNTIME_DIR_NAME);
}

function versionBinaryPath(installRoot: string, version: string): string {
  return Path.join(runtimeRootDir(installRoot), version, "bin", CURSOR_AGENT_BINARY_NAME);
}

// Pure path computation shared by the bootstrap step and `packagedProviderCliSources()`, so
// both agree on where the binary lives without any shared mutable state.
export function cursorAgentRuntimeExecutablePath(input: {
  readonly installRoot: string;
  readonly platform?: NodeJS.Platform;
  readonly arch?: NodeJS.Architecture;
}): string | null {
  const artifact = resolveCursorAgentRuntimeArtifact({
    platform: input.platform ?? process.platform,
    arch: input.arch ?? process.arch,
  });
  if (!artifact) return null;
  return versionBinaryPath(input.installRoot, artifact.version);
}

export interface CursorAgentRuntimeStatus {
  readonly status: "installed" | "already-installed" | "unsupported" | "unavailable";
  readonly binaryPath: string | null;
  readonly error?: string;
}

/**
 * Starts the optional Cursor runtime install outside the desktop startup call stack.
 * Cursor availability may depend on a slow or offline network, so it must never delay
 * backend startup or creation of the first window.
 */
export function startCursorAgentRuntimeBootstrapInBackground(input: {
  readonly installRoot: string;
  readonly onResult: (result: CursorAgentRuntimeStatus) => void | Promise<void>;
  readonly onError: (error: unknown) => void;
  readonly ensureImpl?: typeof ensureCursorAgentRuntimeInstalled;
}): void {
  queueMicrotask(() => {
    const ensureImpl = input.ensureImpl ?? ensureCursorAgentRuntimeInstalled;
    void ensureImpl({ installRoot: input.installRoot }).then(input.onResult, input.onError);
  });
}

// Downloads, verifies, and extracts cursor-agent into `installRoot` if it isn't already present.
// Never throws: any failure (network, checksum, disk, extraction) degrades to `"unavailable"`
// so Cursor simply shows up as "not installed" rather than blocking app startup.
export async function ensureCursorAgentRuntimeInstalled(input: {
  readonly installRoot: string;
  readonly platform?: NodeJS.Platform;
  readonly arch?: NodeJS.Architecture;
  readonly fetchImpl?: typeof fetch;
  readonly extractImpl?: (input: {
    readonly archivePath: string;
    readonly destinationBinDir: string;
  }) => Promise<void>;
  readonly resolveArtifactImpl?: (input: {
    readonly platform: NodeJS.Platform;
    readonly arch: NodeJS.Architecture;
  }) => CursorAgentRuntimeArtifact | null;
  readonly timeoutMs?: number;
}): Promise<CursorAgentRuntimeStatus> {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const resolveArtifactImpl = input.resolveArtifactImpl ?? resolveCursorAgentRuntimeArtifact;
  const artifact = resolveArtifactImpl({ platform, arch });
  if (!artifact) return { status: "unsupported", binaryPath: null };

  const runtimeRoot = runtimeRootDir(input.installRoot);
  const targetVersionDir = Path.join(runtimeRoot, artifact.version);
  const targetBinaryPath = versionBinaryPath(input.installRoot, artifact.version);

  if (FS.existsSync(targetBinaryPath)) {
    await pruneStaleVersions(runtimeRoot, artifact.version);
    return { status: "already-installed", binaryPath: targetBinaryPath };
  }

  const extractImpl = input.extractImpl ?? extractCursorAgentArchive;
  const stagingDir = `${targetVersionDir}.staging-${process.pid}`;
  try {
    const archivePath = await downloadAndVerifyCursorAgentArtifact({
      artifact,
      destinationPath: Path.join(runtimeRoot, ".cache", artifact.fileName),
      ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
      ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    });

    await rm(stagingDir, { recursive: true, force: true });
    const stagingBinDir = Path.join(stagingDir, "bin");
    await mkdir(stagingBinDir, { recursive: true });
    await extractImpl({ archivePath, destinationBinDir: stagingBinDir });

    const stagedBinaryPath = Path.join(stagingBinDir, CURSOR_AGENT_BINARY_NAME);
    if (!FS.existsSync(stagedBinaryPath)) {
      throw new Error(`Expected ${CURSOR_AGENT_BINARY_NAME} after extracting ${artifact.fileName}`);
    }
    if (platform !== "win32") await chmod(stagedBinaryPath, 0o755);

    await rm(targetVersionDir, { recursive: true, force: true });
    await rename(stagingDir, targetVersionDir);
    await pruneStaleVersions(runtimeRoot, artifact.version);
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
// cursor-agent version, so the cache doesn't grow unbounded across updates.
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
