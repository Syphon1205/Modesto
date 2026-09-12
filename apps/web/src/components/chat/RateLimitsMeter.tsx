import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import {
  formatRateLimitPercent,
  formatRateLimitReset,
  type RateLimitsSnapshot,
  type RateLimitWindowSnapshot,
} from "@modesto/shared/rateLimits";

function windowColor(window: RateLimitWindowSnapshot): string {
  if (window.status === "rejected" || window.usedPercent >= 100) {
    return "var(--color-error)";
  }
  if (window.status === "allowed_warning" || window.usedPercent >= 90) {
    return "var(--color-warning)";
  }
  return "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)";
}

function compactSummary(snapshot: RateLimitsSnapshot): string {
  return snapshot.windows
    .map((window) => `${window.label} ${formatRateLimitPercent(window.usedPercent)}`)
    .join(" · ");
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
 * Compact account rate-limit meter for the chat composer footer.
 * Shows 5h / weekly (and Claude per-model weekly) windows when providers
 * push `account.rate-limits.updated`.
 */
export function RateLimitsMeter(props: { readonly limits: RateLimitsSnapshot }) {
  const { limits } = props;
  if (limits.windows.length === 0) return null;

  const peak = limits.windows.reduce((max, window) => Math.max(max, window.usedPercent), 0);
  const isHot = limits.rateLimitReached || peak >= 90;
  const fillColor = isHot
    ? "var(--color-error)"
    : "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)";
  const radius = 9.75;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, peak)) / 100);
  const summary = compactSummary(limits);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={0}
        render={
          <Button
            size="icon-sm"
            variant="ghost-muted"
            className="size-7 rounded-full hover:text-muted-foreground data-pressed:text-muted-foreground"
            aria-label={`Usage limits ${summary}`}
          >
            <span className="relative flex size-5 items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="-rotate-90 absolute inset-0 size-full transform-gpu mx-0!"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke="color-mix(in oklab, var(--color-muted-foreground) 24%, transparent)"
                  strokeWidth="3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke={fillColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-[stroke-dashoffset,stroke] duration-500 ease-out motion-reduce:transition-none"
                />
              </svg>
              <span className="text-[8px] font-semibold tabular-nums leading-none text-muted-foreground">
                {Math.round(Math.max(0, 100 - peak))}
              </span>
            </span>
          </Button>
        }
      />
      <PopoverPopup
        tooltipStyle
        side="top"
        align="end"
        viewportClassName="p-0"
        className="w-64 max-w-none text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2.5 p-[var(--floating-content-inset)]">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-muted-foreground text-xs">Usage limits</div>
            {limits.planType ? (
              <div className="text-secondary-label text-[11px] capitalize tabular-nums">
                {limits.planType}
              </div>
            ) : null}
          </div>
          {limits.windows.map((window) => (
            <RateLimitBar key={window.id} window={window} />
          ))}
          {limits.rateLimitReached ? (
            <div className="text-pretty text-[11px] font-medium text-destructive">
              A usage limit has been reached. Wait for reset or switch plans/accounts.
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
