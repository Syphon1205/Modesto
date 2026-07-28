import { describe, expect, it } from "vitest";

import {
  MODESTO_DESKTOP_ENTRY_URL,
  MODESTO_DESKTOP_ORIGIN,
  MODESTO_DESKTOP_UPDATE_CHANNEL,
  MODESTO_DESKTOP_DEVELOPMENT_UPDATE_CHANNEL,
  MODESTO_DEVELOPMENT_BUNDLE_ID,
  MODESTO_PRODUCTION_BUNDLE_ID,
  modestoBundleId,
} from "./desktopIdentity";

describe("desktopIdentity", () => {
  it("uses the Modesto bundle and update identity", () => {
    expect(MODESTO_PRODUCTION_BUNDLE_ID).toBe("com.fabweavr.modesto");
    expect(MODESTO_DEVELOPMENT_BUNDLE_ID).toBe("com.fabweavr.modesto.dev");
    expect(modestoBundleId(false)).toBe(MODESTO_PRODUCTION_BUNDLE_ID);
    expect(modestoBundleId(true)).toBe(MODESTO_DEVELOPMENT_BUNDLE_ID);
    expect(MODESTO_DESKTOP_UPDATE_CHANNEL).toBe("modesto");
    expect(MODESTO_DESKTOP_DEVELOPMENT_UPDATE_CHANNEL).toBe("modesto-dev");
    expect(MODESTO_DESKTOP_ORIGIN).toBe("modesto://app");
    expect(MODESTO_DESKTOP_ENTRY_URL).toBe("modesto://app/index.html");
  });

  it("uses the exact packaged renderer origin and entry URL", () => {
    expect(MODESTO_DESKTOP_ORIGIN).toBe("modesto://app");
    expect(MODESTO_DESKTOP_ENTRY_URL).toBe("modesto://app/index.html");
  });

  it("uses the isolated Modesto desktop update channel", () => {
    expect(MODESTO_DESKTOP_UPDATE_CHANNEL).toBe("modesto");
  });
});
