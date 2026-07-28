import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadAndVerifyNpmPlatformCliArtifact,
  resolveNpmPlatformCliTarget,
  sha1File,
  type NpmPlatformCliTarget,
} from "./npmPlatformCliRuntime";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-npm-platform-cli-runtime-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    FS.rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe("resolveNpmPlatformCliTarget", () => {
  it("resolves codex for supported platform/arch pairs", () => {
    expect(
      resolveNpmPlatformCliTarget({ provider: "codex", platform: "darwin", arch: "arm64" }),
    ).toEqual({
      packageName: "@openai/codex",
      version: "0.144.4-darwin-arm64",
      binaryPathInPackage: "vendor/aarch64-apple-darwin/bin/codex",
    });
    expect(
      resolveNpmPlatformCliTarget({ provider: "codex", platform: "win32", arch: "x64" }),
    ).toEqual({
      packageName: "@openai/codex",
      version: "0.144.4-win32-x64",
      binaryPathInPackage: "vendor/x86_64-pc-windows-msvc/bin/codex.exe",
    });
    expect(
      resolveNpmPlatformCliTarget({ provider: "codex", platform: "win32", arch: "arm64" }),
    ).toBeNull();
  });

  it("resolves claude for supported platform/arch pairs", () => {
    expect(
      resolveNpmPlatformCliTarget({ provider: "claude", platform: "linux", arch: "x64" }),
    ).toEqual({
      packageName: "@anthropic-ai/claude-agent-sdk-linux-x64",
      version: "0.3.207",
      binaryPathInPackage: "claude",
    });
    expect(
      resolveNpmPlatformCliTarget({ provider: "claude", platform: "linux", arch: "ia32" }),
    ).toBeNull();
  });

  it("resolves opencode, mapping win32 to the 'windows' package name segment", () => {
    expect(
      resolveNpmPlatformCliTarget({ provider: "opencode", platform: "win32", arch: "x64" }),
    ).toEqual({
      packageName: "opencode-windows-x64",
      version: "1.18.1",
      binaryPathInPackage: "bin/opencode.exe",
    });
    expect(
      resolveNpmPlatformCliTarget({ provider: "opencode", platform: "darwin", arch: "arm64" }),
    ).toEqual({
      packageName: "opencode-darwin-arm64",
      version: "1.18.1",
      binaryPathInPackage: "bin/opencode",
    });
  });
});

describe("sha1File", () => {
  it("hashes file contents", async () => {
    const root = temporaryDirectory();
    const path = Path.join(root, "file.txt");
    FS.writeFileSync(path, "hello");
    const hash = await sha1File(path);
    expect(hash).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  });
});

describe("downloadAndVerifyNpmPlatformCliArtifact", () => {
  const target: NpmPlatformCliTarget = {
    packageName: "@openai/codex",
    version: "0.144.4-darwin-arm64",
    binaryPathInPackage: "vendor/aarch64-apple-darwin/bin/codex",
  };
  const helloSha1 = "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d";

  function fetchDispatchingOnUrl(handlers: {
    metadata: () => unknown;
    tarball: () => ArrayBuffer;
  }): typeof fetch {
    return vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("registry.npmjs.org/@openai/codex/0.144.4-darwin-arm64")) {
        return { ok: true, status: 200, json: async () => handlers.metadata() };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => handlers.tarball(),
      };
    }) as unknown as typeof fetch;
  }

  it("fetches registry metadata, downloads, and verifies against its shasum", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, "nested", "codex.tgz");
    const fetchImpl = fetchDispatchingOnUrl({
      metadata: () => ({
        dist: {
          tarball: "https://registry.npmjs.org/@openai/codex/-/codex-x.tgz",
          shasum: helloSha1,
        },
      }),
      tarball: () => new TextEncoder().encode("hello").buffer,
    });

    const result = await downloadAndVerifyNpmPlatformCliArtifact({
      target,
      destinationPath,
      fetchImpl,
    });

    expect(result).toBe(destinationPath);
    expect(FS.readFileSync(destinationPath, "utf8")).toBe("hello");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reuses an existing file whose checksum already matches the registry's shasum", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, "codex.tgz");
    FS.writeFileSync(destinationPath, "hello");
    const fetchImpl = fetchDispatchingOnUrl({
      metadata: () => ({
        dist: {
          tarball: "https://registry.npmjs.org/@openai/codex/-/codex-x.tgz",
          shasum: helloSha1,
        },
      }),
      tarball: () => {
        throw new Error("must not fetch the tarball when the cached file already matches");
      },
    });

    const result = await downloadAndVerifyNpmPlatformCliArtifact({
      target,
      destinationPath,
      fetchImpl,
    });

    expect(result).toBe(destinationPath);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws and removes the file on checksum mismatch", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, "codex.tgz");
    const fetchImpl = fetchDispatchingOnUrl({
      metadata: () => ({
        dist: {
          tarball: "https://registry.npmjs.org/@openai/codex/-/codex-x.tgz",
          shasum: helloSha1,
        },
      }),
      tarball: () => new TextEncoder().encode("not the expected content").buffer,
    });

    await expect(
      downloadAndVerifyNpmPlatformCliArtifact({ target, destinationPath, fetchImpl }),
    ).rejects.toThrow(/Checksum mismatch/);
    expect(FS.existsSync(destinationPath)).toBe(false);
  });

  it("throws on a non-OK metadata HTTP response", async () => {
    const root = temporaryDirectory();
    const destinationPath = Path.join(root, "codex.tgz");
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(
      downloadAndVerifyNpmPlatformCliArtifact({ target, destinationPath, fetchImpl }),
    ).rejects.toThrow(/HTTP 404/);
  });
});
