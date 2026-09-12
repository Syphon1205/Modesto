// FILE: whisperBinary.ts
// Purpose: Finds the whisper.cpp executable Modesto Voice transcribes with.
// Layer: Server utility
// Exports: whisperBinaryCandidates, whisperInstallHint, resolveWhisperBinary
// Depends on: effect/FileSystem for the existence checks, PATH for discovery.
//
// There are three places the engine can come from and they are tried in that
// order: a path the user set, a build Modesto installed itself, then whatever
// is on PATH. The last one matters more than it looks - upstream whisper.cpp
// publishes release binaries for Windows and Linux but *not* for macOS, where
// the supported route is `brew install whisper-cpp`. Discovery is what makes
// the common mac setup work without Modesto shipping a compiler.
//
// Names differ by packager: Homebrew installs `whisper-cli` and `whisper-cpp`,
// upstream release archives contain `whisper-cli`, and older builds called it
// `main`. `main` is deliberately excluded - it is far too generic to guess at
// on a user's PATH, and matching it could execute something unrelated.

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { HostProcessPlatform } from "@modesto/shared/hostProcess";

/** Executable names to look for on PATH, most specific first. */
export const whisperBinaryCandidates = (platform: NodeJS.Platform): ReadonlyArray<string> =>
  platform === "win32" ? ["whisper-cli.exe", "whisper-cpp.exe"] : ["whisper-cli", "whisper-cpp"];

/** Where a Modesto-installed engine lives, relative to the server's data dir. */
export function managedWhisperBinaryPath(
  path: Path.Path,
  baseDir: string,
  platform: NodeJS.Platform,
): string {
  return path.join(
    baseDir,
    "voice",
    "bin",
    platform === "win32" ? "whisper-cli.exe" : "whisper-cli",
  );
}

/**
 * What to tell a user whose engine is missing.
 *
 * Platform-specific because the answers genuinely differ, and a generic
 * "install whisper.cpp" sends a mac user to a source build they do not need.
 */
export function whisperInstallHint(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "Install the speech engine with `brew install whisper-cpp`, then reopen this panel.";
    case "linux":
      return "Install whisper.cpp (`whisper-cli`) with your package manager, or build it from https://github.com/ggml-org/whisper.cpp and put it on PATH.";
    case "win32":
      return "Download `whisper-bin-x64.zip` from https://github.com/ggml-org/whisper.cpp/releases, then point Settings at the extracted `whisper-cli.exe`.";
    default:
      return "Build whisper.cpp from https://github.com/ggml-org/whisper.cpp and put `whisper-cli` on PATH.";
  }
}

/** Splits PATH into directories, dropping the empty entries a trailing `:` leaves. */
export function pathDirectories(
  pathVar: string | undefined,
  platform: NodeJS.Platform,
): ReadonlyArray<string> {
  if (!pathVar) return [];
  return pathVar
    .split(platform === "win32" ? ";" : ":")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export interface ResolvedWhisperBinary {
  readonly path: string;
  readonly source: "configured" | "managed" | "path";
}

/**
 * Walks the ladder and returns the first executable that exists.
 *
 * A configured path that does not exist returns `null` rather than silently
 * falling through to PATH: the user named a specific binary, and quietly
 * running a different one would make a wrong setting impossible to notice.
 */
export const resolveWhisperBinary = Effect.fn("voice.whisper_binary.resolve")(function* (input: {
  readonly baseDir: string;
  readonly configuredPath?: string | undefined;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const platform = yield* HostProcessPlatform;

  const exists = (candidate: string) =>
    fs.exists(candidate).pipe(Effect.orElseSucceed(() => false));

  const configured = input.configuredPath?.trim() ?? "";
  if (configured.length > 0) {
    return (yield* exists(configured))
      ? ({ path: configured, source: "configured" } satisfies ResolvedWhisperBinary)
      : null;
  }

  const managed = managedWhisperBinaryPath(path, input.baseDir, platform);
  if (yield* exists(managed)) {
    return { path: managed, source: "managed" } satisfies ResolvedWhisperBinary;
  }

  const directories = pathDirectories(process.env["PATH"], platform);
  for (const directory of directories) {
    for (const name of whisperBinaryCandidates(platform)) {
      const candidate = path.join(directory, name);
      if (yield* exists(candidate)) {
        return { path: candidate, source: "path" } satisfies ResolvedWhisperBinary;
      }
    }
  }

  return null;
});
