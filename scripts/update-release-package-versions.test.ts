import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  releasePackageFiles,
  updateReleasePackageVersions,
} from "./update-release-package-versions";

function withPackageFixture(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "modesto-package-versions-"));
  try {
    for (const relativePath of releasePackageFiles) {
      const filePath = resolve(root, relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, `${JSON.stringify({ name: relativePath, version: "0.1.7" })}\n`);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("update release package versions", () => {
  it("stores four-part releases as updater-safe SemVer with a public display version", () => {
    withPackageFixture((root) => {
      expect(updateReleasePackageVersions("0.1.7.1", { rootDir: root })).toEqual({
        changed: true,
      });
      for (const relativePath of releasePackageFiles) {
        const pkg = JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as {
          version: string;
          modestoReleaseVersion?: string;
        };
        expect(pkg.version).toBe("0.1.8-patch.1");
        expect(pkg.modestoReleaseVersion).toBe("0.1.7.1");
      }
      expect(updateReleasePackageVersions("0.1.7.1", { rootDir: root })).toEqual({
        changed: false,
      });
    });
  });

  it("removes the public override when returning to a normal SemVer release", () => {
    withPackageFixture((root) => {
      updateReleasePackageVersions("0.1.7.1", { rootDir: root });
      updateReleasePackageVersions("0.1.8", { rootDir: root });
      for (const relativePath of releasePackageFiles) {
        const pkg = JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as {
          version: string;
          modestoReleaseVersion?: string;
        };
        expect(pkg.version).toBe("0.1.8");
        expect(pkg.modestoReleaseVersion).toBeUndefined();
      }
    });
  });
});
