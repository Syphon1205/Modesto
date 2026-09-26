import { CheckIcon, FileCode2Icon, PackagePlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAppNavigate } from "../../hooks/useAppNavigate";
import { useSettingsDialogStore } from "../../settings/settingsDialogStore";
import {
  getActiveFileIconPackId,
  listFileIconPacks,
  removeFileIconPack,
  setActiveFileIconPack,
  type FileIconPackOption,
} from "../../pierre-icons";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";

const PREVIEW_EXTENSIONS = ["TS", "JS", "MD", "JSON"] as const;

function FileIconPackPreview({ pack, active }: { pack: FileIconPackOption; active: boolean }) {
  const quiet = pack.id === "modesto-mono" || pack.id === "standard" || pack.id === "minimal";
  return (
    <span
      aria-hidden="true"
      className="flex min-h-14 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/55 px-2"
    >
      {pack.custom ? (
        <FileCode2Icon className="size-6 text-primary" />
      ) : (
        PREVIEW_EXTENSIONS.map((extension, index) => (
          <span
            className={`grid size-7 place-items-center rounded-md border text-[8px] font-semibold ${quiet ? "border-border bg-muted text-muted-foreground" : ["border-blue-500/25 bg-blue-500/10 text-blue-500", "border-yellow-500/25 bg-yellow-500/10 text-yellow-600", "border-green-500/25 bg-green-500/10 text-green-600", "border-orange-500/25 bg-orange-500/10 text-orange-600"][index]}`}
            key={extension}
          >
            {extension}
          </span>
        ))
      )}
      {active ? <span className="sr-only">Active</span> : null}
    </span>
  );
}

export function FileIconSettings() {
  const navigate = useAppNavigate();
  const [packs, setPacks] = useState<ReadonlyArray<FileIconPackOption>>([]);
  const [activeId, setActiveId] = useState(getActiveFileIconPackId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPacks(await listFileIconPacks());
    setActiveId(getActiveFileIconPackId());
  }, []);

  useEffect(() => {
    void refresh();
    const handleChange = () => void refresh();
    window.addEventListener("modesto:file-icon-theme-changed", handleChange);
    return () => window.removeEventListener("modesto:file-icon-theme-changed", handleChange);
  }, [refresh]);

  const selectPack = async (pack: FileIconPackOption) => {
    if (pack.id === activeId || busyId) return;
    setBusyId(pack.id);
    try {
      await setActiveFileIconPack(pack.id);
      setActiveId(pack.id);
    } catch (cause) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Icon pack could not be applied",
          description:
            cause instanceof Error ? cause.message : "Try installing the icon pack again.",
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  const removePack = async (pack: FileIconPackOption) => {
    if (!pack.custom || busyId) return;
    setBusyId(pack.id);
    try {
      await removeFileIconPack(pack.id);
      await refresh();
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: `${pack.label} removed`,
          description: "You can reinstall it from Customize anytime.",
        }),
      );
    } catch (cause) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Icon pack could not be removed",
          description: cause instanceof Error ? cause.message : "Try again.",
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  const browse = () => {
    window.sessionStorage.setItem("modesto:customize-category", "Extensions");
    window.sessionStorage.setItem("modesto:customize-extension-filter", "icons");
    window.dispatchEvent(new CustomEvent("modesto:open-icon-extension-library"));
    useSettingsDialogStore.getState().close();
    void navigate({ to: "/plugins" });
  };

  return (
    <div className="space-y-3 pt-2">
      <div
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        role="radiogroup"
        aria-label="File icon pack"
      >
        {packs.map((pack) => {
          const active = activeId === pack.id;
          return (
            <div
              className={`group relative rounded-xl border p-2 transition-colors ${active ? "border-primary/55 bg-primary/[0.06]" : "border-border/70 bg-card/35 hover:border-foreground/25 hover:bg-card/65"}`}
              key={pack.id}
            >
              <button
                aria-checked={active}
                className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={busyId !== null}
                onClick={() => void selectPack(pack)}
                role="radio"
                type="button"
              >
                <FileIconPackPreview active={active} pack={pack} />
                <span className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                  {pack.label}
                  {active ? <CheckIcon className="size-3.5 text-primary" /> : null}
                </span>
                <span className="mt-0.5 block min-h-8 text-[11px] leading-4 text-muted-foreground">
                  {pack.description}
                </span>
              </button>
              {pack.custom ? (
                <Button
                  aria-label={`Remove ${pack.label}`}
                  className="absolute right-2 top-2 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  disabled={busyId !== null}
                  onClick={() => void removePack(pack)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button onClick={browse} size="xs" variant="outline">
        <PackagePlusIcon />
        Browse icon packs
      </Button>
    </div>
  );
}
