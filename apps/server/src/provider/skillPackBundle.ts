import { createHash } from "node:crypto";

import type { SkillPackPreview, SkillPackProvider, SkillPackSkill } from "@modesto/contracts";

import {
  ClaudePluginBundleError,
  fetchGithubBytes,
  fetchGithubText,
  fetchRepoTree,
  mapWithConcurrency,
  parseClaudePluginSource,
  rawFileUrl,
  resolveGithubCommitSha,
  resolveRefAndTree,
  type ClaudePluginSource,
} from "./claudePluginBundle.ts";
import { parseSkillFrontmatter } from "./Drivers/ClaudeSkills.ts";

const MAX_SKILLS = 50;
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
export const SKILL_PACK_PROVIDERS = [
  "codex",
  "claude",
] as const satisfies readonly SkillPackProvider[];

export class SkillPackBundleError extends Error {
  readonly code:
    | "invalid_source_url"
    | "source_fetch_failed"
    | "source_ref_not_found"
    | "pack_empty"
    | "pack_too_large";

  constructor(
    code:
      | "invalid_source_url"
      | "source_fetch_failed"
      | "source_ref_not_found"
      | "pack_empty"
      | "pack_too_large",
    message: string,
  ) {
    super(message);
    this.name = "SkillPackBundleError";
    this.code = code;
  }
}

export interface SkillPackFile {
  readonly path: string;
  readonly content: Uint8Array;
}

export interface SkillPackResolvedSkill extends SkillPackSkill {
  readonly slug: string;
  readonly files: readonly SkillPackFile[];
}

export interface SkillPackBundle {
  readonly preview: SkillPackPreview;
  readonly skills: readonly SkillPackResolvedSkill[];
}

const slugify = (value: string, fallback: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || fallback;
};

function mapSourceError(error: unknown): SkillPackBundleError {
  if (error instanceof SkillPackBundleError) return error;
  if (error instanceof ClaudePluginBundleError) {
    if (error.code === "invalid_plugin_url") {
      return new SkillPackBundleError("invalid_source_url", error.message);
    }
    if (error.code === "plugin_ref_not_found") {
      return new SkillPackBundleError("source_ref_not_found", error.message);
    }
    return new SkillPackBundleError("source_fetch_failed", error.message);
  }
  return new SkillPackBundleError(
    "source_fetch_failed",
    error instanceof Error ? error.message : String(error),
  );
}

function sourcePathWithinDir(path: string, dir: string | null): boolean {
  if (!dir) return true;
  const prefix = `${dir.replace(/\/+$/, "")}/`;
  return path.startsWith(prefix);
}

function rootForSkill(path: string): string {
  return path === "SKILL.md" ? "" : path.slice(0, -"SKILL.md".length);
}

function relativeToRoot(path: string, root: string): string {
  return root ? path.slice(root.length) : path;
}

async function resolveSource(input: { readonly url: string; readonly ref?: string | undefined }) {
  const source = parseClaudePluginSource(input.url);
  const resolved = await resolveRefAndTree(source, input.ref?.trim() || undefined);
  const revision = await resolveGithubCommitSha(source, resolved.ref);
  return {
    source,
    requestedRef: resolved.ref,
    revision,
    dir: resolved.dir,
    tree: await fetchRepoTree(source, revision),
  };
}

function packIdFor(source: ClaudePluginSource, dir: string | null): string {
  const identity = `${source.owner.toLowerCase()}/${source.repo.toLowerCase()}/${dir ?? ""}`;
  return `skillpack_${createHash("sha256").update(identity).digest("hex").slice(0, 20)}`;
}

/** Resolve a conventional SKILL.md repository without assuming a provider-specific manifest. */
export async function resolveSkillPackBundle(input: {
  readonly url: string;
  readonly ref?: string | undefined;
  readonly includeFiles?: boolean;
}): Promise<SkillPackBundle> {
  try {
    const resolved = await resolveSource(input);
    const entrypoints = resolved.tree
      .map((entry) => entry.path)
      .filter(
        (path) =>
          (path === "SKILL.md" || path.endsWith("/SKILL.md")) &&
          sourcePathWithinDir(path, resolved.dir),
      )
      .toSorted();
    if (entrypoints.length === 0) {
      throw new SkillPackBundleError(
        "pack_empty",
        "No SKILL.md files were found in this repository or directory.",
      );
    }
    if (entrypoints.length > MAX_SKILLS) {
      throw new SkillPackBundleError(
        "pack_too_large",
        `This pack contains ${entrypoints.length} skills; the limit is ${MAX_SKILLS}.`,
      );
    }

    const roots = entrypoints.map(rootForSkill);
    const warnings: string[] = [];
    const usedSlugs = new Set<string>();
    const skills = await mapWithConcurrency(entrypoints, 6, async (entrypoint) => {
      const root = rootForSkill(entrypoint);
      const skillText = await fetchGithubText(
        rawFileUrl(resolved.source, resolved.revision, entrypoint),
      );
      const frontmatter = parseSkillFrontmatter(skillText);
      const fallbackName = root.split("/").filter(Boolean).at(-1) ?? resolved.source.repo;
      const parsedName = frontmatter.kind === "parsed" ? frontmatter.name : undefined;
      const name = parsedName?.trim() || fallbackName;
      let slug = slugify(name, "skill");
      if (usedSlugs.has(slug)) {
        slug = `${slug}-${createHash("sha1").update(entrypoint).digest("hex").slice(0, 6)}`;
        warnings.push(`Two skills resolve to the same name; ${entrypoint} was namespaced.`);
      }
      usedSlugs.add(slug);
      const description =
        frontmatter.kind === "parsed" ? frontmatter.description?.trim() || null : null;
      if (frontmatter.kind !== "parsed") {
        warnings.push(`${entrypoint} has invalid YAML frontmatter; its folder name was used.`);
      }

      const childRootPrefixes = roots.filter(
        (candidate) => candidate !== root && candidate.startsWith(root),
      );
      const filePaths = resolved.tree
        .map((entry) => entry.path)
        .filter(
          (path) =>
            path.startsWith(root) &&
            !childRootPrefixes.some((child) => path.startsWith(child)) &&
            !relativeToRoot(path, root)
              .split("/")
              .some((part) => part === ".."),
        )
        .toSorted();
      return {
        name,
        description,
        sourcePath: entrypoint,
        fileCount: filePaths.length,
        slug,
        files: input.includeFiles
          ? await mapWithConcurrency(filePaths, 6, async (path) => ({
              path: relativeToRoot(path, root),
              content: await fetchGithubBytes(rawFileUrl(resolved.source, resolved.revision, path)),
            }))
          : [],
      } satisfies SkillPackResolvedSkill;
    });

    const fileCount = skills.reduce((sum, skill) => sum + skill.fileCount, 0);
    if (fileCount > MAX_FILES) {
      throw new SkillPackBundleError(
        "pack_too_large",
        `This pack contains ${fileCount} files; the limit is ${MAX_FILES}.`,
      );
    }
    const totalBytes = skills.reduce(
      (sum, skill) => sum + skill.files.reduce((inner, file) => inner + file.content.byteLength, 0),
      0,
    );
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new SkillPackBundleError(
        "pack_too_large",
        `This pack is ${(totalBytes / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.`,
      );
    }

    const dirName = resolved.dir?.split("/").filter(Boolean).at(-1);
    const name = dirName ? `${resolved.source.repo}/${dirName}` : resolved.source.repo;
    const preview: SkillPackPreview = {
      packId: packIdFor(resolved.source, resolved.dir),
      name,
      source: {
        owner: resolved.source.owner,
        repo: resolved.source.repo,
        requestedRef: resolved.requestedRef,
        revision: resolved.revision,
        dir: resolved.dir,
      },
      skills: skills.map(({ name, description, sourcePath, fileCount }) => ({
        name,
        description,
        sourcePath,
        fileCount,
      })),
      providers: [...SKILL_PACK_PROVIDERS],
      eligibility: SKILL_PACK_PROVIDERS.map((provider) => ({
        provider,
        eligible: true,
        collisionDirectory: null,
      })),
      warnings,
    };
    return { preview, skills };
  } catch (error) {
    throw mapSourceError(error);
  }
}
