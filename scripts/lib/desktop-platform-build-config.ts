// FILE: desktop-platform-build-config.ts
// Purpose: Builds platform-specific electron-builder config fragments for desktop artifacts.
// Layer: Release/build helper
// Depends on: Desktop packaging policy and electron-builder config shape.

export const MICROPHONE_USAGE_DESCRIPTION =
  "Modesto needs microphone access so you can dictate into the chat composer.";
export const APPLE_EVENTS_USAGE_DESCRIPTION =
  "Modesto needs access to your music apps so it can browse playlists and play songs from libraries on this Mac.";
export const SCREEN_CAPTURE_USAGE_DESCRIPTION =
  "Modesto needs Screen Recording access so Appshots can capture the frontmost window into chat.";
export const MAC_ENTITLEMENTS_PATH = "apps/desktop/resources/entitlements.mac.plist";
export const MAC_INHERITED_ENTITLEMENTS_PATH =
  "apps/desktop/resources/entitlements.mac.inherit.plist";
export const WINDOWS_INSTALLER_GUID = "368107a8-afe6-5db5-ab3b-d4f331684868";
export const WINDOWS_PUBLISHER_NAME = "Modesto Team";
export const WINDOWS_LEGAL_TRADEMARKS = WINDOWS_PUBLISHER_NAME;
const MAC_DMG_ICON_PATH = "icon.icns";
const MAC_DMG_BACKGROUND_PATH = "dmg-background.png";

/**
 * The DMG window, in points, and the size the background art must be authored at.
 *
 * dmg-builder measures the background image and then spreads this option over
 * the result (`{ position, size, ...settings.window }`), so this wins and a
 * background of any other size is cropped to its top-left corner rather than
 * scaled to fit. Exported because `scripts/build-dmg-background.py` lays the
 * art out against these numbers and the build downsamples the 2x raster to
 * them — three places that have to agree, and used to not.
 */
export const MAC_DMG_WINDOW = { width: 700, height: 500 } as const;

/**
 * Icon centres in the window, in points. The background art draws its arrow and
 * drop well against these, so they move together.
 */
export const MAC_DMG_ICON_SIZE = 112;
export const MAC_DMG_APP_ICON_POSITION = { x: 210, y: 230 } as const;
export const MAC_DMG_APPLICATIONS_ICON_POSITION = { x: 490, y: 230 } as const;
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
      ...(input.platform === "mac"
        ? [
            {
              from: "apps/desktop/native/appshot-helper/build",
              to: "appshot-helper",
              filter: ["modesto-appshot-helper"],
            },
          ]
        : []),
    ],
  };

  if (input.platform === "mac") {
    const mac = {
      target: input.target === "dmg" ? [input.target, "zip"] : [input.target],
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
        NSAppleEventsUsageDescription: APPLE_EVENTS_USAGE_DESCRIPTION,
        NSScreenCaptureUsageDescription: SCREEN_CAPTURE_USAGE_DESCRIPTION,
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
      mac,
      ...(input.target === "dmg"
        ? {
            dmg: {
              title: "Modesto",
              background: MAC_DMG_BACKGROUND_PATH,
              iconSize: MAC_DMG_ICON_SIZE,
              iconTextSize: 13,
              window: { ...MAC_DMG_WINDOW },
              contents: [
                {
                  x: MAC_DMG_APP_ICON_POSITION.x,
                  y: MAC_DMG_APP_ICON_POSITION.y,
                  type: "file",
                },
                {
                  x: MAC_DMG_APPLICATIONS_ICON_POSITION.x,
                  y: MAC_DMG_APPLICATIONS_ICON_POSITION.y,
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

  if (input.signed && input.windowsAzureSignOptions?.publisherName !== WINDOWS_PUBLISHER_NAME) {
    throw new Error(
      'Windows release signing requires a certificate publisher named "Modesto Team". Configure the matching Azure certificate profile; installer metadata cannot change a certificate identity.',
    );
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
    },
    win: {
      target: [input.target],
      icon: "icon.ico",
      legalTrademarks: WINDOWS_LEGAL_TRADEMARKS,
      ...(input.windowsAzureSignOptions ? { azureSignOptions: input.windowsAzureSignOptions } : {}),
    },
  };
}
