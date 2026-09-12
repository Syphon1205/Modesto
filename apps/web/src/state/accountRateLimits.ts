import { mergeRateLimitsSnapshots, type RateLimitsSnapshot } from "@modesto/shared/rateLimits";

/**
 * Account 5h / weekly limits are not per-thread. Providers only push them
 * onto the thread that is running, so a new chat would otherwise look empty
 * until the next turn. Keep the last merged snapshot per environment +
 * provider instance and reuse it across threads.
 */
const snapshotsByAccount = new Map<string, RateLimitsSnapshot>();

export function accountRateLimitsCacheKey(
  environmentId: string | null | undefined,
  instanceId: string | null | undefined,
): string | null {
  const environment = environmentId?.trim();
  if (!environment) return null;
  const instance = instanceId?.trim();
  return instance ? `${environment}:${instance}` : environment;
}

export function resetAccountRateLimitsCache(): void {
  snapshotsByAccount.clear();
}

export function resolveVisibleRateLimits(input: {
  readonly cacheKey: string | null;
  readonly threadSnapshot: RateLimitsSnapshot | null;
}): RateLimitsSnapshot | null {
  const cached = input.cacheKey ? (snapshotsByAccount.get(input.cacheKey) ?? null) : null;
  const merged = mergeRateLimitsSnapshots(
    [cached, input.threadSnapshot].filter(
      (snapshot): snapshot is RateLimitsSnapshot => snapshot !== null,
    ),
  );
  if (input.cacheKey && input.threadSnapshot !== null && merged !== null) {
    snapshotsByAccount.set(input.cacheKey, merged);
  }
  return merged ?? cached ?? input.threadSnapshot;
}
