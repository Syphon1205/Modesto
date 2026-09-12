import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { FilesystemBrowseError, FilesystemPickFolderError } from "./filesystem.ts";

describe("FilesystemBrowseError", () => {
  it("derives a stable message from browse context while retaining the cause", () => {
    const cause = new Error("sensitive filesystem detail");
    const error = new FilesystemBrowseError({
      cwd: "/workspace",
      partialPath: "./src/mai",
      failure: "read_directory_failed",
      parentPath: "/workspace/src",
      cause,
    });

    expect(error.message).toBe("Failed to browse filesystem path './src/mai' from '/workspace'.");
    expect(error.message).not.toContain(cause.message);
    expect(error.cause).toBe(cause);
  });

  it("decodes legacy message-only errors during rolling upgrades", () => {
    const decodeError = Schema.decodeUnknownSync(FilesystemBrowseError);
    const error = decodeError({
      _tag: "FilesystemBrowseError",
      message: "Legacy filesystem browse failure.",
    });

    expect(error.message).toBe("Legacy filesystem browse failure.");
    expect(error.partialPath).toBeUndefined();
    expect(error.failure).toBeUndefined();
  });
});

describe("FilesystemPickFolderError", () => {
  it("names an unsupported host without leaking the spawn cause", () => {
    const cause = new Error("osascript: execution error");
    const error = new FilesystemPickFolderError({
      failure: "unsupported_platform",
      platform: "freebsd",
      cause,
    });

    expect(error.message).toBe("This environment cannot open a native folder picker.");
    expect(error.message).not.toContain(cause.message);
    expect(error.cause).toBe(cause);
  });

  it("decodes legacy message-only errors during rolling upgrades", () => {
    const decodeError = Schema.decodeUnknownSync(FilesystemPickFolderError);
    const error = decodeError({
      _tag: "FilesystemPickFolderError",
      message: "Legacy folder picker failure.",
    });

    expect(error.message).toBe("Legacy folder picker failure.");
    expect(error.failure).toBeUndefined();
  });
});
