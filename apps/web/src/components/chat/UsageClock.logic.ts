import type { RateLimitsSnapshot } from "@modesto/shared/rateLimits";

/**
 * Remaining capacity used for the usage button label and warning tint.
 *
 * This is the account quota people watch (5h first, then the hottest
 * reported window). Context fill lives on the composer bubble, not here.
 */
export function usageClockRemainingPercent(input: {
  readonly limits: RateLimitsSnapshot | null;
}): number {
  const fiveHour = input.limits?.windows.find((window) => window.id === "five_hour");
  const peak =
    input.limits && input.limits.windows.length > 0
      ? input.limits.windows.reduce((max, window) => Math.max(max, window.usedPercent), 0)
      : null;
  const used = fiveHour?.usedPercent ?? peak ?? 0;
  if (!Number.isFinite(used)) return 100;
  return Math.round(Math.max(0, Math.min(100, 100 - used)));
}

export function usageClockIsHot(input: { readonly limits: RateLimitsSnapshot | null }): boolean {
  if (input.limits?.rateLimitReached) return true;
  if (input.limits === null || input.limits.windows.length === 0) return false;
  return usageClockRemainingPercent(input) <= 10;
}
