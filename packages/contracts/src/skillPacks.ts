import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString, TrimmedString } from "./baseSchemas.ts";

export const SkillPackProvider = Schema.Literals(["codex", "claude"]);
export type SkillPackProvider = typeof SkillPackProvider.Type;

export const SkillPackSkill = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.NullOr(TrimmedString),
  sourcePath: TrimmedNonEmptyString,
  fileCount: Schema.Int,
});
export type SkillPackSkill = typeof SkillPackSkill.Type;

export const SkillPackSource = Schema.Struct({
  owner: TrimmedNonEmptyString,
  repo: TrimmedNonEmptyString,
  requestedRef: TrimmedNonEmptyString,
  revision: TrimmedNonEmptyString,
  dir: Schema.NullOr(TrimmedNonEmptyString),
});

export const SkillPackProviderEligibility = Schema.Struct({
  provider: SkillPackProvider,
  eligible: Schema.Boolean,
  collisionDirectory: Schema.NullOr(TrimmedNonEmptyString),
});
export type SkillPackProviderEligibility = typeof SkillPackProviderEligibility.Type;

export const SkillPackPreview = Schema.Struct({
  packId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: SkillPackSource,
  skills: Schema.Array(SkillPackSkill),
  providers: Schema.Array(SkillPackProvider),
  eligibility: Schema.Array(SkillPackProviderEligibility),
  warnings: Schema.Array(Schema.String),
});
export type SkillPackPreview = typeof SkillPackPreview.Type;

export const InstalledSkillPack = Schema.Struct({
  packId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: SkillPackSource,
  skills: Schema.Array(SkillPackSkill),
  providers: Schema.Array(SkillPackProvider),
  installedAt: TrimmedNonEmptyString,
});
export type InstalledSkillPack = typeof InstalledSkillPack.Type;

const SOURCE_URL = TrimmedNonEmptyString.check(Schema.isMaxLength(512));

export const SkillPackPreviewInput = Schema.Struct({
  url: SOURCE_URL,
  ref: Schema.optional(TrimmedNonEmptyString),
});
export const SkillPackPreviewResult = Schema.Struct({ preview: SkillPackPreview });

export const SkillPackInstallInput = Schema.Struct({
  url: SOURCE_URL,
  ref: Schema.optional(TrimmedNonEmptyString),
  providers: Schema.optional(Schema.Array(SkillPackProvider)),
});
export const SkillPackInstallResult = Schema.Struct({ pack: InstalledSkillPack });

export const SkillPackListInput = Schema.Struct({});
export const SkillPackListResult = Schema.Struct({ packs: Schema.Array(InstalledSkillPack) });

export const SkillPackUninstallInput = Schema.Struct({ packId: TrimmedNonEmptyString });
export const SkillPackUninstallResult = Schema.Struct({ ok: Schema.Boolean });

export class SkillPackRequestError extends Schema.TaggedErrorClass<SkillPackRequestError>()(
  "SkillPackRequestError",
  {
    code: Schema.Literals([
      "invalid_source_url",
      "source_fetch_failed",
      "source_ref_not_found",
      "pack_empty",
      "pack_too_large",
      "install_failed",
    ]),
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}
