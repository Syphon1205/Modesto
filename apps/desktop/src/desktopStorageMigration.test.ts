import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { describe, expect, it } from "vitest";

import {
  acknowledgeModestoStorageSnapshot,
  readModestoStorageSnapshot,
  saveModestoStorageSnapshot,
  MODESTO_STORAGE_SNAPSHOT_MAX_BYTES,
  validateModestoStorageSnapshot,
} from "./desktopStorageMigration";

const snapshot = (exportedAt = "2026-07-09T00:00:00.000Z") => ({
  version: 1 as const,
  exportedAt,
  entries: {
    "modesto:theme": "dark",
    "modesto.openUsage.enabled": "true",
  },
});

describe("desktopStorageMigration", () => {
  it("round-trips atomically and acknowledges the snapshot", async () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      await expect(saveModestoStorageSnapshot(target, snapshot())).resolves.toBe(true);
      expect(readModestoStorageSnapshot(target)).toEqual(snapshot());
      expect(FS.readdirSync(directory)).toEqual(["snapshot.json"]);

      await acknowledgeModestoStorageSnapshot(target);
      expect(readModestoStorageSnapshot(target)).toBeNull();
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed, disallowed, and oversized snapshots", () => {
    expect(validateModestoStorageSnapshot({ version: 1 })).toBeNull();
    expect(
      validateModestoStorageSnapshot({
        ...snapshot(),
        entries: { "foreign:theme": "dark" },
      }),
    ).toBeNull();
    expect(
      validateModestoStorageSnapshot({
        ...snapshot(),
        entries: { "modesto:large": "x".repeat(MODESTO_STORAGE_SNAPSHOT_MAX_BYTES) },
      }),
    ).toBeNull();
  });

  it("accepts renderer snapshots containing large composer drafts", () => {
    const largeDraft = "x".repeat(2 * 1024 * 1024);

    expect(
      validateModestoStorageSnapshot({
        ...snapshot(),
        entries: { "modesto:composer-drafts:v1": largeDraft },
      })?.entries["modesto:composer-drafts:v1"],
    ).toBe(largeDraft);
  });

  it("does not replace a newer snapshot with an older export", async () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      await saveModestoStorageSnapshot(target, snapshot("2026-07-09T01:00:00.000Z"));
      await expect(
        saveModestoStorageSnapshot(target, snapshot("2026-07-09T00:00:00.000Z")),
      ).resolves.toBe(false);
      expect(readModestoStorageSnapshot(target)?.exportedAt).toBe("2026-07-09T01:00:00.000Z");
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("treats missing and malformed files as absent", () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "modesto-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      expect(readModestoStorageSnapshot(target)).toBeNull();
      FS.writeFileSync(target, "not json");
      expect(readModestoStorageSnapshot(target)).toBeNull();
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });
});
