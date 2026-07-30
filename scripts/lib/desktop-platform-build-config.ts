// FILE: desktop-platform-build-config.ts
// Purpose: Builds platform-specific electron-builder config fragments for desktop artifacts.
// Layer: Release/build helper
// Depends on: Desktop packaging policy and electron-builder config shape.

export const MICROPHONE_USAGE_DESCRIPTION =
  "Modesto needs microphone access so you can record voice notes and transcribe them into the chat composer.";
export const MAC_ENTITLEMENTS_PATH = "apps/desktop/resources/entitlements.mac.plist";
export const MAC_INHERITED_ENTITLEMENTS_PATH =
  "apps/desktop/resources/entitlements.mac.inherit.plist";
export const WINDOWS_INSTALLER_GUID = "368107a8-afe6-5db5-ab3b-d4f331684868";
const MAC_DMG_ICON_PATH = "icon.icns";
const MAC_DMG_BACKGROUND_PATH = "dmg-background.png";
export const PROVIDER_RUNTIME_ASAR_UNPACK_GLOBS = ["node_modules/**"] as const;

export interface DesktopPlatformBuildConfig {
  readonly asarUnpack?: ReadonlyArray<string>;
  readonly extraResources?: ReadonlyArray<Record<string, unknown>>;
  readonly files?: ReadonlyArray<string>;
  readonly dmg?: Record<string, unknown>;
  readonly linux?: Record<string, unknown>;
  readonly mac?: Record<string, unknown>;
  readonly npmRebuild?: boolean;
  readonly nsis?: Record<string, unknown>;
  readonly win?: Record<string, unknown>;
}

export interface CreateDesktopPlatformBuildConfigInput {
  readonly platform: "linux" | "mac" | "win";
  readonly target: string;
  readonly signed: boolean;
  readonly windowsAzureSignOptions?: Record<string, string>;
}

export interface DesktopNativeBuildHostInput {
  readonly arch: "arm64" | "x64" | "universal";
  readonly hostArch: string;
  readonly hostPlatform: NodeJS.Platform;
  readonly platform: "linux" | "mac" | "win";
}

export function validateDesktopNativeBuildHost(input: DesktopNativeBuildHostInput): string | null {
  if (input.platform !== "linux") return null;
  if (input.arch === "universal") {
    return "Linux desktop artifacts support x64 or arm64 builds, not universal builds.";
  }
  if (input.hostPlatform === "linux" && input.hostArch === input.arch) return null;

  return [
    "Linux desktop artifacts include the native node-pty terminal dependency.",
    `Build linux/${input.arch} on a matching Linux host so pty.node and spawn-helper are compiled for Linux.`,
    `Current host is ${input.hostPlatform}/${input.hostArch}.`,
  ].join(" ");
}

export function createDesktopPlatformBuildConfig(
  input: CreateDesktopPlatformBuildConfigInput,
): DesktopPlatformBuildConfig {
  const nativePackaging = {
    // Provider CLIs are child processes. Their launchers and transitive modules
    // must live on the real filesystem instead of being trapped in app.asar.
    asarUnpack: [...PROVIDER_RUNTIME_ASAR_UNPACK_GLOBS],
    files: ["**/*", "!apps/desktop/provider-runtimes{,/**}"],
    extraResources: [
      {
        from: "apps/desktop/provider-runtimes",
        to: "provider-runtimes",
        filter: ["**/*"],
      },
    ],
  };

  if (input.platform === "mac") {
    const hostIsMac = process.platform === "darwin";
    const macTargets =
      input.target === "dmg"
        ? hostIsMac
          ? [input.target, "zip"]
          : // DMG authoring still needs Apple tooling (hdiutil/dmgbuild Mach-O helpers).
            // On Linux release hosts, ship the Squirrel.Mac zip payload instead.
            ["zip"]
        : [input.target];
    const mac = {
      target: macTargets,
      icon: MAC_DMG_ICON_PATH,
      category: "public.app-category.developer-tools",
      hardenedRuntime: true,
      // Do not rely on electron-builder's environment-variable auto-detection.
      // Release builds opt in explicitly, while local/build-only artifacts stay
      // deterministic even if a developer has Apple credentials in their shell.
      notarize: input.signed,
      entitlements: MAC_ENTITLEMENTS_PATH,
      entitlementsInherit: MAC_INHERITED_ENTITLEMENTS_PATH,
      extendInfo: {
        NSMicrophoneUsageDescription: MICROPHONE_USAGE_DESCRIPTION,
      },
      // Without a Developer ID identity, CSC_IDENTITY_AUTO_DISCOVERY=false makes
      // electron-builder skip signing entirely, leaving the original prebuilt Electron
      // binary's signature in place even though the bundle's resources were replaced —
      // Gatekeeper then reports the app as "damaged" rather than merely unsigned.
      // Explicit ad-hoc identity forces a real (if uncertified) signing pass that reseals
      // the actual shipped resources. disable-library-validation in the entitlements
      // plist keeps hardened runtime + ad-hoc signing from breaking Electron's own
      // prebuilt (Developer-ID-signed) frameworks.
      ...(input.signed ? {} : { identity: "-" }),
    } satisfies Record<string, unknown>;

    return {
      ...nativePackaging,
      // Prebuilds cover node-pty/keytar; rebuilding on Linux cannot cross-compile
      // native Darwin modules and blocks packaging before electron-builder runs.
      npmRebuild: false,
      mac,
      ...(input.target === "dmg" && process.platform === "darwin"
        ? {
            dmg: {
              title: "Modesto",
              background: MAC_DMG_BACKGROUND_PATH,
              iconSize: 112,
              iconTextSize: 13,
              window: {
                width: 660,
                height: 420,
              },
              contents: [
                {
                  x: 180,
                  y: 225,
                  type: "file",
                },
                {
                  x: 480,
                  y: 225,
                  type: "link",
                  path: "/Applications",
                },
              ],
            },
          }
        : {}),
    };
  }

  if (input.platform === "linux") {
    return {
      ...nativePackaging,
      linux: {
        target: [input.target],
        executableName: "modesto",
        icon: "icon.png",
        category: "Development",
        desktop: {
          entry: {
            StartupWMClass: "modesto",
          },
        },
      },
    };
  }

  return {
    ...nativePackaging,
    // node-pty ships win32 x64/arm64 prebuilds in its published package. Rebuilding
    // on a macOS release host makes @electron/rebuild invoke node-gyp and fail before
    // NSIS runs; optional msgpackr extraction safely falls back to JavaScript.
    npmRebuild: false,
    // Keep the Windows product registration stable while the public app ID changes.
    // This lets NSIS updates replace the existing installation and own its uninstaller.
    nsis: {
      guid: WINDOWS_INSTALLER_GUID,
      // Cross-compiling Windows installers from Linux does not need Wine for the
      // one-click NSIS payload itself. Differential packages require running the
      // built installer under Wine to extract the embedded uninstaller; keep that
      // off so release hosts without a working 32-bit Wine prefix can still ship.
      differentialPackage: false,
    },
    win: {
      target: [input.target],
      icon: "icon.ico",
      ...(input.windowsAzureSignOptions ? { azureSignOptions: input.windowsAzureSignOptions } : {}),
    },
  };
}
