// FILE: providerModelReleases.ts
// Purpose: Spot models a provider has started offering that this install has
//          never seen, so "Grok 4.6 is out" can be announced the moment the
//          provider starts serving it.
// Layer: Updates (pure)
//
// Provider models are discovered, not hardcoded: each provider reports the
// models it can serve (`ServerProvider.models`), and that list changes when the
// vendor ships one - no Modesto release required. So "new model" is simply a
// slug in today's list that is not in the set this install has already seen.
//
// Two rules make that honest rather than noisy:
//
//   1. The first time a provider is ever seen, its whole model list is recorded
//      silently. A fresh install must not announce sixty models as news.
//   2. Custom models (the user's own entries) are never announced. The user
//      typed them; they are not a release.

import type { ProviderDriverKind, ServerProvider, ServerProviderModel } from "@modesto/contracts";

/** Models already recorded for a provider, keyed by the provider's driver kind. */
export type SeenProviderModels = Readonly<Record<string, ReadonlyArray<string>>>;

export interface ProviderModelRelease {
  readonly driver: ProviderDriverKind;
  /** Provider display name, e.g. "Cursor". */
  readonly providerName: string;
  readonly model: ServerProviderModel;
}

/** Announcable models: vendor-served, non-legacy, and named. */
function announcableModels(provider: ServerProvider): ReadonlyArray<ServerProviderModel> {
  return provider.models.filter((model) => !model.isCustom && model.isLegacy !== true);
}

/**
 * Slugs currently on offer per provider - the value to persist after an
 * announcement so the same model is never announced twice.
 */
export function currentProviderModelSlugs(
  providers: ReadonlyArray<ServerProvider>,
): SeenProviderModels {
  const next: Record<string, ReadonlyArray<string>> = {};
  for (const provider of providers) {
    const slugs = announcableModels(provider).map((model) => model.slug);
    if (slugs.length === 0) continue;
    const existing = next[provider.driver];
    next[provider.driver] = existing ? [...new Set([...existing, ...slugs])] : slugs;
  }
  return next;
}

/**
 * Models on offer now that are absent from `seen`.
 *
 * A provider missing from `seen` entirely is being observed for the first time,
 * so it yields nothing - see rule 1 above. A provider that is present but is
 * currently reporting no models (its CLI is down, or a probe failed) also
 * yields nothing, because "the list got shorter" is not evidence about what is
 * new.
 */
export function detectNewProviderModels(input: {
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly seen: SeenProviderModels;
}): ReadonlyArray<ProviderModelRelease> {
  const releases: ProviderModelRelease[] = [];
  const announced = new Set<string>();

  for (const provider of input.providers) {
    const seenSlugs = input.seen[provider.driver];
    if (seenSlugs === undefined) continue;

    const models = announcableModels(provider);
    if (models.length === 0) continue;

    const seenSet = new Set(seenSlugs);
    for (const model of models) {
      // One announcement per model, even when several provider instances of the
      // same driver report it.
      const dedupeKey = `${provider.driver}:${model.slug}`;
      if (seenSet.has(model.slug) || announced.has(dedupeKey)) continue;
      announced.add(dedupeKey);
      releases.push({
        driver: provider.driver,
        providerName: provider.displayName?.trim() || provider.driver,
        model,
      });
    }
  }

  return releases;
}

/** Stable key for a set of releases, so one batch is announced exactly once. */
export function providerModelReleaseKey(
  releases: ReadonlyArray<ProviderModelRelease>,
): string | null {
  if (releases.length === 0) return null;
  return releases
    .map((release) => `${release.driver}:${release.model.slug}`)
    .sort()
    .join("|");
}

/**
 * Headline for a batch of releases.
 *
 * One model is named outright - "Grok 4.6 is out" is the whole point of this
 * notification, and a generic "1 new model" would bury it.
 */
export function describeProviderModelReleases(
  releases: ReadonlyArray<ProviderModelRelease>,
): string | null {
  const first = releases[0];
  if (!first) return null;
  if (releases.length === 1) {
    return `${first.model.name} is out`;
  }
  return `${first.model.name} and ${releases.length - 1} more model${
    releases.length - 1 === 1 ? "" : "s"
  } are out`;
}

/** Sub-line naming where the models showed up. */
export function describeProviderModelReleaseSource(
  releases: ReadonlyArray<ProviderModelRelease>,
): string | null {
  const first = releases[0];
  if (!first) return null;
  const providerNames = [...new Set(releases.map((release) => release.providerName))];
  if (providerNames.length === 1) {
    return releases.length === 1
      ? `Now available in ${providerNames[0]}.`
      : `Now available in ${providerNames[0]}: ${releases.map((r) => r.model.name).join(", ")}.`;
  }
  return `Now available in ${providerNames.slice(0, -1).join(", ")} and ${providerNames.at(-1)}.`;
}
