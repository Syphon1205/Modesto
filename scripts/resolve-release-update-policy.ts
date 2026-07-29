// FILE: resolve-release-update-policy.ts
// Purpose: Resolves release metadata for GitHub Actions from the checked-in lane policy.

import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  readReleaseUpdatePolicyConfig,
  resolveReleaseUpdatePolicy,
} from "./lib/release-update-policy.ts";
import { resolveDesktopReleaseVersion } from "./lib/desktop-app-version.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rawVersion = process.argv[2];
if (!rawVersion) throw new Error("Usage: node scripts/resolve-release-update-policy.ts <version>");

const policy = resolveReleaseUpdatePolicy(rawVersion, readReleaseUpdatePolicyConfig(repoRoot));
const desktopVersion = resolveDesktopReleaseVersion(policy.version);
const output = {
  version: policy.version,
  app_version: desktopVersion.appVersion,
  tag: policy.tag,
  is_prerelease: String(policy.isPrerelease),
  make_latest: String(policy.makeLatest),
  mirror_to_stable_channel: String(policy.mirrorToStableChannel),
  release_lane: policy.lane,
  bridge_tag: policy.bridgeTag,
  update_channel: policy.channel,
};

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  appendFileSync(
    githubOutput,
    `${Object.entries(output)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
} else {
  console.log(JSON.stringify(output, null, 2));
}
