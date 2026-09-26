import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getClientSettings, resolveInterfaceStyle } from "./useSettings";
import { isSettingsPath, useSettingsDialogStore } from "../settings/settingsDialogStore";

/** Settings is an overlay in the Copilot shell, so opening it must not unmount the workspace. */
export function useAppNavigate(): ReturnType<typeof useNavigate> {
  const navigate = useNavigate();
  return useCallback<ReturnType<typeof useNavigate>>(
    (options) => {
      if (
        typeof options.to === "string" &&
        isSettingsPath(options.to) &&
        resolveInterfaceStyle(getClientSettings()) === "github"
      ) {
        useSettingsDialogStore
          .getState()
          .show(options.to, typeof options.hash === "string" ? options.hash : "");
        return Promise.resolve();
      }
      useSettingsDialogStore.getState().close();
      return navigate(options);
    },
    [navigate],
  );
}
