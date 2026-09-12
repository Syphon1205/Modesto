// FILE: folderPicker.ts
// Purpose: Open the host's native folder picker from the local server so the
//          browser client can choose a project the same way the desktop app
//          does (Finder on macOS, Explorer on Windows, the desktop portal on
//          Linux).
// Layer: Server process

import { FilesystemPickFolderError, type FilesystemPickFolderInput } from "@modesto/contracts";
import { HostProcessPlatform } from "@modesto/shared/hostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { runProcess, type ProcessRunResult } from "../device/runProcess.ts";

const PICK_FOLDER_TIMEOUT_MS = 15 * 60 * 1000;
const PICK_FOLDER_PROMPT = "Choose a project folder";
const INITIAL_PATH_ENV = "MODESTO_PICK_FOLDER_INITIAL";

const MAC_PICK_FOLDER_SCRIPT = `
on run argv
  try
    if (count of argv) > 0 then
      return POSIX path of (choose folder with prompt ${appleScriptString(
        PICK_FOLDER_PROMPT,
      )} default location POSIX file (item 1 of argv))
    end if
    return POSIX path of (choose folder with prompt ${appleScriptString(PICK_FOLDER_PROMPT)})
  on error number -128
    return ""
  end try
end run
`;

const WINDOWS_PICK_FOLDER_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = ${powershellString(PICK_FOLDER_PROMPT)}
$dialog.ShowNewFolderButton = $true
$initial = [Environment]::GetEnvironmentVariable(${powershellString(INITIAL_PATH_ENV)})
if (-not [string]::IsNullOrWhiteSpace($initial)) {
  $dialog.SelectedPath = $initial
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.SelectedPath)
}
`;

export interface FolderPickerCommand {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly stdin?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export function sanitizeFolderPickerInitialPath(
  initialPath: string | null | undefined,
): string | undefined {
  if (initialPath === null || initialPath === undefined) {
    return undefined;
  }
  const trimmed = initialPath.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (/[\0\r\n]/.test(trimmed)) {
    return undefined;
  }
  if (trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

export function folderPickerCommand(
  platform: NodeJS.Platform,
  initialPath?: string | null,
): FolderPickerCommand | null {
  const safeInitialPath = sanitizeFolderPickerInitialPath(initialPath);
  switch (platform) {
    case "darwin":
      return {
        command: "/usr/bin/osascript",
        args: safeInitialPath === undefined ? ["-"] : ["-", safeInitialPath],
        stdin: MAC_PICK_FOLDER_SCRIPT,
      };
    case "linux":
      return {
        command: "zenity",
        args:
          safeInitialPath === undefined
            ? ["--file-selection", "--directory", `--title=${PICK_FOLDER_PROMPT}`]
            : [
                "--file-selection",
                "--directory",
                `--title=${PICK_FOLDER_PROMPT}`,
                `--filename=${safeInitialPath}`,
              ],
      };
    case "win32":
      return {
        command: "powershell.exe",
        args: ["-NoProfile", "-STA", "-NonInteractive", "-Command", WINDOWS_PICK_FOLDER_SCRIPT],
        ...(safeInitialPath === undefined
          ? {}
          : { env: { ...process.env, [INITIAL_PATH_ENV]: safeInitialPath } }),
      };
    default:
      return null;
  }
}

export function parseFolderPickerResult(
  platform: NodeJS.Platform,
  result: Pick<ProcessRunResult, "code" | "stdout" | "stderr">,
):
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "cancelled" }
  | {
      readonly kind: "failed";
      readonly message: string;
    } {
  const selectedPath = stripFolderPickerPath(result.stdout);
  if (selectedPath !== null) {
    return { kind: "path", path: selectedPath };
  }
  if (isFolderPickerCancel(platform, result)) {
    return { kind: "cancelled" };
  }
  const detail = result.stderr.trim() || result.stdout.trim();
  return {
    kind: "failed",
    message: detail.length > 0 ? detail : "The native folder picker closed without a folder.",
  };
}

function stripFolderPickerPath(stdout: string): string | null {
  const selectedPath = stdout.trim().replace(/[\\/]+$/u, "");
  return selectedPath.length > 0 ? selectedPath : null;
}

function isFolderPickerCancel(
  platform: NodeJS.Platform,
  result: Pick<ProcessRunResult, "code" | "stderr">,
): boolean {
  if (result.code === 0) {
    return true;
  }
  const stderr = result.stderr.toLowerCase();
  if (stderr.includes("user canceled") || stderr.includes("user cancelled")) {
    return true;
  }
  return platform === "linux" && result.code === 1;
}

function appleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function powershellString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export class FolderPicker extends Context.Service<
  FolderPicker,
  {
    readonly pickFolder: (
      input: FilesystemPickFolderInput,
    ) => Effect.Effect<string | null, FilesystemPickFolderError>;
  }
>()("t3/process/folderPicker") {}

const pickFolder = Effect.fn("folderPicker.pickFolder")(function* (
  input: FilesystemPickFolderInput,
) {
  const platform = yield* HostProcessPlatform;
  const command = folderPickerCommand(platform, input.initialPath);
  if (command === null) {
    return yield* new FilesystemPickFolderError({
      initialPath: input.initialPath,
      failure: "unsupported_platform",
      platform,
    });
  }

  const result = yield* Effect.tryPromise({
    try: () =>
      runProcess(command.command, command.args, {
        timeoutMs: PICK_FOLDER_TIMEOUT_MS,
        allowNonZeroExit: true,
        ...(command.stdin === undefined ? {} : { stdin: command.stdin }),
        ...(command.env === undefined ? {} : { env: command.env }),
      }),
    catch: (cause) =>
      new FilesystemPickFolderError({
        initialPath: input.initialPath,
        failure: "dialog_failed",
        platform,
        cause,
      }),
  });

  const parsed = parseFolderPickerResult(platform, result);
  if (parsed.kind === "path") {
    return parsed.path;
  }
  if (parsed.kind === "cancelled") {
    return null;
  }
  return yield* new FilesystemPickFolderError({
    initialPath: input.initialPath,
    failure: "dialog_failed",
    platform,
    cause: new Error(parsed.message),
  });
});

export const layer = Layer.succeed(FolderPicker, FolderPicker.of({ pickFolder }));
