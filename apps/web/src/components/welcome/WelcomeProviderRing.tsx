// FILE: WelcomeProviderRing.tsx
// Purpose: The providers step's centerpiece — the CLIs this machine already has,
//          settling into a ring around the count. Clean CSS layout.

import type { ServerProvider } from "@modesto/contracts";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { getDriverOption } from "~/components/settings/providerDriverMeta";
import { cn } from "~/lib/utils";

import {
  summarizeWelcomeAgent,
  welcomeRingLayout,
  type WelcomeAgentReadiness,
} from "./welcomeSetup";
import "./welcomeHero.css";

const TILE_TONE: Record<WelcomeAgentReadiness, string> = {
  ready: "border-border bg-card text-foreground",
  attention: "border-warning/45 bg-card text-foreground",
  missing: "border-border/70 bg-card/60 text-muted-foreground",
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts up to `target` while the cards settle. Honest at every frame: it only
 * ever counts toward the real total, and reduced-motion clients start there.
 */
function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const frameRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || target <= 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const duration = Math.min(320 + target * 90, 1000);
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return value;
}

export function WelcomeProviderRing({
  providers,
  installedCount,
}: {
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly installedCount: number;
}) {
  const layout = welcomeRingLayout(providers.length);
  const counted = useCountUp(installedCount);

  return (
    <div
      className="welcome-provider-stage relative mx-auto aspect-square w-full max-w-[560px]"
      style={{ "--orbit-radius": layout.radius } as CSSProperties}
    >
      <div aria-hidden className="absolute inset-0">
        <span className="welcome-provider-track absolute inset-[10%] rounded-full border border-border/80" />
        <span className="absolute inset-[24%] rounded-full border border-border/40" />

        {providers.map((provider, index) => {
          const driver = getDriverOption(provider.driver);
          const summary = summarizeWelcomeAgent(provider);
          const Icon = driver?.icon;
          const label = provider.displayName ?? driver?.label ?? provider.instanceId;
          const angle = layout.angles[index] ?? 0;
          return (
            <div
              key={provider.instanceId}
              className="welcome-provider-tile absolute top-1/2 left-1/2 z-10"
              style={
                {
                  "--orbit-angle": `${angle}deg`,
                  animationDelay: `${index * 90}ms`,
                  width: layout.tilePx,
                  height: layout.tilePx,
                  marginTop: -layout.tilePx / 2,
                  marginLeft: -layout.tilePx / 2,
                } as CSSProperties
              }
            >
              <div
                className={cn(
                  "grid h-full w-full place-items-center gap-1.5 rounded-2xl border px-2 pt-2.5 pb-2 shadow-[0_10px_28px_rgb(0_0_0/0.18)]",
                  TILE_TONE[summary.readiness],
                )}
              >
                {Icon ? <Icon className="size-5" aria-hidden /> : null}
                <span className="max-w-full truncate text-center text-[11px] font-medium tracking-tight">
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="welcome-detected pointer-events-none absolute inset-0 z-20 grid place-items-center">
        <div className="grid justify-items-center gap-1 text-center">
          <p className="font-heading text-[clamp(2.75rem,7.5vw,4.25rem)] leading-none font-semibold tracking-[-0.04em] text-foreground tabular-nums">
            {installedCount > 0 ? counted : "—"}
          </p>
          <p className="max-w-[9rem] text-sm leading-snug text-muted-foreground">
            {installedCount === 1
              ? "provider detected"
              : installedCount > 1
                ? "providers detected"
                : "scanning this machine"}
          </p>
        </div>
      </div>
    </div>
  );
}
