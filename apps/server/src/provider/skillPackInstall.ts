import * as NodeOS from "node:os";

import type {
  InstalledSkillPack,
  SkillPackProvider,
  SkillPackProviderEligibility,
} from "@modesto/contracts";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import type { SkillPackBundle, SkillPackFile } from "./skillPackBundle.ts";

export class SkillPackInstallError extends Data.TaggedError("SkillPackInstallError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

interface InstalledSkillPackRecord extends InstalledSkillPack {
  readonly directories: readonly string[];
}
interface SkillPackRegistry {
  packs: Record<string, InstalledSkillPackRecord>;
}

const registryPath = (path: Path.Path, baseDir: string) => path.join(baseDir, "skill-packs.json");
const canonicalRoot = (path: Path.Path, baseDir: string, packId: string) =>
  path.join(baseDir, "skill-packs", packId);
const providerRoot = (path: Path.Path, provider: SkillPackProvider) =>
  path.join(NodeOS.homedir(), provider === "codex" ? ".codex" : ".claude", "skills");

export function skillPackSkillDirectoryName(
  source: { readonly owner: string; readonly repo: string },
  slug: string,
): string {
  return `${source.owner}-${source.repo}-${slug}`.toLowerCase();
}

export const defaultSkillPackEligibility = (
  providers: readonly SkillPackProvider[],
): SkillPackProviderEligibility[] =>
  providers.map((provider) => ({ provider, eligible: true, collisionDirectory: null }));

const readRegistry = Effect.fn("readSkillPackRegistry")(function* (baseDir: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const raw = yield* fileSystem
    .readFileString(registryPath(path, baseDir))
    .pipe(Effect.orElseSucceed((): string | undefined => undefined));
  if (!raw) return { packs: {} } satisfies SkillPackRegistry;
  try {
    const value = JSON.parse(raw) as Partial<SkillPackRegistry>;
    if (value.packs && typeof value.packs === "object") return value as SkillPackRegistry;
  } catch {
    // A damaged registry must not hide skills already on disk or block repair.
  }
  return { packs: {} } satisfies SkillPackRegistry;
});

const writeRegistry = Effect.fn("writeSkillPackRegistry")(function* (
  baseDir: string,
  registry: SkillPackRegistry,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = registryPath(path, baseDir);
  yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  yield* fileSystem.writeFileString(temporary, `${JSON.stringify(registry, null, 2)}\n`);
  yield* fileSystem.rename(temporary, target);
});

function safeRelativePath(relativePath: string): boolean {
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith("/") &&
    !relativePath.startsWith("\\") &&
    !relativePath.split(/[\\/]/).some((part) => part === "..")
  );
}

function isWithin(path: Path.Path, root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function isSafeTrackedDirectory(path: Path.Path, baseDir: string, directory: string): boolean {
  return (
    isWithin(path, path.join(baseDir, "skill-packs"), directory) ||
    isWithin(path, providerRoot(path, "codex"), directory) ||
    isWithin(path, providerRoot(path, "claude"), directory) ||
    // Provider-root overrides are test/development-only and live inside the
    // isolated Modesto base directory.
    isWithin(path, baseDir, directory)
  );
}

function packDestinations(input: {
  readonly path: Path.Path;
  readonly bundle: SkillPackBundle;
  readonly baseDir: string;
  readonly providers: readonly SkillPackProvider[];
  readonly providerRoots?: Partial<Record<SkillPackProvider, string>> | undefined;
}): {
  readonly packRoot: string;
  readonly directories: readonly string[];
  readonly providerDirectories: ReadonlyArray<{
    readonly provider: SkillPackProvider;
    readonly directory: string;
    readonly files: readonly SkillPackFile[];
  }>;
} {
  const packRoot = canonicalRoot(input.path, input.baseDir, input.bundle.preview.packId);
  const directories = [packRoot];
  const providerDirectories: Array<{
    provider: SkillPackProvider;
    directory: string;
    files: readonly SkillPackFile[];
  }> = [];
  for (const provider of input.providers) {
    const root = input.providerRoots?.[provider] ?? providerRoot(input.path, provider);
    for (const skill of input.bundle.skills) {
      const directory = input.path.join(
        root,
        skillPackSkillDirectoryName(input.bundle.preview.source, skill.slug),
      );
      directories.push(directory);
      providerDirectories.push({ provider, directory, files: skill.files });
    }
  }
  return { packRoot, directories, providerDirectories };
}

const writeSkillTree = Effect.fn("writeSkillPackTree")(function* (
  destination: string,
  files: readonly SkillPackFile[],
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const file of files) {
    if (!safeRelativePath(file.path)) {
      return yield* new SkillPackInstallError({
        message: `Unsafe path in skill pack: ${file.path}`,
      });
    }
    const target = path.join(destination, file.path);
    yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
    yield* fileSystem.writeFile(target, file.content);
  }
});

const replaceDirectoryAtomically = Effect.fn("replaceSkillPackDirectory")(function* (
  destination: string,
  files: readonly SkillPackFile[],
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const staging = `${destination}.modesto-staging-${process.pid}-${Date.now()}`;
  const backup = `${destination}.modesto-backup-${process.pid}-${Date.now()}`;

  yield* writeSkillTree(staging, files).pipe(
    Effect.tapError(() =>
      fileSystem.remove(staging, { recursive: true, force: true }).pipe(Effect.ignore),
    ),
  );

  const existed = yield* fileSystem.exists(destination);
  yield* Effect.gen(function* () {
    if (existed) yield* fileSystem.rename(destination, backup);
    yield* fileSystem.rename(staging, destination);
  }).pipe(
    Effect.tapError(() =>
      Effect.gen(function* () {
        const destExists = yield* fileSystem.exists(destination);
        if (!destExists && (yield* fileSystem.exists(backup))) {
          yield* fileSystem.rename(backup, destination).pipe(Effect.ignore);
        }
        yield* fileSystem.remove(staging, { recursive: true, force: true }).pipe(Effect.ignore);
      }),
    ),
  );
  if (existed) {
    yield* fileSystem.remove(backup, { recursive: true, force: true }).pipe(Effect.ignore);
  }
});

export const previewSkillPackEligibility = Effect.fn("previewSkillPackEligibility")(
  function* (input: {
    readonly bundle: SkillPackBundle;
    readonly baseDir: string;
    readonly providers: readonly SkillPackProvider[];
    readonly providerRoots?: Partial<Record<SkillPackProvider, string>> | undefined;
  }) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const registry = yield* readRegistry(input.baseDir);
    const previous = registry.packs[input.bundle.preview.packId];
    const tracked = new Set(previous?.directories ?? []);
    const { providerDirectories } = packDestinations({
      path,
      bundle: input.bundle,
      baseDir: input.baseDir,
      providers: input.providers,
      providerRoots: input.providerRoots,
    });

    const eligibility: SkillPackProviderEligibility[] = [];
    for (const provider of input.providers) {
      let collisionDirectory: string | null = null;
      for (const candidate of providerDirectories.filter((entry) => entry.provider === provider)) {
        if ((yield* fileSystem.exists(candidate.directory)) && !tracked.has(candidate.directory)) {
          collisionDirectory = candidate.directory;
          break;
        }
      }
      eligibility.push({
        provider,
        eligible: collisionDirectory === null,
        collisionDirectory,
      });
    }
    return eligibility;
  },
);

export const installSkillPack = Effect.fn("installSkillPack")(function* (input: {
  readonly bundle: SkillPackBundle;
  readonly baseDir: string;
  readonly providers: readonly SkillPackProvider[];
  readonly providerRoots?: Partial<Record<SkillPackProvider, string>> | undefined;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const registry = yield* readRegistry(input.baseDir);
  const previous = registry.packs[input.bundle.preview.packId];
  const { packRoot, directories, providerDirectories } = packDestinations({
    path,
    bundle: input.bundle,
    baseDir: input.baseDir,
    providers: input.providers,
    providerRoots: input.providerRoots,
  });
  const tracked = new Set(previous?.directories ?? []);

  if (!previous) {
    for (const directory of directories) {
      if (yield* fileSystem.exists(directory)) {
        return yield* new SkillPackInstallError({
          message: `Refusing to overwrite an untracked skill directory: ${directory}`,
        });
      }
    }
  } else {
    for (const directory of directories) {
      if ((yield* fileSystem.exists(directory)) && !tracked.has(directory)) {
        return yield* new SkillPackInstallError({
          message: `Refusing to overwrite an untracked skill directory: ${directory}`,
        });
      }
    }
  }

  const canonicalFiles = input.bundle.skills.flatMap((skill) =>
    skill.files.map((file) => ({
      path: `${skill.slug}/${file.path}`,
      content: file.content,
    })),
  );

  yield* Effect.gen(function* () {
    yield* replaceDirectoryAtomically(packRoot, canonicalFiles);
    for (const destination of providerDirectories) {
      yield* replaceDirectoryAtomically(destination.directory, destination.files);
    }
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof SkillPackInstallError
        ? cause
        : new SkillPackInstallError({ message: "Failed to write skill pack files.", cause }),
    ),
  );

  if (previous) {
    for (const directory of previous.directories) {
      if (
        !directories.includes(directory) &&
        isSafeTrackedDirectory(path, input.baseDir, directory)
      ) {
        yield* fileSystem.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore);
      }
    }
  }

  const { eligibility: _eligibility, warnings: _warnings, ...preview } = input.bundle.preview;
  const installed: InstalledSkillPackRecord = {
    ...preview,
    providers: [...input.providers],
    installedAt: new Date().toISOString(),
    directories,
  };
  registry.packs[input.bundle.preview.packId] = installed;
  yield* writeRegistry(input.baseDir, registry).pipe(
    Effect.mapError(
      (cause) =>
        new SkillPackInstallError({ message: "Failed to update skill pack registry.", cause }),
    ),
  );
  return installed;
});

export const listInstalledSkillPacks = Effect.fn("listInstalledSkillPacks")(function* (
  baseDir: string,
) {
  const registry = yield* readRegistry(baseDir);
  return Object.values(registry.packs).toSorted((a, b) => a.name.localeCompare(b.name));
});

export const uninstallSkillPack = Effect.fn("uninstallSkillPack")(function* (input: {
  readonly packId: string;
  readonly baseDir: string;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const registry = yield* readRegistry(input.baseDir);
  const installed = registry.packs[input.packId];
  if (!installed) return;
  for (const directory of installed.directories) {
    if (isSafeTrackedDirectory(path, input.baseDir, directory)) {
      yield* fileSystem.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore);
    }
  }
  delete registry.packs[input.packId];
  yield* writeRegistry(input.baseDir, registry).pipe(
    Effect.mapError(
      (cause) =>
        new SkillPackInstallError({ message: "Failed to update skill pack registry.", cause }),
    ),
  );
});

export const installedSkillPackSummary = (pack: InstalledSkillPackRecord): InstalledSkillPack => ({
  packId: pack.packId,
  name: pack.name,
  source: pack.source,
  skills: pack.skills,
  providers: pack.providers,
  installedAt: pack.installedAt,
});
