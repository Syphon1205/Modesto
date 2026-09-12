import {
  formatRateLimitPercent,
  formatRateLimitReset,
  type RateLimitsSnapshot,
  type RateLimitWindowSnapshot,
} from "@modesto/shared/rateLimits";
import { GaugeIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

import { usageClockIsHot, usageClockRemainingPercent } from "./UsageClock.logic";

function windowColor(window: RateLimitWindowSnapshot): string {
  if (window.status === "rejected" || window.usedPercent >= 100) {
    return "var(--color-error)";
  }
  if (window.status === "allowed_warning" || window.usedPercent >= 90) {
    return "var(--color-warning)";
  }
  return "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)";
}

function RateLimitBar({ window }: { readonly window: RateLimitWindowSnapshot }) {
  const color = windowColor(window);
  const resetLabel = formatRateLimitReset(window.resetsAtMs);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 text-[11px] leading-4">
        <span className="font-medium text-muted-foreground">{window.label}</span>
        <span className="tabular-nums text-secondary-label">
          {formatRateLimitPercent(window.usedPercent)}
          {resetLabel ? (
            <>
              <span className="mx-1">·</span>
              resets in {resetLabel}
            </>
          ) : null}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(window.usedPercent)}
        aria-label={`${window.label} usage`}
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
          style={{
            width: `${Math.max(0, Math.min(100, window.usedPercent))}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Header usage clock. Click opens 5h / weekly account limits and reset times.
 * Thread context lives on the composer bubble, not here.
 */
export function UsageClock(props: {
  readonly modelDisplayName: string | null;
  readonly limits: RateLimitsSnapshot | null;
}) {
  const remaining = usageClockRemainingPercent({ limits: props.limits });
  const isHot = usageClockIsHot({ limits: props.limits });
  const modelLabel = props.modelDisplayName?.trim() || "Selected model";
  const windows = props.limits?.windows ?? [];
  const hasLimits = windows.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            className="shrink-0 [-webkit-app-region:no-drag]"
            aria-label={
              hasLimits
                ? `Usage for ${modelLabel}, ${remaining}% remaining`
                : `Usage for ${modelLabel}`
            }
          >
            <GaugeIcon
              className={cn("size-4", isHot ? "text-destructive" : "text-muted-foreground")}
            />
          </Button>
        }
      />
      <PopoverPopup
        side="bottom"
        align="end"
        sideOffset={8}
        viewportClassName="p-0"
        className="w-72 max-w-none rounded-2xl text-left whitespace-normal"
      >
        <div className="flex flex-col gap-3 p-3.5">
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground">Usage</div>
            <div className="mt-0.5 truncate text-sm font-medium text-foreground">{modelLabel}</div>
            {props.limits?.planType ? (
              <div className="mt-0.5 text-[11px] capitalize text-secondary-label">
                {props.limits.planType}
              </div>
            ) : null}
          </div>
          {windows.map((window) => (
            <RateLimitBar key={window.id} window={window} />
          ))}
          {windows.length === 0 ? (
            <div className="text-pretty text-[11px] text-secondary-label">
              5h and weekly limits appear here once this model reports them.
            </div>
          ) : null}
          {props.limits?.rateLimitReached ? (
            <div className="text-pretty text-[11px] font-medium text-destructive">
              A usage limit has been reached. Wait for reset or switch plans.
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
