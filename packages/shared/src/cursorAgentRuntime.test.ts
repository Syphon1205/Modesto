import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CURSOR_AGENT_DARWIN_ARTIFACTS,
  downloadAndVerifyCursorAgentArtifact,
  resolveCursorAgentRuntimeArtifact,
  sha256File,
} from "./cursorAgentRuntime";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-cursor-agent-runtime-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    FS.rmSync(directory, { recursive: true, force: true });
  }
});

describe("resolveCursorAgentRuntimeArtifact", () => {
  it("resolves a pinned artifact for darwin arm64 and x64", () => {
    expect(resolveCursorAgentRuntimeArtifact({ platform: "darwin", arch: "arm64" })).toEqual(
      CURSOR_AGENT_DARWIN_ARTIFACTS.arm64,
    );
    expect(resolveCursorAgentRuntimeArtifact({ platform: "darwin", arch: "x64" })).toEqual(
      CURSOR_AGENT_DARWIN_ARTIFACTS.x64,
    );
  });

  it("returns null for unsupported platforms and architectures", () => {
    expect(resolveCursorAgentRuntimeArtifact({ platform: "win32", arch: "x64" })).toBeNull();
    expect(resolveCursorAgentRuntimeArtifact({ platform: "linux", arch: "x64" })).toBeNull();
    expect(resolveCursorAgentRuntimeArtifact({ platform: "darwin", arch: "ia32" })).toBeNull();
  });
});

describe("sha256File", () => {
  it("hashes file contents", async () => {
    const root = temporaryDirectory();
    const path = Path.join(root, "file.txt");
    FS.writeFileSync(path, "hello");
    const hash = await sha256File(path);
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("downloadAndVerifyCursorAgentArtifact", () => {
  const artifact = {
    fileName: "cursor-agent-test.tar.gz",
    sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    url: "https://downloads.cursor.com/test/agent-cli-package.tar.gz",
    version: "test",
  };

  it("reuses an existing file whose checksum already matches, without fetching", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, artifact.fileName);
    FS.writeFileSync(destinationPath, "hello");
    const fetchImpl = vi.fn();

    const result = await downloadAndVerifyCursorAgentArtifact({
      artifact,
      destinationPath,
      fetchImpl,
    });

    expect(result).toBe(destinationPath);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("downloads and verifies a fresh artifact", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, "nested", artifact.fileName);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
    });

    const result = await downloadAndVerifyCursorAgentArtifact({
      artifact,
      destinationPath,
      fetchImpl,
    });

    expect(result).toBe(destinationPath);
    expect(FS.readFileSync(destinationPath, "utf8")).toBe("hello");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("throws and removes the file on checksum mismatch", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, artifact.fileName);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("not the expected content").buffer,
    });

    await expect(
      downloadAndVerifyCursorAgentArtifact({ artifact, destinationPath, fetchImpl }),
    ).rejects.toThrow(/Checksum mismatch/);
    expect(FS.existsSync(destinationPath)).toBe(false);
  });

  it("throws on a non-OK HTTP response", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, artifact.fileName);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(
      downloadAndVerifyCursorAgentArtifact({ artifact, destinationPath, fetchImpl }),
    ).rejects.toThrow(/HTTP 404/);
  });
});
