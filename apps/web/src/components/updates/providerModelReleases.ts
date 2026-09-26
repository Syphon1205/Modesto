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

import {
  DEFAULT_MODEL_BY_PROVIDER,
  type ProviderDriverKind,
  type ServerProvider,
  type ServerProviderModel,
} from "@modesto/contracts";

/** Models already recorded for a provider, keyed by the provider's driver kind. */
export type SeenProviderModels = Readonly<Record<string, ReadonlyArray<string>>>;

export interface ProviderModelRelease {
  readonly driver: ProviderDriverKind;
  /** Provider display name, e.g. "Cursor". */
  readonly providerName: string;
  readonly model: ServerProviderModel;
}

const NON_CRUCIAL_PATTERNS: ReadonlyArray<RegExp> = [
  /\bembed/i,
  /\bembedding/i,
  /\bwhisper/i,
  /\btts\b/i,
  /\bimagen\b/i,
  /\bdall-e/i,
  /\bmoderation\b/i,
  /\bbison\b/i,
  /\bgecko\b/i,
  /\baudio\b/i,
  /\btranscription\b/i,
  /\bre-?rank/i,
];

const CRUCIAL_PATTERNS: ReadonlyArray<RegExp> = [
  // OpenAI / Codex flagships
  /\bgpt-[4-9]/i,
  /\bo[1-9](?:-mini|-preview|-plus|-max|\b)/i,
  /\bcodex\b/i,
  // Anthropic / Claude flagships
  /\bclaude-(?:3[.-][57]|[4-9])/i,
  /\b(?:sonnet|opus|fable)\b/i,
  // Google Gemini flagships
  /\bgemini-(?:2[.-][5-9]|[3-9]|pro|ultra|flash-thinking)/i,
  /\bauto-gemini\b/i,
  // xAI Grok flagships
  /\bgrok-[3-9]/i,
  /\bgrok-build\b/i,
  // DeepSeek flagships
  /\bdeepseek-(?:v[3-9]|r[1-9])/i,
  // Meta Llama flagships
  /\bllama-[3-9]/i,
  // Cursor flagships
  /\bcomposer-[1-9]/i,
  // Qwen & Mistral flagships
  /\bqwen-(?:2[.-]5|[3-9])/i,
  /\bmistral-(?:large|[2-9])/i,
];

/**
 * Distinguishes flagship/crucial model updates from minor/utility models
 * (e.g. embeddings, audio transcriptions, legacy utility checkpoints).
 */
export function isCrucialModel(model: ServerProviderModel, driver?: ProviderDriverKind): boolean {
  if (model.isDefault === true) return true;
  if (driver && DEFAULT_MODEL_BY_PROVIDER[driver] === model.slug) return true;

  const target = `${model.slug} ${model.name} ${model.shortName ?? ""}`;
  if (NON_CRUCIAL_PATTERNS.some((pattern) => pattern.test(target))) {
    return false;
  }
  return CRUCIAL_PATTERNS.some((pattern) => pattern.test(target));
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
 *
 * Releases are ordered so crucial/flagship models appear first.
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

  // Prioritize crucial/flagship models so lead announcements and toast icons
  // represent the most significant update in the batch.
  releases.sort((a, b) => {
    const aCrucial = isCrucialModel(a.model, a.driver);
    const bCrucial = isCrucialModel(b.model, b.driver);
    if (aCrucial && !bCrucial) return -1;
    if (!aCrucial && bCrucial) return 1;
    return 0;
  });

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
 * If the batch contains a crucial/flagship update, that model is named outright
 * and the rest are counted (e.g. "Grok 4.6 is out", "GPT-5 and 14 more models are out").
 * If the batch contains only non-crucial/utility models, it is summarized cleanly
 * (e.g. "15 new models are available") rather than picking an arbitrary minor model.
 */
export function describeProviderModelReleases(
  releases: ReadonlyArray<ProviderModelRelease>,
): string | null {
  if (releases.length === 0) return null;

  const crucial = releases.filter((r) => isCrucialModel(r.model, r.driver));
  const lead = crucial[0] ?? releases[0];

  if (releases.length === 1) {
    return `${lead.model.name} is out`;
  }

  if (crucial.length > 0) {
    const rest = releases.length - 1;
    return `${lead.model.name} and ${rest} more model${rest === 1 ? "" : "s"} are out`;
  }

  return `${releases.length} new models are available`;
}

/**
 * Sub-line naming where the models showed up.
 *
 * When there are tons of models (>2), we summarize to avoid overwhelming the notification:
 * - If non-crucial: "Now available in Cursor."
 * - If crucial: highlights up to 2 crucial models and counts the rest:
 *   "Now available in Cursor: GPT-5 and 14 other models."
 */
export function describeProviderModelReleaseSource(
  releases: ReadonlyArray<ProviderModelRelease>,
): string | null {
  if (releases.length === 0) return null;

  const providerNames = [...new Set(releases.map((release) => release.providerName))];

  if (providerNames.length > 1) {
    return `Now available in ${providerNames.slice(0, -1).join(", ")} and ${providerNames.at(-1)}.`;
  }

  const providerName = providerNames[0];

  if (releases.length === 1) {
    return `Now available in ${providerName}.`;
  }

  const crucial = releases.filter((r) => isCrucialModel(r.model, r.driver));
  const nonCrucial = releases.filter((r) => !isCrucialModel(r.model, r.driver));
  const sortedReleases = [...crucial, ...nonCrucial];

  if (releases.length === 2) {
    return `Now available in ${providerName}: ${sortedReleases[0].model.name} and ${sortedReleases[1].model.name}.`;
  }

  // When releases.length > 2 ("tons of models")
  if (crucial.length === 0) {
    return `Now available in ${providerName}.`;
  }

  if (crucial.length === 1) {
    const rest = releases.length - 1;
    return `Now available in ${providerName}: ${crucial[0].model.name} and ${rest} other model${
      rest === 1 ? "" : "s"
    }.`;
  }

  const rest = releases.length - 2;
  return `Now available in ${providerName}: ${crucial[0].model.name}, ${crucial[1].model.name}, and ${rest} other model${
    rest === 1 ? "" : "s"
  }.`;
}
