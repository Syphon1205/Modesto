import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import {
  findExecutableOnPath,
  providerRuntimeMissingMessage,
  resolveProviderRuntimeExecutable,
} from "./providerRuntimeDiscovery";

function executable(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "#!/bin/sh\nexit 0\n");
  chmodSync(path, 0o755);
}

describe("providerRuntimeDiscovery", () => {
  it("resolves a provider binary from PATH", () => {
    const root = mkdtempSync(join(tmpdir(), "modesto-provider-path-"));
    const binary = join(root, "codex");
    executable(binary);
    expect(
      findExecutableOnPath({ binaryName: "codex", env: { PATH: root }, platform: "darwin" }),
    ).toBe(binary);
  });

  it("uses an executable embedded in an installed desktop app", () => {
    const root = mkdtempSync(join(tmpdir(), "modesto-provider-app-"));
    const appRoot = join(root, "Cursor.app");
    const runtime = join(appRoot, "Contents", "Resources", "app", "bin", "cursor-agent");
    executable(runtime);
    expect(
      resolveProviderRuntimeExecutable({
        provider: "cursor",
        defaultBinary: "cursor-agent",
        platform: "darwin",
        env: { PATH: "" },
        appRoots: [appRoot],
        appRuntimeCandidates: [runtime],
      }),
    ).toMatchObject({ executable: runtime, source: "desktop-app", desktopAppDetected: true });
  });

  it("reports desktop app presence when its runtime is unavailable", () => {
    const root = mkdtempSync(join(tmpdir(), "modesto-provider-app-only-"));
    const appRoot = join(root, "Claude.app");
    mkdirSync(appRoot);
    const resolution = resolveProviderRuntimeExecutable({
      provider: "claudeAgent",
      defaultBinary: "claude",
      platform: "darwin",
      env: { PATH: "" },
      appRoots: [appRoot],
      appRuntimeCandidates: [],
    });
    expect(resolution.desktopAppDetected).toBe(true);
    expect(providerRuntimeMissingMessage(resolution, "Claude Agent CLI (`claude`)")).toContain(
      "Claude is installed",
    );
  });
});
