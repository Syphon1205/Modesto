import {
  DEFAULT_SERVER_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
} from "@modesto/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@modesto/contracts/settings";
import { describe, expect, it } from "vite-plus/test";

import {
  mergeEnvironmentSettings,
  resolveEnvironmentIdentificationMode,
  resolveInterfaceStyle,
  resolveClientInterfaceSettings,
} from "./useSettings";

describe("resolveInterfaceStyle", () => {
  it("uses the GitHub shell", () => {
    expect(resolveInterfaceStyle({ interfaceStyle: "github", legacySidebarEnabled: false })).toBe(
      "github",
    );
  });

  it("preserves the OpenCode shell", () => {
    expect(resolveInterfaceStyle({ interfaceStyle: "opencode", legacySidebarEnabled: true })).toBe(
      "opencode",
    );
  });

  it("preserves the named classic shell", () => {
    expect(resolveInterfaceStyle({ interfaceStyle: "classic", legacySidebarEnabled: false })).toBe(
      "classic",
    );
  });

  it("migrates the previous legacy sidebar preference to the classic shell", () => {
    expect(resolveInterfaceStyle({ interfaceStyle: "modesto", legacySidebarEnabled: true })).toBe(
      "classic",
    );
  });

  it("migrates the retired Modesto style to the new default shell", () => {
    expect(resolveInterfaceStyle({ interfaceStyle: "modesto", legacySidebarEnabled: false })).toBe(
      "github",
    );
  });
});

describe("resolved interface settings", () => {
  it("gives the composer and shell the same style for a saved Modesto preference", () => {
    const stored = {
      ...DEFAULT_CLIENT_SETTINGS,
      interfaceStyle: "modesto" as const,
      legacySidebarEnabled: false,
    };
    expect(resolveClientInterfaceSettings(stored).interfaceStyle).toBe("github");
    expect(mergeEnvironmentSettings(DEFAULT_SERVER_SETTINGS, stored).interfaceStyle).toBe("github");
    expect(stored.interfaceStyle).toBe("modesto");
  });

  it("keeps explicit alternate layouts and stable snapshots", () => {
    for (const interfaceStyle of [
      "github",
      "opencode",
      "classic",
      "claude",
      "codex",
      "cursor",
    ] as const) {
      const stored = { ...DEFAULT_CLIENT_SETTINGS, interfaceStyle };
      expect(resolveClientInterfaceSettings(stored)).toBe(stored);
    }
  });

  it("does not make the old legacy sidebar opt-in irreversible", () => {
    const stored = {
      ...DEFAULT_CLIENT_SETTINGS,
      interfaceStyle: "modesto" as const,
      legacySidebarEnabled: true,
    };
    expect(resolveClientInterfaceSettings(stored).interfaceStyle).toBe("classic");
    expect(
      resolveClientInterfaceSettings({ ...stored, legacySidebarEnabled: false }).interfaceStyle,
    ).toBe("github");
  });
});

describe("resolveEnvironmentIdentificationMode", () => {
  it("keeps identification hidden until client settings hydrate", () => {
    expect(resolveEnvironmentIdentificationMode({ mode: "artwork", settingsHydrated: false })).toBe(
      "none",
    );
    expect(resolveEnvironmentIdentificationMode({ mode: "pill", settingsHydrated: true })).toBe(
      "pill",
    );
  });

  it("uses a pill instead of artwork with a palette theme", () => {
    expect(
      resolveEnvironmentIdentificationMode({
        mode: "artwork",
        settingsHydrated: true,
        paletteThemeActive: true,
      }),
    ).toBe("pill");
  });

  it("respects none with a palette theme", () => {
    expect(
      resolveEnvironmentIdentificationMode({
        mode: "none",
        settingsHydrated: true,
        paletteThemeActive: true,
      }),
    ).toBe("none");
  });

  it("keeps artwork when the palette theme opts into it", () => {
    expect(
      resolveEnvironmentIdentificationMode({
        mode: "artwork",
        settingsHydrated: true,
        paletteThemeActive: true,
        paletteThemeAllowsArtwork: true,
      }),
    ).toBe("artwork");
  });
});

describe("mergeEnvironmentSettings", () => {
  it("combines the selected environment's server settings with client preferences", () => {
    const serverSettings = {
      ...DEFAULT_SERVER_SETTINGS,
      providerInstances: {
        [ProviderInstanceId.make("codex_remote")]: {
          driver: ProviderDriverKind.make("codex"),
          enabled: true,
        },
      },
    };
    const clientSettings = {
      ...DEFAULT_CLIENT_SETTINGS,
      favorites: [
        {
          provider: ProviderInstanceId.make("codex_remote"),
          model: "gpt-5.4",
        },
      ],
    };

    const settings = mergeEnvironmentSettings(serverSettings, clientSettings);

    expect(settings.providerInstances).toBe(serverSettings.providerInstances);
    expect(settings.favorites).toBe(clientSettings.favorites);
  });
});
