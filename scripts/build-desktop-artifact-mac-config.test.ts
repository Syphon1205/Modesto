import { readFile } from "node:fs/promises";
import { assert, describe, it } from "@effect/vitest";

import {
  createDesktopPlatformBuildConfig,
  MAC_ENTITLEMENTS_PATH,
  MAC_INHERITED_ENTITLEMENTS_PATH,
  MICROPHONE_USAGE_DESCRIPTION,
  APPLE_EVENTS_USAGE_DESCRIPTION,
  PROVIDER_RUNTIME_ASAR_UNPACK_GLOBS,
  validateDesktopNativeBuildHost,
  WINDOWS_INSTALLER_GUID,
  WINDOWS_LEGAL_TRADEMARKS,
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
    assert.equal(extendInfo.NSAppleEventsUsageDescription, APPLE_EVENTS_USAGE_DESCRIPTION);
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
      window: { width: 700, height: 500 },
      contents: [
        { x: 210, y: 230, type: "file" },
        { x: 490, y: 230, type: "link", path: "/Applications" },
      ],
    });
  });

  it("keeps the DMG background art the same size as the DMG window", async () => {
    // The bug this pins: dmg-builder spreads the explicit `window` option after
    // the size it measures from the background, so the window wins and a
    // larger image is cropped to its top-left corner instead of being scaled.
    // The result was an installer that showed a header and a large empty field.
    const config = createDesktopPlatformBuildConfig({
      platform: "mac",
      target: "dmg",
      signed: false,
    });
    const window = (config.dmg as { window: { width: number; height: number } }).window;

    for (const variant of ["latest", "nightly"]) {
      const svg = await readFile(
        new URL(`../apps/desktop/resources/dmg/dmg-background-${variant}.svg`, import.meta.url),
        "utf8",
      );
      const viewBox = /viewBox="([^"]+)"/u.exec(svg)?.[1];
      assert.strictEqual(
        viewBox,
        `0 0 ${window.width} ${window.height}`,
        `${variant} background must be laid out at the DMG window size`,
      );

      // Authored at 2x so `sips` rasterizes crisply for the retina
      // representation; the build downsamples that for the 1x companion.
      const width = Number(/\swidth="(\d+)"/u.exec(svg)?.[1]);
      const height = Number(/\sheight="(\d+)"/u.exec(svg)?.[1]);
      assert.strictEqual(width, window.width * 2, `${variant} background must be 2x wide`);
      assert.strictEqual(height, window.height * 2, `${variant} background must be 2x tall`);
    }
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
      windowsAzureSignOptions: { publisherName: "Modesto Team" },
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
      legalTrademarks: WINDOWS_LEGAL_TRADEMARKS,
      azureSignOptions: { publisherName: "Modesto Team" },
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
      legalTrademarks: WINDOWS_LEGAL_TRADEMARKS,
    });
    assert.equal(config.npmRebuild, false);
  });

  it("rejects signing under a different publisher identity", () => {
    assert.throws(
      () =>
        createDesktopPlatformBuildConfig({
          platform: "win",
          target: "nsis",
          signed: true,
          windowsAzureSignOptions: { publisherName: "Other Publisher" },
        }),
      /Modesto Team/,
    );
  });

  it("keeps unsigned validation builds clearly unsigned", () => {
    const config = createDesktopPlatformBuildConfig({
      platform: "win",
      target: "nsis",
      signed: false,
    });

    assert.deepStrictEqual(config.win, {
      target: ["nsis"],
      icon: "icon.ico",
      legalTrademarks: WINDOWS_LEGAL_TRADEMARKS,
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
