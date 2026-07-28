// FILE: providerCliBootstrap.ts
// Purpose: Atomically installs bundled provider CLI launchers into Modesto's managed home once.
// Layer: Desktop startup utility

import * as FS from "node:fs";
import * as Path from "node:path";

const MANIFEST_SCHEMA_VERSION = 1;

export interface BundledProviderCli {
  readonly name: string;
  readonly sourcePath: string;
  readonly kind: "node-launcher" | "native";
}

interface ProviderCliInstallManifest {
  readonly schemaVersion: number;
  readonly bundleKey: string;
  readonly sourceRoot: string;
  readonly installedAt: string;
  readonly commands: ReadonlyArray<string>;
}

export interface ProviderCliBootstrapResult {
  readonly binDir: string;
  readonly commands: ReadonlyArray<string>;
  readonly installed: boolean;
}

function commandFileName(name: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? `${name}.cmd` : name;
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function quoteCmd(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function launcherContents(input: {
  readonly cli: BundledProviderCli;
  readonly electronExecutable: string;
  readonly platform: NodeJS.Platform;
}): string {
  if (input.platform === "win32") {
    if (input.cli.kind === "native") {
      return `@echo off\r\n${quoteCmd(input.cli.sourcePath)} %*\r\n`;
    }
    return [
      "@echo off",
      "set ELECTRON_RUN_AS_NODE=1",
      `${quoteCmd(input.electronExecutable)} ${quoteCmd(input.cli.sourcePath)} %*`,
      "",
    ].join("\r\n");
  }

  if (input.cli.kind === "native") {
    return `#!/bin/sh\nexec ${quoteShell(input.cli.sourcePath)} "$@"\n`;
  }
  return `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quoteShell(input.electronExecutable)} ${quoteShell(input.cli.sourcePath)} "$@"\n`;
}

function readValidManifest(
  manifestPath: string,
  input: { bundleKey: string; sourceRoot: string; binDir: string; platform: NodeJS.Platform },
): ProviderCliInstallManifest | null {
  try {
    const value = JSON.parse(
      FS.readFileSync(manifestPath, "utf8"),
    ) as Partial<ProviderCliInstallManifest>;
    if (
      value.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
      value.bundleKey !== input.bundleKey ||
      value.sourceRoot !== input.sourceRoot ||
      !Array.isArray(value.commands) ||
      !value.commands.every(
        (command) =>
          typeof command === "string" &&
          FS.existsSync(Path.join(input.binDir, commandFileName(command, input.platform))),
      )
    ) {
      return null;
    }
    return value as ProviderCliInstallManifest;
  } catch {
    return null;
  }
}

export function ensureBundledProviderClisInstalled(input: {
  readonly bundleKey: string;
  readonly clis: ReadonlyArray<BundledProviderCli>;
  readonly electronExecutable: string;
  readonly installRoot: string;
  readonly platform?: NodeJS.Platform;
  readonly sourceRoot: string;
  readonly nowIso?: string;
}): ProviderCliBootstrapResult {
  const platform = input.platform ?? process.platform;
  const binDir = Path.join(input.installRoot, "bin");
  const manifestPath = Path.join(input.installRoot, "manifest.json");
  const existing = readValidManifest(manifestPath, {
    bundleKey: input.bundleKey,
    sourceRoot: input.sourceRoot,
    binDir,
    platform,
  });
  if (existing) {
    return { binDir, commands: existing.commands, installed: false };
  }

  const missing = input.clis.filter((cli) => !FS.existsSync(cli.sourcePath));
  if (missing.length > 0) {
    throw new Error(
      `Bundled provider CLI sources are missing: ${missing.map((cli) => cli.name).join(", ")}`,
    );
  }

  const stagingRoot = `${input.installRoot}.staging-${process.pid}`;
  const stagingBinDir = Path.join(stagingRoot, "bin");
  FS.rmSync(stagingRoot, { recursive: true, force: true });
  FS.mkdirSync(stagingBinDir, { recursive: true });
  try {
    for (const cli of input.clis) {
      const destination = Path.join(stagingBinDir, commandFileName(cli.name, platform));
      FS.writeFileSync(
        destination,
        launcherContents({ cli, electronExecutable: input.electronExecutable, platform }),
        "utf8",
      );
      if (platform !== "win32") FS.chmodSync(destination, 0o755);
    }
    const manifest: ProviderCliInstallManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      bundleKey: input.bundleKey,
      sourceRoot: input.sourceRoot,
      installedAt: input.nowIso ?? new Date().toISOString(),
      commands: input.clis.map((cli) => cli.name),
    };
    FS.writeFileSync(
      Path.join(stagingRoot, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    FS.rmSync(input.installRoot, { recursive: true, force: true });
    FS.renameSync(stagingRoot, input.installRoot);
    return { binDir, commands: manifest.commands, installed: true };
  } catch (error) {
    FS.rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}
