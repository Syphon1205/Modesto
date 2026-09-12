import type { ListeningServiceId } from "@modesto/contracts";
import * as NodeFs from "node:fs";
import * as NodeOs from "node:os";
import * as NodePath from "node:path";

export interface ListeningLibraryAppSpec {
  readonly id: ListeningServiceId;
  readonly label: string;
  readonly appleScriptName: string | null;
  readonly nativeLibrary: boolean;
  readonly darwinBundleNames: readonly string[];
  readonly winPathSegments: readonly (readonly string[])[];
  readonly linuxCommands: readonly string[];
}

export const LISTENING_LIBRARY_APPS: readonly ListeningLibraryAppSpec[] = [
  {
    id: "apple-music",
    label: "Apple Music",
    appleScriptName: "Music",
    nativeLibrary: true,
    darwinBundleNames: ["Music.app", "iTunes.app"],
    winPathSegments: [
      ["Apple Music", "Apple Music.exe"],
      ["Microsoft", "WindowsApps", "AppleMusic.exe"],
    ],
    linuxCommands: [],
  },
  {
    id: "spotify",
    label: "Spotify",
    appleScriptName: "Spotify",
    nativeLibrary: false,
    darwinBundleNames: ["Spotify.app"],
    winPathSegments: [["Spotify", "Spotify.exe"]],
    linuxCommands: ["spotify"],
  },
  {
    id: "youtube-music",
    label: "YouTube Music",
    appleScriptName: null,
    nativeLibrary: false,
    darwinBundleNames: ["YouTube Music.app"],
    winPathSegments: [["YouTube Music", "YouTube Music.exe"]],
    linuxCommands: ["youtube-music"],
  },
  {
    id: "tidal",
    label: "TIDAL",
    appleScriptName: null,
    nativeLibrary: false,
    darwinBundleNames: ["TIDAL.app"],
    winPathSegments: [["TIDAL", "TIDAL.exe"]],
    linuxCommands: ["tidal"],
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    appleScriptName: null,
    nativeLibrary: false,
    darwinBundleNames: ["SoundCloud.app"],
    winPathSegments: [["SoundCloud", "SoundCloud.exe"]],
    linuxCommands: ["soundcloud"],
  },
  {
    id: "amazon-music",
    label: "Amazon Music",
    appleScriptName: null,
    nativeLibrary: false,
    darwinBundleNames: ["Amazon Music.app"],
    winPathSegments: [["Amazon Music", "Amazon Music.exe"]],
    linuxCommands: ["amazon-music"],
  },
];

export function listeningLibraryAppById(id: ListeningServiceId): ListeningLibraryAppSpec | null {
  return LISTENING_LIBRARY_APPS.find((app) => app.id === id) ?? null;
}

export function supportsNativeListeningLibrary(
  id: ListeningServiceId,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === "darwin" && listeningLibraryAppById(id)?.nativeLibrary === true;
}

export interface DetectListeningLibrariesInput {
  readonly platform: NodeJS.Platform;
  readonly homeDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly pathExists: (path: string) => boolean;
}

function windowsRoots(homeDir: string, env: NodeJS.ProcessEnv): string[] {
  const localAppData = env.LOCALAPPDATA ?? NodePath.join(homeDir, "AppData", "Local");
  const appData = env.APPDATA ?? NodePath.join(homeDir, "AppData", "Roaming");
  const programFiles = env.ProgramFiles ?? env.PROGRAMFILES ?? "C:\\Program Files";
  const programFilesX86 =
    env["ProgramFiles(x86)"] ?? env.PROGRAMFILES_X86 ?? "C:\\Program Files (x86)";
  return [
    localAppData,
    NodePath.join(localAppData, "Programs"),
    appData,
    programFiles,
    programFilesX86,
  ];
}

export function candidateAppPaths(
  input: DetectListeningLibrariesInput,
  app: ListeningLibraryAppSpec,
): string[] {
  if (input.platform === "darwin") {
    const dirs = [
      "/Applications",
      "/System/Applications",
      NodePath.join(input.homeDir, "Applications"),
    ];
    return dirs.flatMap((dir) => app.darwinBundleNames.map((name) => NodePath.join(dir, name)));
  }
  if (input.platform === "win32") {
    return windowsRoots(input.homeDir, input.env).flatMap((root) =>
      app.winPathSegments.map((segments) => NodePath.join(root, ...segments)),
    );
  }
  return app.linuxCommands.flatMap((command) => [
    NodePath.join("/usr/bin", command),
    NodePath.join("/usr/local/bin", command),
    NodePath.join("/snap/bin", command),
    NodePath.join(input.homeDir, ".local", "bin", command),
  ]);
}

export function detectListeningLibraries(input: DetectListeningLibrariesInput): Array<{
  id: ListeningServiceId;
  installed: boolean;
  appPath: string | null;
}> {
  return LISTENING_LIBRARY_APPS.map((app) => {
    const paths = candidateAppPaths(input, app);
    const appPath = paths.find((path) => input.pathExists(path)) ?? null;
    return { id: app.id, installed: appPath !== null, appPath };
  });
}

export function detectListeningLibrariesOnThisMachine(): Array<{
  id: ListeningServiceId;
  installed: boolean;
  appPath: string | null;
}> {
  return detectListeningLibraries({
    platform: process.platform,
    homeDir: NodeOs.homedir(),
    env: process.env,
    pathExists: (path) => NodeFs.existsSync(path),
  });
}
