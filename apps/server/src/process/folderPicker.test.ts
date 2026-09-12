import { describe, expect, it } from "vite-plus/test";

import {
  folderPickerCommand,
  parseFolderPickerResult,
  sanitizeFolderPickerInitialPath,
} from "./folderPicker.ts";

describe("folderPickerCommand", () => {
  it("opens Finder through osascript and passes the initial path as argv", () => {
    const command = folderPickerCommand("darwin", "/Users/ada/Code");

    expect(command).toEqual({
      command: "/usr/bin/osascript",
      args: ["-", "/Users/ada/Code"],
      stdin: expect.stringContaining("choose folder"),
    });
    expect(command?.stdin).not.toContain("/Users/ada/Code");
  });

  it("uses zenity on Linux and PowerShell on Windows", () => {
    expect(folderPickerCommand("linux", "/home/ada/src")?.command).toBe("zenity");
    expect(folderPickerCommand("win32")?.command).toBe("powershell.exe");
    expect(folderPickerCommand("freebsd")).toBeNull();
  });
});

describe("sanitizeFolderPickerInitialPath", () => {
  it("keeps absolute paths and drops anything that could be interpolated", () => {
    expect(sanitizeFolderPickerInitialPath("/Users/ada")).toBe("/Users/ada");
    expect(sanitizeFolderPickerInitialPath("C:\\Users\\ada")).toBe("C:\\Users\\ada");
    expect(sanitizeFolderPickerInitialPath("relative/path")).toBeUndefined();
    expect(sanitizeFolderPickerInitialPath("/tmp/evil\n-e")).toBeUndefined();
  });
});

describe("parseFolderPickerResult", () => {
  it("returns the selected folder and treats a cancel as empty", () => {
    expect(
      parseFolderPickerResult("darwin", {
        code: 0,
        stdout: "/Users/ada/Code/\n",
        stderr: "",
      }),
    ).toEqual({ kind: "path", path: "/Users/ada/Code" });
    expect(
      parseFolderPickerResult("darwin", {
        code: 1,
        stdout: "",
        stderr: "execution error: User canceled. (-128)",
      }),
    ).toEqual({ kind: "cancelled" });
    expect(
      parseFolderPickerResult("linux", {
        code: 1,
        stdout: "",
        stderr: "",
      }),
    ).toEqual({ kind: "cancelled" });
  });
});
