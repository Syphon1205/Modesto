import FS from "node:fs";
import OS from "node:os";
import Path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { stageProviderRuntimes } from "./provider-runtime-stage.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    FS.rmSync(root, { recursive: true, force: true });
  }
});

describe("stageProviderRuntimes", () => {
  it.each(["mac", "linux"] as const)(
    "stages only the Node runtime shim on %s",
    async (platform) => {
      const outputDir = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-provider-runtime-"));
      roots.push(outputDir);

      await stageProviderRuntimes({ platform, arch: "arm64", outputDir });

      expect(FS.existsSync(Path.join(outputDir, "bin", "node"))).toBe(true);
      expect(JSON.parse(FS.readFileSync(Path.join(outputDir, "manifest.json"), "utf8"))).toEqual({
        platform,
        arch: "arm64",
        staged: ["node-runtime-shim"],
      });
      expect(FS.readdirSync(Path.join(outputDir, "bin"))).toEqual(["node"]);
    },
  );

  it("stages the Windows Node command shim without third-party review binaries", async () => {
    const outputDir = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-provider-runtime-"));
    roots.push(outputDir);

    await stageProviderRuntimes({ platform: "win", arch: "x64", outputDir });

    expect(FS.readdirSync(Path.join(outputDir, "bin"))).toEqual(["node.cmd"]);
  });
});
