import type { ComponentPropsWithoutRef } from "react";

import { cn } from "~/lib/utils";

const LOGO_PATHS = [
  "M18 32H39C42 32 43.5 30.5 45 28L55 12",
  "M66 20L60 32C58 36 59 39 62 42L81 58",
  "M14 45L35 51C39 52 41 55 41 59V80",
  "M57 58L70 70",
] as const;

export function ModestoLogo({ className, ...props }: ComponentPropsWithoutRef<"svg">) {
  const ariaHidden = props["aria-label"] ? undefined : true;
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
      {...props}
      className={cn("shrink-0 text-foreground", className)}
    >
      {LOGO_PATHS.map((path) => (
        <path
          key={path}
          d={path}
          stroke="currentColor"
          strokeWidth="9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
