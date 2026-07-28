import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ensureBundledProviderClisInstalled } from "./providerCliBootstrap";

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
});

describe("ensureBundledProviderClisInstalled", () => {
  it("installs launchers once and reuses a matching manifest", () => {
    const root = temporaryDirectory();
    const source = Path.join(root, "codex.js");
    FS.writeFileSync(source, "console.log('codex')\n");
    const input = {
      bundleKey: "0.5.2:bundle-a",
      clis: [{ name: "codex", sourcePath: source, kind: "node-launcher" as const }],
      electronExecutable: "/Applications/Modesto.app/Contents/MacOS/Modesto",
      installRoot: Path.join(root, "installed"),
      platform: "darwin" as const,
      sourceRoot: "/Applications/Modesto.app",
      nowIso: "2026-07-15T12:00:00.000Z",
    };

    const first = ensureBundledProviderClisInstalled(input);
    const second = ensureBundledProviderClisInstalled(input);

    expect(first.installed).toBe(true);
    expect(second.installed).toBe(false);
    expect(FS.readFileSync(Path.join(first.binDir, "codex"), "utf8")).toContain(
      "ELECTRON_RUN_AS_NODE=1",
    );
  });

  it("refreshes launchers when the bundled release changes", () => {
    const root = temporaryDirectory();
    const source = Path.join(root, "native-review");
    FS.writeFileSync(source, "binary");
    const installRoot = Path.join(root, "installed");
    const base = {
      clis: [
        { name: "native-review", sourcePath: source, kind: "native" as const },
        { name: "native-review-alias", sourcePath: source, kind: "native" as const },
      ],
      electronExecutable: "/Applications/Modesto.app/Contents/MacOS/Modesto",
      installRoot,
      platform: "darwin" as const,
      sourceRoot: "/Applications/Modesto.app",
    };

    expect(ensureBundledProviderClisInstalled({ ...base, bundleKey: "bundle-a" }).installed).toBe(
      true,
    );
    expect(ensureBundledProviderClisInstalled({ ...base, bundleKey: "bundle-b" }).installed).toBe(
      true,
    );
    expect(FS.readFileSync(Path.join(installRoot, "bin", "native-review"), "utf8")).toContain(
      source,
    );
    expect(FS.readFileSync(Path.join(installRoot, "bin", "native-review-alias"), "utf8")).toContain(
      source,
    );
  });

  it("installs the packaged Modesto CLI entry with the desktop Node runtime", () => {
    const root = temporaryDirectory();
    const sourceRoot = Path.join(root, "Modesto.app", "Contents", "Resources", "app.asar");
    const source = Path.join(sourceRoot, "apps", "server", "dist", "index.mjs");
    FS.mkdirSync(Path.dirname(source), { recursive: true });
    FS.writeFileSync(source, "console.log('modesto')\n");

    const result = ensureBundledProviderClisInstalled({
      bundleKey: "0.5.2:modesto-cli",
      clis: [{ name: "modesto", sourcePath: source, kind: "node-launcher" }],
      electronExecutable: "/Applications/Modesto.app/Contents/MacOS/Modesto",
      installRoot: Path.join(root, "installed"),
      platform: "darwin",
      sourceRoot,
      nowIso: "2026-07-23T12:00:00.000Z",
    });

    const launcher = FS.readFileSync(Path.join(result.binDir, "modesto"), "utf8");
    expect(launcher).toContain("ELECTRON_RUN_AS_NODE=1");
    expect(launcher).toContain(source);
    expect(FS.statSync(Path.join(result.binDir, "modesto")).mode & 0o111).not.toBe(0);
  });
});
