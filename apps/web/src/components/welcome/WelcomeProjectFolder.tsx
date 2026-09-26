import { FolderIcon } from "lucide-react";

import "./welcomeHero.css";

export function WelcomeProjectFolder() {
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-square w-full max-w-[420px] min-h-[260px] grid place-items-center"
    >
      <FolderIcon
        className="welcome-project-mark size-24 text-[color-mix(in_oklab,var(--primary)_55%,var(--foreground))]"
        strokeWidth={1.1}
      />
    </div>
  );
}
