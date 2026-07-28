// FILE: providerRuntimeDiscovery.ts
// Purpose: Resolve provider runtimes from configured paths, PATH, and installed desktop apps.

import { constants, existsSync, accessSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve, sep } from "node:path";
import { homedir } from "node:os";

export type DesktopProviderKind = "codex" | "claudeAgent" | "cursor";

interface DesktopAppDefinition {
  readonly name: string;
  readonly macBundleNames: readonly string[];
  readonly macRuntimeRelativePaths: readonly string[];
  readonly windowsInstallDirectories: readonly string[];
  readonly windowsRuntimeNames: readonly string[];
}

const DESKTOP_APPS: Record<DesktopProviderKind, DesktopAppDefinition> = {
  codex: {
    name: "Codex",
    macBundleNames: ["Codex.app", "OpenAI Codex.app"],
    macRuntimeRelativePaths: [
      "Contents/Resources/codex",
      "Contents/Resources/bin/codex",
      "Contents/Resources/app/bin/codex",
    ],
    windowsInstallDirectories: ["Codex", "OpenAI Codex"],
    windowsRuntimeNames: ["codex.exe", "resources\\codex.exe", "resources\\bin\\codex.exe"],
  },
  claudeAgent: {
    name: "Claude",
    macBundleNames: ["Claude.app"],
    macRuntimeRelativePaths: [
      "Contents/Resources/claude",
      "Contents/Resources/bin/claude",
      "Contents/Resources/app/bin/claude",
    ],
    windowsInstallDirectories: ["Claude"],
    windowsRuntimeNames: ["claude.exe", "resources\\claude.exe", "resources\\bin\\claude.exe"],
  },
  cursor: {
    name: "Cursor",
    macBundleNames: ["Cursor.app"],
    macRuntimeRelativePaths: [
      "Contents/Resources/app/bin/cursor-agent",
      "Contents/Resources/app/bin/agent",
      "Contents/Resources/bin/cursor-agent",
    ],
    windowsInstallDirectories: ["Cursor"],
    windowsRuntimeNames: [
      "cursor-agent.exe",
      "resources\\app\\bin\\cursor-agent.exe",
      "resources\\app\\bin\\agent.exe",
    ],
  },
};

export interface ProviderRuntimeResolution {
  readonly executable: string;
  readonly source: "configured" | "path" | "desktop-app" | "unresolved";
  readonly desktopAppName: string;
  readonly desktopAppDetected: boolean;
}

function isRunnableFile(path: string, platform: NodeJS.Platform): boolean {
  if (!existsSync(path)) return false;
  try {
    accessSync(path, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasPathSeparator(value: string): boolean {
  return value.includes("/") || value.includes("\\") || isAbsolute(value);
}

export function findExecutableOnPath(input: {
  readonly binaryName: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
}): string | null {
  const env = input.env ?? process.env;
  const platform = input.platform ?? process.platform;
  const pathValue = env.PATH ?? env.Path ?? env.path ?? "";
  const extensions =
    platform === "win32"
      ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .filter(Boolean)
          .map((extension) => extension.toLowerCase())
      : [""];
  const alreadyHasExtension = platform === "win32" && /\.[A-Za-z0-9]+$/u.test(input.binaryName);
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    const base = resolve(directory, input.binaryName);
    const candidates = alreadyHasExtension
      ? [base]
      : extensions.map((extension) => `${base}${extension}`);
    for (const candidate of candidates) {
      if (isRunnableFile(candidate, platform)) return candidate;
    }
  }
  return null;
}

function desktopAppCandidates(input: {
  readonly provider: DesktopProviderKind;
  readonly platform: NodeJS.Platform;
  readonly homeDir: string;
  readonly env: NodeJS.ProcessEnv;
}): { readonly appRoots: string[]; readonly runtimes: string[] } {
  const definition = DESKTOP_APPS[input.provider];
  if (input.platform === "darwin") {
    const appRoots = definition.macBundleNames.flatMap((bundle) => [
      join("/Applications", bundle),
      join(input.homeDir, "Applications", bundle),
    ]);
    return {
      appRoots,
      runtimes: appRoots.flatMap((root) =>
        definition.macRuntimeRelativePaths.map((relativePath) => join(root, relativePath)),
      ),
    };
  }
  if (input.platform === "win32") {
    const installBases = [
      input.env.LOCALAPPDATA ? join(input.env.LOCALAPPDATA, "Programs") : null,
      input.env.ProgramFiles ?? null,
      input.env["ProgramFiles(x86)"] ?? null,
    ].filter((value): value is string => Boolean(value));
    const appRoots = installBases.flatMap((base) =>
      definition.windowsInstallDirectories.map((directory) => join(base, directory)),
    );
    return {
      appRoots,
      runtimes: appRoots.flatMap((root) =>
        definition.windowsRuntimeNames.map((runtime) => join(root, ...runtime.split("\\"))),
      ),
    };
  }
  return { appRoots: [], runtimes: [] };
}

export function resolveProviderRuntimeExecutable(input: {
  readonly provider: DesktopProviderKind;
  readonly configuredPath?: string | null;
  readonly defaultBinary: string;
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
  readonly appRoots?: readonly string[];
  readonly appRuntimeCandidates?: readonly string[];
}): ProviderRuntimeResolution {
  const platform = input.platform ?? process.platform;
  const env = input.env ?? process.env;
  const homeDir = input.homeDir ?? homedir();
  const configured = input.configuredPath?.trim() || input.defaultBinary;
  const definition = DESKTOP_APPS[input.provider];

  if (hasPathSeparator(configured) && isRunnableFile(configured, platform)) {
    return {
      executable: configured,
      source: "configured",
      desktopAppName: definition.name,
      desktopAppDetected: false,
    };
  }
  if (!hasPathSeparator(configured)) {
    const fromPath = findExecutableOnPath({ binaryName: configured, env, platform });
    if (fromPath) {
      return {
        executable: fromPath,
        source: "path",
        desktopAppName: definition.name,
        desktopAppDetected: false,
      };
    }
  }

  const discovered = desktopAppCandidates({ provider: input.provider, platform, homeDir, env });
  const appRoots = [...(input.appRoots ?? discovered.appRoots)];
  const runtimeCandidates = [...(input.appRuntimeCandidates ?? discovered.runtimes)];
  const appDetected = appRoots.some(existsSync);
  const appRuntime = runtimeCandidates.find((candidate) => isRunnableFile(candidate, platform));
  if (appRuntime) {
    return {
      executable: appRuntime,
      source: "desktop-app",
      desktopAppName: definition.name,
      desktopAppDetected: true,
    };
  }

  return {
    executable: configured,
    source: "unresolved",
    desktopAppName: definition.name,
    desktopAppDetected: appDetected,
  };
}

export function providerRuntimeMissingMessage(
  resolution: ProviderRuntimeResolution,
  cliLabel: string,
): string {
  return resolution.desktopAppDetected
    ? `${resolution.desktopAppName} is installed, but Modesto could not find a compatible provider runtime inside the app or on PATH. Install or configure ${cliLabel} in Provider settings.`
    : `${cliLabel} is not installed, not embedded in a detected desktop app, or not on PATH.`;
}
