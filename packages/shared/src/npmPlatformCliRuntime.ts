// FILE: npmPlatformCliRuntime.ts
// Purpose: Download, verify, and extract a provider CLI's platform-specific npm package.
// Layer: Shared runtime utility (consumed by the desktop app's first-run bootstrap)
//
// Codex, Claude Agent SDK, and OpenCode each publish their native CLI binary as its own
// npm package per platform+arch (e.g. `@openai/codex@0.144.4-darwin-arm64`,
// `opencode-darwin-arm64@1.18.1`) — the same mechanism `optionalDependencies` uses to fetch
// only the right platform's binary. Fetching that one package directly from the npm registry
// at runtime (rather than bundling every platform's binary from `bun install`) is how the
// desktop app avoids shipping ~700MB of CLIs a given install will only ever run one of.
// Unlike `cursorAgentRuntime.ts` (which pins a hand-verified checksum, since Cursor's CDN
// has no metadata API), the npm registry publishes its own shasum alongside the tarball URL:
// each download is still integrity-checked, just against metadata fetched from the same
// registry call instead of a checksum hardcoded in source.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type NpmPlatformCliProvider = "claude" | "codex" | "opencode";

export interface NpmPlatformCliTarget {
  readonly packageName: string;
  readonly version: string;
  // Path to the binary inside the extracted tarball's `package/` directory.
  readonly binaryPathInPackage: string;
}

// Version bumps require updating this table (same maintenance model as
// CURSOR_AGENT_VERSION in cursorAgentRuntime.ts) — these are the exact versions
// pinned in apps/server/package.json today.
const CODEX_VERSION = "0.144.4";
const CLAUDE_AGENT_SDK_VERSION = "0.3.207";
const OPENCODE_VERSION = "1.18.1";

// Rust target triples for Codex's `vendor/<triple>/bin/codex` layout.
const CODEX_RUST_TRIPLE: Partial<Record<string, Partial<Record<string, string>>>> = {
  darwin: { arm64: "aarch64-apple-darwin", x64: "x86_64-apple-darwin" },
  linux: { arm64: "aarch64-unknown-linux-gnu", x64: "x86_64-unknown-linux-gnu" },
  win32: { x64: "x86_64-pc-windows-msvc" },
};

function opencodePlatformName(platform: NodeJS.Platform): string | null {
  if (platform === "darwin") return "darwin";
  if (platform === "win32") return "windows";
  if (platform === "linux") return "linux";
  return null;
}

export function resolveNpmPlatformCliTarget(input: {
  readonly provider: NpmPlatformCliProvider;
  readonly platform: NodeJS.Platform;
  readonly arch: NodeJS.Architecture;
}): NpmPlatformCliTarget | null {
  const { provider, platform, arch } = input;
  const exe = platform === "win32" ? ".exe" : "";

  if (provider === "codex") {
    if (platform !== "darwin" && platform !== "linux" && platform !== "win32") return null;
    const triple = CODEX_RUST_TRIPLE[platform]?.[arch];
    if (!triple) return null;
    return {
      packageName: "@openai/codex",
      version: `${CODEX_VERSION}-${platform}-${arch}`,
      binaryPathInPackage: `vendor/${triple}/bin/codex${exe}`,
    };
  }

  if (provider === "claude") {
    if (platform !== "darwin" && platform !== "linux" && platform !== "win32") return null;
    if (arch !== "arm64" && arch !== "x64") return null;
    return {
      packageName: `@anthropic-ai/claude-agent-sdk-${platform}-${arch}`,
      version: CLAUDE_AGENT_SDK_VERSION,
      binaryPathInPackage: `claude${exe}`,
    };
  }

  // opencode
  const opencodePlatform = opencodePlatformName(platform);
  if (!opencodePlatform) return null;
  if (arch !== "arm64" && arch !== "x64") return null;
  return {
    packageName: `opencode-${opencodePlatform}-${arch}`,
    version: OPENCODE_VERSION,
    binaryPathInPackage: `bin/opencode${exe}`,
  };
}

interface NpmRegistryPackageMetadata {
  readonly dist: {
    readonly tarball: string;
    readonly shasum: string;
  };
}

async function fetchNpmPackageMetadata(input: {
  readonly packageName: string;
  readonly version: string;
  readonly fetchImpl: typeof fetch;
  readonly timeoutMs: number;
}): Promise<NpmRegistryPackageMetadata> {
  const url = `https://registry.npmjs.org/${input.packageName}/${input.version}`;
  const response = await input.fetchImpl(url, { signal: AbortSignal.timeout(input.timeoutMs) });
  if (!response.ok) {
    throw new Error(`Could not fetch npm registry metadata for ${url}: HTTP ${response.status}`);
  }
  const metadata = (await response.json()) as Partial<NpmRegistryPackageMetadata>;
  if (!metadata.dist?.tarball || !metadata.dist.shasum) {
    throw new Error(
      `npm registry metadata for ${input.packageName}@${input.version} is missing dist info.`,
    );
  }
  return metadata as NpmRegistryPackageMetadata;
}

export async function sha1File(path: string): Promise<string> {
  return createHash("sha1")
    .update(await readFile(path))
    .digest("hex");
}

// Downloads the tarball for `target` to `destinationPath`, verifying it against the shasum
// published by the SAME npm registry metadata call. Reuses an existing file at
// `destinationPath` if its checksum already matches. Throws on any failure.
export async function downloadAndVerifyNpmPlatformCliArtifact(input: {
  readonly target: NpmPlatformCliTarget;
  readonly destinationPath: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 20_000;
  const metadata = await fetchNpmPackageMetadata({
    packageName: input.target.packageName,
    version: input.target.version,
    fetchImpl,
    timeoutMs,
  });

  try {
    if ((await sha1File(input.destinationPath)) === metadata.dist.shasum) {
      return input.destinationPath;
    }
  } catch {
    // Missing or invalid cache entries are replaced below.
  }

  await mkdir(dirname(input.destinationPath), { recursive: true });
  const response = await fetchImpl(metadata.dist.tarball, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Could not download ${metadata.dist.tarball}: HTTP ${response.status}`);
  }
  await writeFile(input.destinationPath, Buffer.from(await response.arrayBuffer()));
  const actualShasum = await sha1File(input.destinationPath);
  if (actualShasum !== metadata.dist.shasum) {
    await rm(input.destinationPath, { force: true });
    throw new Error(
      `Checksum mismatch for ${input.target.packageName}@${input.target.version}: expected ${metadata.dist.shasum}, got ${actualShasum}`,
    );
  }
  return input.destinationPath;
}

// npm tarballs always wrap their contents in a single top-level `package/` directory —
// strip it so `destinationDir` ends up holding the package contents directly.
export async function extractNpmPlatformCliArchive(input: {
  readonly archivePath: string;
  readonly destinationDir: string;
}): Promise<void> {
  await execFileAsync("tar", [
    "-xzf",
    input.archivePath,
    "--strip-components=1",
    "-C",
    input.destinationDir,
  ]);
}
