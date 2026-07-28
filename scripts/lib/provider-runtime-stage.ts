// FILE: provider-runtime-stage.ts
// Purpose: Stage the Electron-backed Node shim used by bundled provider CLIs.
// Layer: Release/build helper

import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function writeNodeShim(platform: "linux" | "mac" | "win", binDir: string): Promise<void> {
  if (platform === "win") {
    await writeFile(
      join(binDir, "node.cmd"),
      '@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"%~dp0..\\..\\..\\Modesto.exe" %*\r\n',
    );
    return;
  }

  const executable =
    platform === "mac" ? '"$SCRIPT_DIR/../../../MacOS/Modesto"' : '"$SCRIPT_DIR/../../../modesto"';
  const shimPath = join(binDir, "node");
  await writeFile(
    shimPath,
    `#!/bin/sh\nSCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nELECTRON_RUN_AS_NODE=1 exec ${executable} "$@"\n`,
  );
  await chmod(shimPath, 0o755);
}

export async function stageProviderRuntimes(input: {
  readonly arch: "arm64" | "universal" | "x64";
  readonly outputDir: string;
  readonly platform: "linux" | "mac" | "win";
}): Promise<void> {
  await rm(input.outputDir, { recursive: true, force: true });
  const binDir = join(input.outputDir, "bin");
  await mkdir(binDir, { recursive: true });
  await writeNodeShim(input.platform, binDir);

  await writeFile(
    join(input.outputDir, "manifest.json"),
    `${JSON.stringify(
      {
        platform: input.platform,
        arch: input.arch,
        staged: ["node-runtime-shim"],
      },
      null,
      2,
    )}\n`,
  );
}
