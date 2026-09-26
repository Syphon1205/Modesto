import { beforeEach, describe, expect, it } from "vite-plus/test";
import { isSettingsPath, useSettingsDialogStore } from "./settingsDialogStore";

describe("settings dialog navigation", () => {
  beforeEach(() =>
    useSettingsDialogStore.setState({ open: false, pathname: "/settings/general", hash: "" }),
  );
  it("opens the general section and changes sections without using browser history", () => {
    useSettingsDialogStore.getState().show("/settings");
    expect(useSettingsDialogStore.getState()).toMatchObject({
      open: true,
      pathname: "/settings/general",
    });
    useSettingsDialogStore.getState().show("/settings/appearance", "theme");
    expect(useSettingsDialogStore.getState()).toMatchObject({
      pathname: "/settings/appearance",
      hash: "theme",
    });
    useSettingsDialogStore.getState().close();
    expect(useSettingsDialogStore.getState()).toMatchObject({ open: false, hash: "" });
    useSettingsDialogStore.getState().show();
    expect(useSettingsDialogStore.getState()).toMatchObject({
      open: true,
      pathname: "/settings/general",
      hash: "",
    });
  });
  it("does not intercept unrelated routes with a settings prefix", () => {
    expect(isSettingsPath("/settings/general")).toBe(true);
    expect(isSettingsPath("/settings")).toBe(true);
    expect(isSettingsPath("/settings-backup")).toBe(false);
    expect(isSettingsPath("/draft/settings")).toBe(false);
  });
});
