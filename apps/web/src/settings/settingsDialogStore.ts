import { create } from "zustand";

export function isSettingsPath(path: string): boolean {
  return path === "/settings" || path.startsWith("/settings/");
}

export const useSettingsDialogStore = create<{
  open: boolean;
  pathname: string;
  hash: string;
  show: (pathname?: string, hash?: string) => void;
  close: () => void;
  clearTarget: () => void;
}>((set) => ({
  open: false,
  pathname: "/settings/general",
  hash: "",
  show: (pathname = "/settings/general", hash = "") =>
    set({
      open: true,
      pathname: pathname === "/settings" ? "/settings/general" : pathname,
      hash,
    }),
  close: () => set({ open: false, hash: "" }),
  clearTarget: () => set({ hash: "" }),
}));
