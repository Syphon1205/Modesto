import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NpmPlatformCliTarget } from "@modesto/shared/npmPlatformCliRuntime";
import {
  ensureProviderCliRuntimeInstalled,
  providerCliRuntimeExecutablePath,
  startProviderCliRuntimeBootstrapInBackground,
} from "./providerCliRuntimeBootstrap";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-provider-cli-bootstrap-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    FS.rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

const FAKE_TARGET: NpmPlatformCliTarget = {
  packageName: "@openai/codex",
  version: "test-version",
  binaryPathInPackage: "vendor/test-triple/bin/codex",
};

function fakeResolveTarget() {
  return FAKE_TARGET;
}

// "hello" sha1 — matches what the fake fetchImpl below serves as the tarball body, so
// downloadAndVerifyNpmPlatformCliArtifact's checksum check passes.
const HELLO_SHA1 = "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d";

// downloadAndVerifyNpmPlatformCliArtifact makes two fetch calls: one for npm registry
// metadata (dist.tarball + dist.shasum), one for the tarball bytes themselves.
function fakeSuccessfulDownloadFetch(): typeof fetch {
  // npm registry tarball URLs always contain a "/-/" path segment; metadata URLs never do.
  return vi.fn(async (url: string | URL | Request) => {
    if (!String(url).includes("/-/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          dist: {
            tarball: "https://registry.npmjs.org/@openai/codex/-/codex-x.tgz",
            shasum: HELLO_SHA1,
          },
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
    };
  }) as unknown as typeof fetch;
}

describe("providerCliRuntimeExecutablePath", () => {
  it("returns null for unsupported platforms", () => {
    const installRoot = temporaryDirectory();
    expect(
      providerCliRuntimeExecutablePath({
        provider: "codex",
        installRoot,
        platform: "win32",
        arch: "arm64",
      }),
    ).toBeNull();
  });

  it("returns a deterministic path per provider", () => {
    const installRoot = temporaryDirectory();
    const codexPath = providerCliRuntimeExecutablePath({
      provider: "codex",
      installRoot,
      platform: "darwin",
      arch: "arm64",
    });
    expect(codexPath).toContain(Path.join("codex-runtime"));
    expect(codexPath).toContain(Path.join("bin", "codex"));

    const opencodePath = providerCliRuntimeExecutablePath({
      provider: "opencode",
      installRoot,
      platform: "win32",
      arch: "x64",
    });
    expect(opencodePath).toContain(Path.join("opencode-runtime"));
    expect(opencodePath).toContain(Path.join("bin", "opencode.exe"));
  });
});

describe("startProviderCliRuntimeBootstrapInBackground", () => {
  it("does not run the optional download on the startup call stack", async () => {
    let resolveInstall!: (value: { status: "installed"; binaryPath: string }) => void;
    const install = new Promise<{ status: "installed"; binaryPath: string }>((resolve) => {
      resolveInstall = resolve;
    });
    const ensureImpl = vi.fn(() => install);
    const onResult = vi.fn();

    startProviderCliRuntimeBootstrapInBackground({
      provider: "codex",
      installRoot: "/tmp/modesto-provider-tools",
      ensureImpl,
      onResult,
      onError: vi.fn(),
    });

    expect(ensureImpl).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(ensureImpl).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();

    resolveInstall({ status: "installed", binaryPath: "/tmp/codex" });
    await install;
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledWith({ status: "installed", binaryPath: "/tmp/codex" });
  });
});

describe("ensureProviderCliRuntimeInstalled", () => {
  it("returns unsupported without touching disk on an unsupported platform", async () => {
    const installRoot = temporaryDirectory();
    const result = await ensureProviderCliRuntimeInstalled({
      provider: "codex",
      installRoot,
      platform: "win32",
      arch: "arm64",
    });
    expect(result).toEqual({ status: "unsupported", binaryPath: null });
    expect(FS.existsSync(Path.join(installRoot, "codex-runtime"))).toBe(false);
  });

  it("takes the fast path when the binary already exists", async () => {
    const installRoot = temporaryDirectory();
    const binaryPath = Path.join(installRoot, "codex-runtime", FAKE_TARGET.version, "bin", "codex");
    FS.mkdirSync(Path.dirname(binaryPath), { recursive: true });
    FS.writeFileSync(binaryPath, "existing binary");
    const fetchImpl = vi.fn();

    const result = await ensureProviderCliRuntimeInstalled({
      provider: "codex",
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveTargetImpl: fakeResolveTarget,
      fetchImpl,
    });

    expect(result).toEqual({ status: "already-installed", binaryPath });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("downloads, extracts the binary out of the package dir, and installs on a fresh run", async () => {
    const installRoot = temporaryDirectory();
    const fetchImpl = fakeSuccessfulDownloadFetch();
    const extractImpl = vi.fn(async (input: { destinationDir: string }) => {
      FS.mkdirSync(Path.join(input.destinationDir, "vendor", "test-triple", "bin"), {
        recursive: true,
      });
      FS.writeFileSync(
        Path.join(input.destinationDir, "vendor", "test-triple", "bin", "codex"),
        "codex binary",
      );
    });

    const result = await ensureProviderCliRuntimeInstalled({
      provider: "codex",
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveTargetImpl: fakeResolveTarget,
      fetchImpl,
      extractImpl,
    });

    expect(result.status).toBe("installed");
    expect(result.binaryPath).not.toBeNull();
    expect(FS.readFileSync(result.binaryPath as string, "utf8")).toBe("codex binary");
    // The staging package/ scratch dir must not survive the install.
    expect(
      FS.existsSync(Path.join(installRoot, "codex-runtime", FAKE_TARGET.version, "package")),
    ).toBe(false);
  });

  it("returns unavailable and cleans up when the expected binary is missing after extraction", async () => {
    const installRoot = temporaryDirectory();
    const fetchImpl = fakeSuccessfulDownloadFetch();
    const extractImpl = vi.fn(async () => {
      // Extracts nothing useful — the expected binaryPathInPackage never appears.
    });

    const result = await ensureProviderCliRuntimeInstalled({
      provider: "codex",
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveTargetImpl: fakeResolveTarget,
      fetchImpl,
      extractImpl,
    });

    expect(result.status).toBe("unavailable");
    expect(result.error).toMatch(/Expected vendor\/test-triple\/bin\/codex/);
    expect(FS.existsSync(Path.join(installRoot, "codex-runtime", FAKE_TARGET.version))).toBe(false);
  });

  it("returns unavailable on extraction failure and cleans up the staging dir", async () => {
    const installRoot = temporaryDirectory();
    const fetchImpl = fakeSuccessfulDownloadFetch();
    const extractImpl = vi.fn().mockRejectedValue(new Error("tar failed"));

    const result = await ensureProviderCliRuntimeInstalled({
      provider: "codex",
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveTargetImpl: fakeResolveTarget,
      fetchImpl,
      extractImpl,
    });

    expect(result.status).toBe("unavailable");
    expect(result.error).toMatch(/tar failed/);
    expect(FS.existsSync(Path.join(installRoot, "codex-runtime", FAKE_TARGET.version))).toBe(false);
    expect(
      FS.existsSync(
        Path.join(installRoot, "codex-runtime", `${FAKE_TARGET.version}.staging-${process.pid}`),
      ),
    ).toBe(false);
  });

  it("prunes stale version directories once a new version is installed", async () => {
    const installRoot = temporaryDirectory();
    const staleDir = Path.join(installRoot, "codex-runtime", "stale-version");
    FS.mkdirSync(Path.join(staleDir, "bin"), { recursive: true });
    FS.writeFileSync(Path.join(staleDir, "bin", "codex"), "stale binary");

    const fetchImpl = fakeSuccessfulDownloadFetch();
    const extractImpl = vi.fn(async (input: { destinationDir: string }) => {
      FS.mkdirSync(Path.join(input.destinationDir, "vendor", "test-triple", "bin"), {
        recursive: true,
      });
      FS.writeFileSync(
        Path.join(input.destinationDir, "vendor", "test-triple", "bin", "codex"),
        "codex binary",
      );
    });

    await ensureProviderCliRuntimeInstalled({
      provider: "codex",
      installRoot,
      platform: "darwin",
      arch: "arm64",
      resolveTargetImpl: fakeResolveTarget,
      fetchImpl,
      extractImpl,
    });

    expect(FS.existsSync(staleDir)).toBe(false);
  });
});
