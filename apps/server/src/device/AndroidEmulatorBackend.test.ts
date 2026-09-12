import * as path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import {
  AndroidEmulatorBackend,
  avdUdid,
  candidateAndroidSdkRoots,
  parseAvdNames,
  parseUiAutomatorDump,
  runtimeLabelFromSysdir,
} from "./AndroidEmulatorBackend.ts";

describe("candidateAndroidSdkRoots", () => {
  it("prefers ANDROID_HOME then ANDROID_SDK_ROOT then platform defaults", () => {
    expect(
      candidateAndroidSdkRoots({
        env: {
          ANDROID_HOME: "/sdk/home",
          ANDROID_SDK_ROOT: "/sdk/root",
          LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local",
        },
        homeDir: "/Users/dev",
        platform: "darwin",
      }),
    ).toEqual([
      "/sdk/home",
      "/sdk/root",
      path.join("/Users/dev", "Library", "Android", "sdk"),
      path.join("/Users/dev", "Android", "Sdk"),
      path.join("C:\\Users\\dev\\AppData\\Local", "Android", "Sdk"),
    ]);
  });
});

describe("parseAvdNames", () => {
  it("drops emulator log lines and blank rows", () => {
    expect(parseAvdNames("INFO    | loading\nPixel_8\n\nERROR | skip\nPixel_Tablet\n")).toEqual([
      "Pixel_8",
      "Pixel_Tablet",
    ]);
  });
});

describe("avdUdid", () => {
  it("turns spaces into underscores and rejects illegal characters", () => {
    expect(avdUdid("Pixel 8 Pro")).toBe("Pixel_8_Pro");
    expect(avdUdid("bad/name")).toBeNull();
  });
});

describe("runtimeLabelFromSysdir", () => {
  it("maps known APIs onto Android version names", () => {
    expect(runtimeLabelFromSysdir("system-images/android-37/google_apis/arm64-v8a/")).toBe(
      "Android 17 (API 37)",
    );
    expect(runtimeLabelFromSysdir("system-images/android-41/google_apis/x86_64/")).toBe(
      "Android API 41",
    );
    expect(runtimeLabelFromSysdir("unknown")).toBe("Android");
  });
});

describe("parseUiAutomatorDump", () => {
  it("parses bounds into points and nests later nodes under the first", () => {
    const root = parseUiAutomatorDump(
      `<hierarchy rotation="0">
        <node class="android.widget.FrameLayout" bounds="[0,0][1080,2400]" />
        <node class="android.widget.TextView" text="Hello" bounds="[100,200][300,260]" />
      </hierarchy>`,
      2.5,
    );
    expect(root.role).toBe("FrameLayout");
    expect(root.frame).toEqual({ x: 0, y: 0, width: 432, height: 960 });
    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.label).toBe("Hello");
    expect(root.children[0]?.frame).toEqual({ x: 40, y: 80, width: 80, height: 24 });
  });
});

describe("AndroidEmulatorBackend availability", () => {
  it("asks for the SDK when no Android home exists", async () => {
    const backend = new AndroidEmulatorBackend({
      platform: "darwin",
      processEnv: {},
      homeDir: "/tmp/modesto-no-android-sdk",
    });
    const availability = await backend.availability();
    expect(availability.kind).toBe("setup-required");
    if (availability.kind !== "setup-required") return;
    expect(availability.steps.map((step) => step.id)).toEqual([
      "install-android-sdk",
      "install-android-platform-tools",
      "install-android-emulator",
      "install-android-avd",
    ]);
    expect(availability.steps.every((step) => !step.done)).toBe(true);
  });
});
