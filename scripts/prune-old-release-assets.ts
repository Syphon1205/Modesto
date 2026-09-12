// FILE: prune-old-release-assets.ts
// Purpose: Strips downloadable assets from every published release except the
// current GitHub Latest updater feed (and any explicitly protected tags). This
// keeps exactly one authoritative desktop updater feed so clients on older
// versions are never pointed at a stale release manifest.
//
// Usage:
//   node scripts/prune-old-release-assets.ts [--repo owner/repo] [--keep-tag vX.Y.Z]... [--dry-run]
//
// The repository defaults to $MODESTO_RELEASE_REPOSITORY. Authentication uses
// the ambient `gh` login (or $GH_TOKEN in CI). Requires write access to the
// distribution repository.

import { execFileSync } from "node:child_process";

import { planReleaseAssetPrune, type ReleaseAssetSummary } from "./lib/release-asset-prune.ts";

interface CliOptions {
  readonly repo: string;
  readonly keepTags: readonly string[];
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const keepTags: string[] = [];
  let repo = process.env.MODESTO_RELEASE_REPOSITORY?.trim() ?? "";
  let dryRun = false;

  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    index += 1;
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--repo") {
      const value = argv[index];
      index += 1;
      if (!value) throw new Error("--repo requires a value (owner/repo).");
      repo = value.trim();
    } else if (arg?.startsWith("--repo=")) {
      repo = arg.slice("--repo=".length).trim();
    } else if (arg === "--keep-tag") {
      const value = argv[index];
      index += 1;
      if (!value) throw new Error("--keep-tag requires a value.");
      keepTags.push(value.trim());
    } else if (arg?.startsWith("--keep-tag=")) {
      keepTags.push(arg.slice("--keep-tag=".length).trim());
    } else {
      throw new Error(`Unknown argument: ${String(arg)}`);
    }
  }

  if (!repo) {
    throw new Error(
      "Missing repository. Pass --repo owner/repo or set MODESTO_RELEASE_REPOSITORY.",
    );
  }
  return { repo, keepTags, dryRun };
}

function gh(args: readonly string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function resolveLatestTag(repo: string): string | null {
  try {
    return gh(["api", `repos/${repo}/releases/latest`, "--jq", ".tag_name"]).trim() || null;
  } catch {
    // No published Latest release (all drafts/prereleases): fail safe upstream.
    return null;
  }
}

function listReleases(repo: string): readonly ReleaseAssetSummary[] {
  const raw = gh(["api", "--paginate", `repos/${repo}/releases?per_page=100`]);
  const parsed = JSON.parse(raw) as ReadonlyArray<{
    tag_name?: unknown;
    draft?: unknown;
    assets?: ReadonlyArray<{ name?: unknown }>;
  }>;
  return parsed.map((release) => ({
    tagName: typeof release.tag_name === "string" ? release.tag_name : "",
    isDraft: release.draft === true,
    assetNames: (release.assets ?? [])
      .map((asset) => (typeof asset.name === "string" ? asset.name : ""))
      .filter((name) => name.length > 0),
  }));
}

function main(argv: readonly string[]): void {
  const options = parseArgs(argv);
  const latestTag = resolveLatestTag(options.repo);
  const releases = listReleases(options.repo);
  const plan = planReleaseAssetPrune(releases, {
    latestTag,
    keepTags: options.keepTags,
  });

  const kept = [latestTag, ...options.keepTags].filter((tag): tag is string => Boolean(tag));
  console.log(`Pruning release assets on ${options.repo}. Keeping feed(s): ${kept.join(", ")}.`);

  if (plan.length === 0) {
    console.log("No older release assets to remove.");
    return;
  }

  const totalAssets = plan.reduce((sum, entry) => sum + entry.assetNames.length, 0);
  console.log(
    `${options.dryRun ? "[dry-run] Would remove" : "Removing"} ${totalAssets} asset(s) across ${plan.length} release(s).`,
  );

  for (const entry of plan) {
    for (const assetName of entry.assetNames) {
      if (options.dryRun) {
        console.log(`[dry-run] ${entry.tagName}: ${assetName}`);
        continue;
      }
      console.log(`${entry.tagName}: deleting ${assetName}`);
      gh(["release", "delete-asset", entry.tagName, assetName, "--repo", options.repo, "--yes"]);
    }
  }
}

main(process.argv.slice(2));
