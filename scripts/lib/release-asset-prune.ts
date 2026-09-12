// FILE: release-asset-prune.ts
// Purpose: Decides which published release assets to strip so only the current
// GitHub Latest updater feed (plus explicitly protected tags) keeps its files.
// Older releases that still ship *.yml manifests can point desktop clients at a
// stale feed and force an unwanted update, so their downloadable assets are
// removed while the release notes and tag stay intact.

export interface ReleaseAssetSummary {
  readonly tagName: string;
  readonly isDraft: boolean;
  readonly assetNames: readonly string[];
}

export interface ReleaseAssetPrunePlanOptions {
  // The tag currently served as GitHub "Latest". Its assets are always kept.
  readonly latestTag: string | null | undefined;
  // Additional tags whose assets must be preserved (for example the tag being
  // published in the current workflow run, so a run never deletes its own feed).
  readonly keepTags?: readonly string[];
}

export interface ReleaseAssetPruneEntry {
  readonly tagName: string;
  readonly assetNames: readonly string[];
}

// Refuses to plan any deletion when the authoritative feed cannot be
// identified. Deleting assets without a known Latest release would leave desktop
// clients with no updater manifest at all, which is worse than keeping stale
// files around.
export function planReleaseAssetPrune(
  releases: readonly ReleaseAssetSummary[],
  options: ReleaseAssetPrunePlanOptions,
): readonly ReleaseAssetPruneEntry[] {
  const latestTag = options.latestTag?.trim();
  if (!latestTag) {
    throw new Error(
      "Refusing to prune release assets: the current GitHub Latest release could not be resolved.",
    );
  }

  const keep = new Set<string>([latestTag]);
  for (const rawTag of options.keepTags ?? []) {
    const tag = rawTag.trim();
    if (tag.length > 0) keep.add(tag);
  }

  const plan: ReleaseAssetPruneEntry[] = [];
  for (const release of releases) {
    // Drafts have no public updater feed impact and may be work-in-progress, so
    // never touch them.
    if (release.isDraft) continue;
    if (keep.has(release.tagName)) continue;
    if (release.assetNames.length === 0) continue;
    plan.push({ tagName: release.tagName, assetNames: [...release.assetNames] });
  }
  return plan;
}
