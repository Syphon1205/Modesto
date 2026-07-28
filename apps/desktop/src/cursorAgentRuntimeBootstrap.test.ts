import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cursorAgentRuntimeExecutablePath,
  ensureCursorAgentRuntimeInstalled,
  startCursorAgentRuntimeBootstrapInBackground,
} from "./cursorAgentRuntimeBootstrap";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-cursor-agent-bootstrap-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    FS.rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

const FAKE_ARTIFACT = {
  fileName: "cursor-agent-test.tar.gz",
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", // sha256("hello")
  url: "https://downloads.cursor.com/test/agent-cli-package.tar.gz",
  version: "test-version",
};

function fakeResolveArtifact() {
  return FAKE_ARTIFACT;
}

describe("cursorAgentRuntimeExecutablePath", () => {
  it("returns null for unsupported platforms", () => {
    const installRoot = temporaryDirectory();
    expect(
      cursorAgentRuntimeExecutablePath({ installRoot, platform: "win32", arch: "x64" }),
    ).toBeNull();
  });

  it("returns a deterministic path for darwin", () => {
    const installRoot = temporaryDirectory();
    const path = cursorAgentRuntimeExecutablePath({
      installRoot,
      platform: "darwin",
      arch: "arm64",
    });
    expect(path).toContain(Path.join("cursor-agent-runtime"));
    expect(path).toContain(Path.join("bin", "cursor-agent"));
  });
});

describe("startCursorAgentRuntimeBootstrapInBackground", () => {
  it("does not run the optional download on the startup call stack", async () => {
    let resolveInstall!: (value: { status: "installed"; binaryPath: string }) => void;
    const install = new Promise<{ status: "installed"; binaryPath: string }>((resolve) => {
      resolveInstall = resolve;
    });
    const ensureImpl = vi.fn(() => install);
    const onResult = vi.fn();

    startCursorAgentRuntimeBootstrapInBackground({
      installRoot: "/tmp/modesto-provider-tools",
      ensureImpl,
      onResult,
      onError: vi.fn(),
    });

    expect(ensureImpl).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(ensureImpl).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();

    resolveInstall({ status: "installed", binaryPath: "/tmp/cursor-agent" });
    await install;
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledWith({
      status: "installed",
      binaryPath: "/tmp/cursor-agent",
    });
  });
});

describe("ensureCursorAgentRuntimeInstalled", () => {
  it("returns unsupported without touching disk on an unsupported platform", async () => {
    const installRoot = temporaryDirectory();
    const result = await ensureCursorAgentRuntimeInstalled({
      installRoot,
      platform: "win32",
      arch: "x64",
    });
    expect(result).toEqual({ status: "unsupported", binaryPath: null });
    expect(FS.existsSync(Path.join(installRoot, "cursor-agent-runtime"))).toBe(false);
  });

  it("takes the fast path when the binary already exists", async () => {
    const installRoot = temporaryDirectory();
    const binaryPath = Path.join(
      installRoot,
      "cursor-agent-runtime",
      FAKE_ARTIFACT.version,
      "bin",
      "cursor-agent",
    );
    FS.mkdirSync(Path.dirname(binaryPath), { recursive: true });
    FS.writeFileSync(binaryPath, "existing binary");
    const fetchImpl = vi.fn();

    const result = await ensureCursorAgentRuntimeInstalled({
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveArtifactImpl: fakeResolveArtifact,
      fetchImpl,
    });

    expect(result).toEqual({ status: "already-installed", binaryPath });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("downloads, extracts, and installs on a fresh run", async () => {
    const installRoot = temporaryDirectory();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
    });
    const extractImpl = vi.fn(async (input: { destinationBinDir: string }) => {
      FS.writeFileSync(Path.join(input.destinationBinDir, "cursor-agent"), "cursor-agent binary");
    });

    const result = await ensureCursorAgentRuntimeInstalled({
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveArtifactImpl: fakeResolveArtifact,
      fetchImpl,
      extractImpl,
    });

    expect(result.status).toBe("installed");
    expect(result.binaryPath).not.toBeNull();
    expect(FS.readFileSync(result.binaryPath as string, "utf8")).toBe("cursor-agent binary");
  });

  it("returns unavailable and cleans up on checksum mismatch", async () => {
    const installRoot = temporaryDirectory();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("wrong content").buffer,
    });

    const result = await ensureCursorAgentRuntimeInstalled({
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveArtifactImpl: fakeResolveArtifact,
      fetchImpl,
    });

    expect(result.status).toBe("unavailable");
    expect(result.binaryPath).toBeNull();
    expect(result.error).toMatch(/Checksum mismatch/);
    expect(
      FS.existsSync(Path.join(installRoot, "cursor-agent-runtime", FAKE_ARTIFACT.version)),
    ).toBe(false);
  });

  it("returns unavailable and cleans up on extraction failure", async () => {
    const installRoot = temporaryDirectory();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
    });
    const extractImpl = vi.fn().mockRejectedValue(new Error("tar failed"));

    const result = await ensureCursorAgentRuntimeInstalled({
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveArtifactImpl: fakeResolveArtifact,
      fetchImpl,
      extractImpl,
    });

    expect(result.status).toBe("unavailable");
    expect(result.error).toMatch(/tar failed/);
    expect(
      FS.existsSync(Path.join(installRoot, "cursor-agent-runtime", FAKE_ARTIFACT.version)),
    ).toBe(false);
    expect(
      FS.existsSync(
        Path.join(
          installRoot,
          "cursor-agent-runtime",
          `${FAKE_ARTIFACT.version}.staging-${process.pid}`,
        ),
      ),
    ).toBe(false);
  });

  it("prunes stale version directories once a new version is installed", async () => {
    const installRoot = temporaryDirectory();
    const staleDir = Path.join(installRoot, "cursor-agent-runtime", "stale-version");
    FS.mkdirSync(Path.join(staleDir, "bin"), { recursive: true });
    FS.writeFileSync(Path.join(staleDir, "bin", "cursor-agent"), "stale binary");

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
    });
    const extractImpl = vi.fn(async (input: { destinationBinDir: string }) => {
      FS.writeFileSync(Path.join(input.destinationBinDir, "cursor-agent"), "cursor-agent binary");
    });

    await ensureCursorAgentRuntimeInstalled({
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveArtifactImpl: fakeResolveArtifact,
      fetchImpl,
      extractImpl,
    });

    expect(FS.existsSync(staleDir)).toBe(false);
  });
});
