import { assert, describe, it } from "@effect/vitest";

import {
  createDesktopPlatformBuildConfig,
  MAC_ENTITLEMENTS_PATH,
  MAC_INHERITED_ENTITLEMENTS_PATH,
  MICROPHONE_USAGE_DESCRIPTION,
  PROVIDER_RUNTIME_ASAR_UNPACK_GLOBS,
  validateDesktopNativeBuildHost,
  WINDOWS_INSTALLER_GUID,
} from "./lib/desktop-platform-build-config.ts";
import { BRAND_ASSET_PATHS } from "./lib/brand-assets.ts";

describe("createDesktopPlatformBuildConfig", () => {
  it("adds explicit microphone entitlements to macOS builds", () => {
    const config = createDesktopPlatformBuildConfig({
      platform: "mac",
      target: "dmg",
      signed: false,
    });
    const mac = config.mac as Record<string, unknown>;
    const extendInfo = mac.extendInfo as Record<string, unknown>;

    assert.deepStrictEqual(mac.target, ["dmg", "zip"]);
    assert.equal(mac.icon, "icon.icns");
    assert.deepStrictEqual(config.asarUnpack, ["node_modules/**"]);
    assert.equal(mac.hardenedRuntime, true);
    assert.equal(mac.notarize, false);
    assert.equal(mac.entitlements, MAC_ENTITLEMENTS_PATH);
    assert.equal(mac.entitlementsInherit, MAC_INHERITED_ENTITLEMENTS_PATH);
    assert.equal(extendInfo.NSMicrophoneUsageDescription, MICROPHONE_USAGE_DESCRIPTION);
  });

  it("uses the branded compact DMG layout", () => {
    const config = createDesktopPlatformBuildConfig({
      platform: "mac",
      target: "dmg",
      signed: false,
    });

    assert.deepStrictEqual(config.dmg, {
      title: "Modesto",
      background: "dmg-background.png",
      iconSize: 112,
      iconTextSize: 13,
      window: { width: 660, height: 420 },
      contents: [
        { x: 180, y: 225, type: "file" },
        { x: 480, y: 225, type: "link", path: "/Applications" },
      ],
    });
  });

  it("forces ad-hoc signing for unsigned macOS builds so the shipped resources get resealed", () => {
    const unsigned = createDesktopPlatformBuildConfig({
      platform: "mac",
      target: "dmg",
      signed: false,
    });
    const signed = createDesktopPlatformBuildConfig({
      platform: "mac",
      target: "dmg",
      signed: true,
    });

    assert.equal((unsigned.mac as Record<string, unknown>).identity, "-");
    assert.equal((signed.mac as Record<string, unknown>).identity, undefined);
    assert.equal((unsigned.mac as Record<string, unknown>).notarize, false);
    assert.equal((signed.mac as Record<string, unknown>).notarize, true);
  });

  it("leaves non-macOS platform configs unchanged", () => {
    const linux = createDesktopPlatformBuildConfig({
      platform: "linux",
      target: "AppImage",
      signed: false,
    });
    const win = createDesktopPlatformBuildConfig({
      platform: "win",
      target: "nsis",
      signed: true,
      windowsAzureSignOptions: { publisherName: "Modesto" },
    });

    assert.equal(linux.mac, undefined);
    assert.deepStrictEqual(linux.asarUnpack, ["node_modules/**"]);
    assert.deepStrictEqual(linux.linux, {
      target: ["AppImage"],
      executableName: "modesto",
      icon: "icon.png",
      category: "Development",
      desktop: {
        entry: {
          StartupWMClass: "modesto",
        },
      },
    });

    assert.equal(win.mac, undefined);
    assert.deepStrictEqual(win.asarUnpack, ["node_modules/**"]);
    assert.equal(win.npmRebuild, false);
    assert.equal(WINDOWS_INSTALLER_GUID, "368107a8-afe6-5db5-ab3b-d4f331684868");
    assert.deepStrictEqual(win.nsis, {
      guid: WINDOWS_INSTALLER_GUID,
    });
    assert.deepStrictEqual(win.win, {
      target: ["nsis"],
      icon: "icon.ico",
      azureSignOptions: { publisherName: "Modesto" },
    });
  });

  it("keeps Windows signing optional", () => {
    const config = createDesktopPlatformBuildConfig({
      platform: "win",
      target: "nsis",
      signed: false,
    });

    assert.deepStrictEqual(config.win, {
      target: ["nsis"],
      icon: "icon.ico",
    });
    assert.equal(config.npmRebuild, false);
  });

  it("keeps Windows signing optional", () => {
    const config = createDesktopPlatformBuildConfig({
      platform: "win",
      target: "nsis",
      signed: false,
    });

    assert.deepStrictEqual(config.win, {
      target: ["nsis"],
      icon: "icon.ico",
    });
    assert.equal(config.npmRebuild, false);
  });

  it("keeps provider runtimes unpacked from ASAR in generated build config", () => {
    const config = createDesktopPlatformBuildConfig({
      platform: "linux",
      target: "AppImage",
      signed: false,
    });

    assert.deepStrictEqual([...PROVIDER_RUNTIME_ASAR_UNPACK_GLOBS], ["node_modules/**"]);
    assert.deepStrictEqual(config.asarUnpack, [...PROVIDER_RUNTIME_ASAR_UNPACK_GLOBS]);
  });

  it("blocks unsupported or non-matching Linux native build hosts", () => {
    assert.equal(
      validateDesktopNativeBuildHost({
        platform: "linux",
        arch: "x64",
        hostPlatform: "linux",
        hostArch: "x64",
      }),
      null,
    );

    assert.equal(
      validateDesktopNativeBuildHost({
        platform: "linux",
        arch: "universal",
        hostPlatform: "linux",
        hostArch: "x64",
      }),
      "Linux desktop artifacts support x64 or arm64 builds, not universal builds.",
    );

    const issue = validateDesktopNativeBuildHost({
      platform: "linux",
      arch: "x64",
      hostPlatform: "darwin",
      hostArch: "arm64",
    });

    assert.ok(issue?.includes("Build linux/x64 on a matching Linux host"));
  });

  it("keeps separate macOS sources for solid and rounded icons", () => {
    assert.equal(BRAND_ASSET_PATHS.productionMacIconPng, "assets/prod/black-macos-1024.png");
    assert.equal(
      BRAND_ASSET_PATHS.productionMacLegacyIconPng,
      "assets/prod/black-macos-legacy-1024.png",
    );
  });
});
