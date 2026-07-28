// FILE: cursorAgentRuntime.ts
// Purpose: Download, verify, and extract Cursor's `cursor-agent` CLI archive.
// Layer: Shared runtime utility (consumed by the desktop app's first-run bootstrap)

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CursorAgentRuntimeArtifact {
  readonly fileName: string;
  readonly sha256: string;
  readonly url: string;
  readonly version: string;
}

const CURSOR_AGENT_VERSION = "2026.07.09-a3815c0";

export const CURSOR_AGENT_DARWIN_ARTIFACTS: Partial<
  Record<"arm64" | "x64", CursorAgentRuntimeArtifact>
> = {
  arm64: {
    fileName: "cursor-agent-2026.07.09-a3815c0-darwin-arm64.tar.gz",
    sha256: "009ee857d49f17c10e5035e33884eb258d1f3839c1d52bdb35f35a117369dfde",
    url: "https://downloads.cursor.com/lab/2026.07.09-a3815c0/darwin/arm64/agent-cli-package.tar.gz",
    version: CURSOR_AGENT_VERSION,
  },
  x64: {
    fileName: "cursor-agent-2026.07.09-a3815c0-darwin-x64.tar.gz",
    sha256: "066c499f6ec43734254337c493aeec5aabb4a6ae6d6df7da214fa86ceda9e45d",
    url: "https://downloads.cursor.com/lab/2026.07.09-a3815c0/darwin/x64/agent-cli-package.tar.gz",
    version: CURSOR_AGENT_VERSION,
  },
};

// Only macOS has a pinned Cursor artifact today; add more platform tables here as they arrive.
export function resolveCursorAgentRuntimeArtifact(input: {
  readonly platform: NodeJS.Platform;
  readonly arch: NodeJS.Architecture;
}): CursorAgentRuntimeArtifact | null {
  if (input.platform !== "darwin") return null;
  if (input.arch !== "arm64" && input.arch !== "x64") return null;
  return CURSOR_AGENT_DARWIN_ARTIFACTS[input.arch] ?? null;
}

export async function sha256File(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

// Downloads `artifact` to `destinationPath` and verifies its checksum. Reuses an existing file
// at `destinationPath` if its checksum already matches. Throws on any failure; removes a
// downloaded file that fails checksum verification.
export async function downloadAndVerifyCursorAgentArtifact(input: {
  readonly artifact: CursorAgentRuntimeArtifact;
  readonly destinationPath: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    if ((await sha256File(input.destinationPath)) === input.artifact.sha256) {
      return input.destinationPath;
    }
  } catch {
    // Missing or invalid cache entries are replaced below.
  }

  await mkdir(dirname(input.destinationPath), { recursive: true });
  const response = await fetchImpl(input.artifact.url, {
    signal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
  });
  if (!response.ok) {
    throw new Error(`Could not download ${input.artifact.url}: HTTP ${response.status}`);
  }
  await writeFile(input.destinationPath, Buffer.from(await response.arrayBuffer()));
  const actualHash = await sha256File(input.destinationPath);
  if (actualHash !== input.artifact.sha256) {
    await rm(input.destinationPath, { force: true });
    throw new Error(
      `Checksum mismatch for ${input.artifact.fileName}: expected ${input.artifact.sha256}, got ${actualHash}`,
    );
  }
  return input.destinationPath;
}

export async function extractCursorAgentArchive(input: {
  readonly archivePath: string;
  readonly destinationBinDir: string;
}): Promise<void> {
  await execFileAsync("tar", [
    "-xzf",
    input.archivePath,
    "--strip-components=1",
    "-C",
    input.destinationBinDir,
  ]);
}
