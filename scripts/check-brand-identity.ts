// FILE: check-brand-identity.ts
// Purpose: Prevents retired first-party identities from returning to tracked files.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const characters = (...codes: number[]): string => String.fromCharCode(...codes);
const retiredShortName = characters(116, 51);
const retiredSecondName = characters(100, 112, 99, 111, 100, 101);
const retiredPredecessorName = characters(99, 111, 100, 101, 116, 104, 105, 110, 103);
const incorrectBundleDomain = characters(99, 111, 109, 46, 115, 121, 110, 97, 114, 97);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const joinedWithOptionalSeparator = (left: string, right: string): string =>
  `${escapeRegExp(left)}[\\s._/@:-]*${escapeRegExp(right)}`;

// Match product display names and public destinations. Internal identifiers such as
// T3_PROJECT_FILE, .t3 state directories and t3.json are compatibility contracts,
// not product branding; changing them needs a separate data/protocol migration.
const forbiddenPatterns = [
  new RegExp(joinedWithOptionalSeparator(retiredShortName, "code"), "i"),
  new RegExp(joinedWithOptionalSeparator(retiredShortName, "tools"), "i"),
  new RegExp(
    joinedWithOptionalSeparator(retiredSecondName.slice(0, 2), retiredSecondName.slice(2)),
    "i",
  ),
  new RegExp(escapeRegExp(retiredPredecessorName), "i"),
  new RegExp(escapeRegExp(incorrectBundleDomain), "i"),
] as const;

// These are retained provenance, not claims that the upstream project is Modesto.
// Keep exceptions limited to the credited name; other retired identities still fail.
const upstreamCreditPaths = new Set([
  "LICENSE",
  "ACKNOWLEDGEMENTS.md",
  "THIRD_PARTY_NOTICES.md",
  "CHANGELOG.md",
  "apps/marketing/src/pages/third-party.astro",
  "apps/marketing/src/pages/docs.astro",
  "apps/marketing/src/pages/docs/development.astro",
]);

function searchableBrandText(path: string, line: string): string {
  if (upstreamCreditPaths.has(path)) {
    line = line.replace(/\bT3 (?:Code|Tools)(?: Inc\.)?/g, "upstream");
  }
  // Source identifiers are not display names. Preserve the scan of string values.
  line = line.replace(/\bT3_[A-Z0-9_]+\b/g, "identifier");
  if (/^apps\/server\/(?:src\/provider|src\/textGeneration)\//.test(path)) {
    // Native MCP server/client names remain stable for existing provider sessions.
    line = line.replace(/t3-code(?:-provider-probe|-git-text)?/g, "native-mcp");
  }
  if (path === "apps/web/src/uiStateStore.ts") {
    line = line.replace(/codething:renderer-state:v[1-4]/g, "legacy-state-key");
  }
  if (path === "packages/contracts/src/t3ProjectFile.ts") {
    line = line.replace(/https:\/\/t3\.codes\/schema\/t3\.json/g, "legacy-schema-url");
  }
  // Hosted upstream routing is outside the desktop release. This explicit list
  // does not permit upstream links in the app's download, help or update UI.
  if (path === "apps/web/vercel.ts" || path === "packages/shared/src/connectAuth.ts") {
    line = line.replace(
      /(?:https:\/\/)?(?:(?:latest|nightly)\.)?app\.t3\.codes/g,
      "hosted-compatibility-url",
    );
  }
  return line;
}

// Audited production icon. Obsolete upstream screenshots are not published.
const approvedVisualAssetDigests = new Map<string, string>([
  [
    "assets/prod/black-universal-1024.png",
    "b9c6adba2142770a2212305a03b709860851a75d641a355c3492932dd39091aa",
  ],
]);

export interface BrandIdentityFile {
  readonly path: string;
  readonly contents: string;
}

export interface BrandIdentityViolation {
  readonly path: string;
  readonly line: number | null;
  readonly text: string;
}

export interface BrandIdentityBinaryFile {
  readonly path: string;
  readonly contents: Uint8Array;
}

function containsForbiddenIdentity(value: string): boolean {
  return forbiddenPatterns.some((pattern) => pattern.test(value));
}

export function findBrandIdentityViolations(
  files: readonly BrandIdentityFile[],
): BrandIdentityViolation[] {
  const violations: BrandIdentityViolation[] = [];
  for (const file of files) {
    // Tests and historical PR evidence deliberately exercise old wire/storage names.
    if (file.path === "scripts/check-brand-identity.ts") continue;
    if (
      /(?:^|\/)(?:testFixtures|__fixtures__|pr-screenshots)\//.test(file.path) ||
      /\.(?:test|spec)\.[^.]+$/.test(file.path)
    )
      continue;
    if (containsForbiddenIdentity(file.path)) {
      violations.push({ path: file.path, line: null, text: file.path });
    }
    for (const [index, line] of file.contents.split(/\r?\n/).entries()) {
      if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
      if (!containsForbiddenIdentity(searchableBrandText(file.path, line))) continue;
      violations.push({ path: file.path, line: index + 1, text: line.trim() });
    }
  }
  return violations;
}

export function findVisualBrandAssetViolations(
  files: readonly BrandIdentityBinaryFile[],
  approvedDigests: ReadonlyMap<string, string> = approvedVisualAssetDigests,
): BrandIdentityViolation[] {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const violations: BrandIdentityViolation[] = [];
  for (const file of files) {
    if (
      /^apps\/marketing\/public\/.*screenshot.*\.(?:png|jpe?g|webp|gif)$/i.test(file.path) &&
      !approvedDigests.has(file.path)
    ) {
      violations.push({
        path: file.path,
        line: null,
        text: "Public screenshot needs a visual identity review and approved digest before publication.",
      });
    }
  }
  for (const [path, approvedDigest] of approvedDigests) {
    const file = filesByPath.get(path);
    if (!file) {
      violations.push({
        path,
        line: null,
        text: "Required visual brand asset is missing.",
      });
      continue;
    }
    const digest = createHash("sha256").update(file.contents).digest("hex");
    if (digest !== approvedDigest) {
      violations.push({
        path,
        line: null,
        text: "Visual brand asset changed; perform a visual identity review before approving it.",
      });
    }
  }
  return violations;
}

function readTrackedFiles(): BrandIdentityBinaryFile[] {
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter((path) => path !== "" && existsSync(path));
  return [...new Set(paths)].map((path) => ({ path, contents: readFileSync(path) }));
}

function main(): void {
  const trackedFiles = readTrackedFiles();
  const searchableFiles = trackedFiles.map((file) => ({
    path: file.path,
    contents: file.contents.includes(0) ? "" : Buffer.from(file.contents).toString("utf8"),
  }));
  const violations = [
    ...findBrandIdentityViolations(searchableFiles),
    ...findVisualBrandAssetViolations(trackedFiles),
  ];
  if (violations.length === 0) {
    console.log("Modesto identity check passed.");
    return;
  }

  console.error("Retired first-party identity found:");
  for (const violation of violations) {
    const location =
      violation.line === null ? violation.path : `${violation.path}:${violation.line}`;
    console.error(`- ${location}: ${violation.text}`);
  }
  process.exitCode = 1;
}

if (import.meta.main) main();
