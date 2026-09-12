// FILE: WelcomeProjectFolder.tsx
// Purpose: The last step's object — a physical folder, matching the theme
//          cards and the agent ring so "add a project" belongs to the same
//          set. WebGL when the client can run it, a drawn folder when it
//          cannot; either way it is decoration around the real control.

import { FolderIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";

import "./welcomeHero.css";

export function WelcomeProjectFolder() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;
    const readyWatcher = new MutationObserver(() => {
      if (host.dataset.ready === "true") setLive(true);
    });
    readyWatcher.observe(host, { attributes: true, attributeFilter: ["data-ready"] });

    void import("./welcomeBrand3d")
      .then(({ mountProjectFolder }) => mountProjectFolder(host))
      .then((stage) => {
        if (cancelled) {
          stage?.dispose();
          return;
        }
        if (!stage) return;
        dispose = () => stage.dispose();
      })
      .catch(() => {
        /* The drawn folder remains as the fallback. */
      });

    return () => {
      cancelled = true;
      readyWatcher.disconnect();
      setLive(false);
      host.dataset.ready = "";
      dispose?.();
    };
  }, []);

  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[420px] min-h-[260px]">
      <div
        className={cn(
          "absolute inset-0 grid place-items-center transition-opacity duration-500 ease-out",
          live && "opacity-0",
        )}
      >
        <FolderIcon
          className="welcome-project-mark size-24 text-[color-mix(in_oklab,var(--primary)_55%,var(--foreground))]"
          strokeWidth={1.1}
        />
      </div>
      <div
        ref={stageRef}
        className={cn(
          "absolute inset-0 transition-opacity duration-700 ease-out",
          live ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
    </div>
  );
}
