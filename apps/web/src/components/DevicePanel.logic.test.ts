import { describe, expect, it } from "@effect/vitest";

import {
  buildDevicePickerEntries,
  buildMakerModelOptions,
  chassisForMaker,
  defaultDeviceMaker,
  deviceAttachStatusLabel,
  deviceMakerFor,
  fallbackSetupStepsForMaker,
  groupDevicePickerEntries,
  presentDeviceSetup,
  presentDeviceSetupStep,
  resolveDeviceAvailabilityView,
  resolveDeviceSetupAction,
  setupProbeCopy,
  setupStepsForMaker,
  shouldShowDeviceSetup,
  uniqueLatestModels,
} from "./DevicePanel.logic";

describe("resolveDeviceAvailabilityView", () => {
  it("names both SDKs when the server platform cannot run iOS Simulator", () => {
    const view = resolveDeviceAvailabilityView({
      kind: "unsupported-platform",
      platform: "linux",
    });
    expect(view.kind).toBe("blocked");
    if (view.kind !== "blocked") return;
    expect(view.title).toBe("Mobile Simulator needs a local SDK");
    expect(view.description).toContain("Android Emulator");
  });

  it("keeps the iOS setup title until an Android step appears", () => {
    const iosOnly = resolveDeviceAvailabilityView({
      kind: "setup-required",
      steps: [{ id: "install-xcode", label: "Install Xcode", done: false }],
    });
    expect(iosOnly.kind === "blocked" && iosOnly.title).toBe("Set up the iOS Simulator");

    const mixed = resolveDeviceAvailabilityView({
      kind: "setup-required",
      steps: [
        { id: "install-xcode", label: "Install Xcode", done: false },
        { id: "install-android-sdk", label: "Install the Android SDK", done: false },
      ],
    });
    expect(mixed.kind === "blocked" && mixed.title).toBe("Set up Mobile Simulator");
  });
});

describe("resolveDeviceSetupAction", () => {
  it("opens Xcode when command-line tools still point at the CLT", () => {
    expect(
      resolveDeviceSetupAction([
        {
          id: "select-xcode-command-line-tools",
          label: "Select Xcode",
          done: false,
          detail: "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
        },
      ]),
    ).toEqual({
      label: "Open Xcode",
      url: "file:///Applications/Xcode.app",
    });
  });

  it("sends Android SDK setup to the official command-line tools page", () => {
    expect(
      resolveDeviceSetupAction([
        {
          id: "install-android-sdk",
          label: "Install the Android SDK command-line tools",
          done: false,
        },
      ]),
    ).toEqual({
      label: "Install Android Studio",
      url: "https://developer.android.com/studio",
    });
  });
});

describe("presentDeviceSetupStep", () => {
  it("turns Select Xcode into the copyable command card", () => {
    const presented = presentDeviceSetupStep({
      id: "select-xcode-command-line-tools",
      label: "Select Xcode",
      done: false,
      detail: "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
    });
    expect(presented.title).toBe("Select Xcode");
    expect(presented.body).toContain("command-line tools don't point at it");
    expect(presented.command).toBe(
      "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
    );
  });

  it("replaces the no-op downloadPlatform command with a GUI path and a flagged xcodebuild", () => {
    const presented = presentDeviceSetupStep({
      id: "install-ios-runtime",
      label: "Simulator installed",
      done: false,
      detail: "xcodebuild -downloadPlatform iOS",
    });
    expect(presented.command).not.toBe("xcodebuild -downloadPlatform iOS");
    expect(presented.command).toContain("-architectureVariant");
    expect(presented.body).toContain("Settings → Components");
    expect(presented.body).toContain("does nothing");
  });

  it("shows the Xcode version on a completed install card", () => {
    expect(
      presentDeviceSetupStep({
        id: "install-xcode",
        label: "Xcode installed",
        done: true,
        detail: "Version 26.6",
      }),
    ).toMatchObject({ title: "Xcode installed", done: true, status: "Version 26.6" });
  });

  it("names a Pixel AVD for Google and a Galaxy AVD for Samsung", () => {
    const step = {
      id: "install-android-avd" as const,
      label: "Create an Android Virtual Device",
      done: false,
    };
    const pixel = presentDeviceSetupStep(step, true, "google");
    expect(pixel.title).toBe("Pixel virtual device");
    expect(pixel.body).toContain("Pixel 10");
    expect(pixel.body).not.toMatch(/xcode/i);
    expect(pixel.command).toContain("Pixel_10");

    const galaxy = presentDeviceSetupStep(step, true, "samsung");
    expect(galaxy.title).toBe("Galaxy virtual device");
    expect(galaxy.body).toContain("Galaxy S26 Ultra");
    expect(galaxy.body).not.toMatch(/pixel/i);
    expect(galaxy.command).toContain("Galaxy_S26_Ultra");
  });
});

describe("setupStepsForMaker", () => {
  it("keeps Apple and Android checklists on their own makers", () => {
    const steps = [
      { id: "install-xcode" as const, label: "Xcode installed", done: true },
      { id: "select-xcode-command-line-tools" as const, label: "Select Xcode", done: false },
      { id: "install-android-sdk" as const, label: "Android SDK installed", done: false },
    ];
    expect(setupStepsForMaker(steps, "apple").map((step) => step.id)).toEqual([
      "install-xcode",
      "select-xcode-command-line-tools",
    ]);
    expect(setupStepsForMaker(steps, "google").map((step) => step.id)).toEqual([
      "install-android-sdk",
    ]);
    expect(setupStepsForMaker(steps, "samsung").map((step) => step.id)).toEqual([
      "install-android-sdk",
    ]);
  });

  it("gives Apple Xcode cards before the server answers, never Android ones", () => {
    expect(fallbackSetupStepsForMaker("apple").map((step) => step.id)).toEqual([
      "install-xcode",
      "select-xcode-command-line-tools",
      "install-ios-runtime",
    ]);
    const presented = presentDeviceSetup(fallbackSetupStepsForMaker("apple"), "apple");
    expect(presented.cards.map((card) => card.title)).toEqual([
      "Xcode installed",
      "Select Xcode",
      "Simulator installed",
    ]);
    expect(presented.cards[1]?.command).toContain("xcode-select");
    expect(
      presented.cards.some((card) =>
        /android/i.test(`${card.title}${card.body ?? ""}${card.command ?? ""}`),
      ),
    ).toBe(false);
  });

  it("hides a completed Select Xcode once the developer dir is pinned", () => {
    const steps = [
      { id: "install-xcode" as const, label: "Xcode installed", done: true },
      {
        id: "select-xcode-command-line-tools" as const,
        label: "Select Xcode",
        done: true,
      },
      { id: "install-ios-runtime" as const, label: "Simulator installed", done: true },
    ];
    expect(setupStepsForMaker(steps, "apple").map((step) => step.id)).toEqual([
      "install-xcode",
      "install-ios-runtime",
    ]);
  });

  it("hides a completed Xcode license from the screenshot checklist", () => {
    const steps = [
      { id: "install-xcode" as const, label: "Xcode installed", done: true },
      { id: "accept-xcode-license" as const, label: "Accept the Xcode license", done: true },
      { id: "select-xcode-command-line-tools" as const, label: "Select Xcode", done: false },
      { id: "install-ios-runtime" as const, label: "Simulator installed", done: true },
    ];
    expect(setupStepsForMaker(steps, "apple").map((step) => step.id)).toEqual([
      "install-xcode",
      "select-xcode-command-line-tools",
      "install-ios-runtime",
    ]);
  });

  it("does not keep Apple on setup when only the helper and Android remain", () => {
    const steps = [
      {
        id: "install-xcode" as const,
        label: "Xcode installed",
        done: true,
        detail: "Version 26.6",
      },
      {
        id: "select-xcode-command-line-tools" as const,
        label: "Select Xcode",
        done: true,
      },
      { id: "accept-xcode-license" as const, label: "Accept the Xcode license", done: true },
      { id: "install-ios-runtime" as const, label: "Simulator installed", done: true },
      { id: "build-device-helper" as const, label: "Build the Modesto device helper", done: false },
      { id: "install-android-sdk" as const, label: "Android Studio installed", done: false },
    ];
    expect(setupStepsForMaker(steps, "apple").every((step) => step.done)).toBe(true);
    expect(setupStepsForMaker(steps, "google").some((step) => !step.done)).toBe(true);
  });
});

describe("shouldShowDeviceSetup", () => {
  const undone = [{ id: "install-xcode" as const, label: "Xcode installed", done: false }];

  it("does not show fallback Xcode cards before the server answers", () => {
    expect(
      shouldShowDeviceSetup({ threadState: undefined, hasMakerDevices: false, makerSteps: undone }),
    ).toBe(false);
  });

  it("does not show setup cards when simulators are already listed", () => {
    expect(
      shouldShowDeviceSetup({
        threadState: {
          threadId: "thread-1" as never,
          version: 1,
          attachedDeviceUdid: null,
          devices: [],
          agentActive: false,
          availability: { kind: "setup-required", steps: undone },
          lastError: null,
          attachPhase: null,
        },
        hasMakerDevices: true,
        makerSteps: undone,
      }),
    ).toBe(false);
  });

  it("lets the picker boot while Select Xcode is still undone if simctl listed devices", () => {
    const selectXcode = {
      id: "select-xcode-command-line-tools" as const,
      label: "Select Xcode",
      done: false,
      detail: "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
    };
    expect(
      shouldShowDeviceSetup({
        threadState: {
          threadId: "thread-1" as never,
          version: 1,
          attachedDeviceUdid: null,
          devices: [],
          agentActive: false,
          availability: { kind: "setup-required", steps: [selectXcode] },
          lastError: null,
          attachPhase: null,
        },
        hasMakerDevices: true,
        makerSteps: [selectXcode],
      }),
    ).toBe(false);
    expect(resolveDeviceSetupAction([selectXcode])?.label).toBe("Open Xcode");
  });

  it("does not block on downloadPlatform when simctl already listed iPhones", () => {
    const runtime = {
      id: "install-ios-runtime" as const,
      label: "Simulator installed",
      done: false,
      detail: "xcodebuild -downloadPlatform iOS",
    };
    expect(
      shouldShowDeviceSetup({
        threadState: {
          threadId: "thread-1" as never,
          version: 1,
          attachedDeviceUdid: null,
          devices: [],
          agentActive: false,
          availability: { kind: "setup-required", steps: [runtime] },
          lastError: null,
          attachPhase: null,
        },
        hasMakerDevices: true,
        makerSteps: [runtime],
      }),
    ).toBe(false);
  });
});

describe("deviceMakerFor", () => {
  it("maps simulators onto Apple, Pixel, and Galaxy", () => {
    expect(deviceMakerFor({ platform: "ios-simulator", name: "iPhone 17 Pro" })).toBe("apple");
    expect(deviceMakerFor({ platform: "android-emulator", name: "Pixel 10" })).toBe("google");
    expect(deviceMakerFor({ platform: "android-emulator", name: "Galaxy S26 Ultra" })).toBe(
      "samsung",
    );
  });
});

describe("groupDevicePickerEntries", () => {
  it("splits iOS and Android simulators for the picker", () => {
    const entries = buildDevicePickerEntries({
      attachedDeviceUdid: null,
      devices: [
        {
          platform: "android-emulator",
          udid: "Pixel_8",
          name: "Pixel 8",
          runtime: "Android 17 (API 37)",
          state: "shutdown",
          bootSource: "user",
          family: "phone",
        },
        {
          platform: "ios-simulator",
          udid: "iphone",
          name: "iPhone 17",
          runtime: "iOS 26.2",
          state: "booted",
          bootSource: "user",
          family: "phone",
        },
      ],
    });
    const grouped = groupDevicePickerEntries(entries);
    expect(grouped.ios.map((entry) => entry.device.name)).toEqual(["iPhone 17"]);
    expect(grouped.android.map((entry) => entry.device.name)).toEqual(["Pixel 8"]);
  });
});

describe("buildMakerModelOptions", () => {
  it("keeps one iPhone per name and prefers the newest runtime", () => {
    const entries = uniqueLatestModels(
      buildDevicePickerEntries({
        attachedDeviceUdid: null,
        devices: [
          {
            platform: "ios-simulator",
            udid: "old",
            name: "iPhone 17 Pro",
            runtime: "iOS 26.4",
            state: "shutdown",
            bootSource: "user",
            family: "phone",
          },
          {
            platform: "ios-simulator",
            udid: "new",
            name: "iPhone 17 Pro",
            runtime: "iOS 27.0",
            state: "shutdown",
            bootSource: "user",
            family: "phone",
          },
          {
            platform: "ios-simulator",
            udid: "ipad",
            name: "iPad Pro 13-inch (M5)",
            runtime: "iOS 27.0",
            state: "shutdown",
            bootSource: "user",
            family: "tablet",
          },
        ],
      }),
    );
    const options = buildMakerModelOptions(entries, "apple");
    expect(options).toEqual([
      expect.objectContaining({
        id: "new",
        label: "iPhone 17 Pro",
        device: expect.objectContaining({ udid: "new" }),
      }),
    ]);
  });

  it("prefers an already-booted iPhone over a newer shutdown copy", () => {
    const options = buildMakerModelOptions(
      uniqueLatestModels(
        buildDevicePickerEntries({
          attachedDeviceUdid: null,
          devices: [
            {
              platform: "ios-simulator",
              udid: "shutdown-new",
              name: "iPhone 17 Pro",
              runtime: "iOS 27.0",
              state: "shutdown",
              bootSource: "user",
              family: "phone",
            },
            {
              platform: "ios-simulator",
              udid: "booted-old",
              name: "iPhone 17 Pro",
              runtime: "iOS 26.4",
              state: "booted",
              bootSource: "user",
              family: "phone",
            },
          ],
        }),
      ),
      "apple",
    );
    expect(options[0]?.id).toBe("booted-old");
  });

  it("offers the latest Pixel when Google has no matching AVD", () => {
    const options = buildMakerModelOptions([], "google");
    expect(options).toEqual([
      { id: "catalog:google", label: "Pixel 10", detail: "Latest Pixel", device: null },
    ]);
  });

  it("offers the latest Galaxy when Samsung has no matching AVD", () => {
    const options = buildMakerModelOptions([], "samsung");
    expect(options).toEqual([
      {
        id: "catalog:samsung",
        label: "Galaxy S26 Ultra",
        detail: "Latest Galaxy",
        device: null,
      },
    ]);
  });

  it("uses an installed Pixel as Google's latest phone", () => {
    const entries = buildDevicePickerEntries({
      attachedDeviceUdid: null,
      devices: [
        {
          platform: "android-emulator",
          udid: "Pixel_8",
          name: "Pixel 8",
          runtime: "Android 16 (API 36)",
          state: "shutdown",
          bootSource: "user",
          family: "phone",
        },
      ],
    });
    expect(buildMakerModelOptions(entries, "google")[0]).toMatchObject({
      id: "Pixel_8",
      label: "Pixel 8",
      detail: "Latest Pixel",
    });
  });
});

describe("chassisForMaker", () => {
  it("draws a distinct body for Apple, Pixel, and Galaxy", () => {
    expect(chassisForMaker("apple")).toBe("iPhone");
    expect(chassisForMaker("google")).toBe("pixel");
    expect(chassisForMaker("samsung")).toBe("galaxy");
    expect(chassisForMaker(null)).toBe("iPhone");
  });
});

describe("setupProbeCopy", () => {
  it("never mixes Xcode copy into Pixel or Galaxy, or Android into Apple", () => {
    expect(setupProbeCopy("apple").description).toContain("Xcode");
    expect(setupProbeCopy("apple").description).not.toMatch(/android/i);
    expect(setupProbeCopy("google").description).toContain("Pixel");
    expect(setupProbeCopy("google").description).not.toMatch(/xcode/i);
    expect(setupProbeCopy("samsung").description).toContain("Galaxy");
    expect(setupProbeCopy("samsung").description).not.toMatch(/xcode/i);
    expect(setupProbeCopy("samsung").description).not.toMatch(/pixel/i);
  });
});

describe("deviceAttachStatusLabel", () => {
  it("names the iPhone while booting and never mentions Android", () => {
    expect(
      deviceAttachStatusLabel({
        phase: undefined,
        deviceState: "shutdown",
        pendingSelection: true,
        deviceName: "iPhone 17 Pro",
      }),
    ).toBe("Starting iPhone 17 Pro…");
    expect(
      deviceAttachStatusLabel({
        phase: "waiting-for-display",
        deviceState: "booted",
        pendingSelection: false,
        deviceName: "iPhone 17 Pro",
      }),
    ).toBe("Waiting for the screen…");
    expect(
      deviceAttachStatusLabel({
        phase: "booting",
        deviceState: "booting",
        pendingSelection: true,
        deviceName: "iPhone 17 Pro",
      }),
    ).not.toMatch(/android|xcode/i);
  });
});

describe("defaultDeviceMaker", () => {
  it("stays unset until the user picks a maker", () => {
    expect(defaultDeviceMaker([])).toBeNull();
  });
});
