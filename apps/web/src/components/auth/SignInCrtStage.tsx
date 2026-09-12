import { useEffect, useRef } from "react";

import { attachSignInCrtWarp } from "./signInCrtWarp";

export function SignInCrtStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return attachSignInCrtWarp(canvas);
  }, []);

  return (
    <div
      aria-hidden
      data-signin-crt=""
      className="relative h-full min-h-44 w-full overflow-hidden rounded-[calc(var(--radius-2xl)+0.5rem)] border border-border/70 bg-background shadow-sm md:min-h-0"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,color-mix(in_srgb,var(--primary)_28%,transparent),transparent_44%),linear-gradient(145deg,var(--background),color-mix(in_srgb,var(--background)_82%,var(--primary)))]" />
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />
      <div className="absolute inset-0 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent),inset_0_0_7rem_color-mix(in_srgb,var(--background)_36%,transparent)]" />
    </div>
  );
}
