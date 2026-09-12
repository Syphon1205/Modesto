import {
  ClaudeSettings,
  CodexSettings,
  CursorSettings,
  CustomAcpSettings,
  DevinSettings,
  DroidSettings,
  GeminiSettings,
  GithubCopilotSettings,
  GrokSettings,
  KiloSettings,
  KimiSettings,
  MetaSettings,
  OpenCodeSettings,
  PiSettings,
  PoolsideSettings,
  ProviderDriverKind,
  QwenSettings,
} from "@modesto/contracts";
import type * as Schema from "effect/Schema";
import {
  ACPRegistryIcon,
  ClaudeAI,
  CursorIcon,
  DevinIcon,
  DroidIcon,
  Gemini,
  GithubCopilotIcon,
  GrokIcon,
  type Icon,
  KiloIcon,
  KimiIcon,
  MetaIcon,
  OpenAI,
  OpenCodeIcon,
  PiAgentIcon,
  PoolsideIcon,
  QwenIcon,
} from "../Icons";

type ProviderSettingsSchema = {
  readonly fields: Readonly<Record<string, Schema.Top>>;
} & Schema.Top;

/**
 * Browser-safe provider definition. This is deliberately shaped like the
 * future provider package client export: the core web app gets a schema with
 * field annotations plus provider-level presentation metadata, then renders
 * settings generically.
 */
export interface ProviderClientDefinition {
  readonly value: ProviderDriverKind;
  readonly label: string;
  readonly icon: Icon;
  readonly settingsSchema: ProviderSettingsSchema;
  /**
   * Optional short label rendered as a `variant="warning"` badge next to
   * the instance title. Used to flag drivers that still ship under an
   * early-access or preview gate — the flag is a property of the driver
   * kind (not a specific instance), so every instance of that driver —
   * built-in default or custom — advertises the same marker.
   */
  readonly badgeLabel?: string;
}

export const PROVIDER_CLIENT_DEFINITIONS: readonly ProviderClientDefinition[] = [
  {
    value: ProviderDriverKind.make("codex"),
    label: "Codex",
    icon: OpenAI,
    settingsSchema: CodexSettings,
  },
  {
    value: ProviderDriverKind.make("claudeAgent"),
    label: "Claude",
    icon: ClaudeAI,
    settingsSchema: ClaudeSettings,
  },
  {
    value: ProviderDriverKind.make("cursor"),
    label: "Cursor",
    icon: CursorIcon,
    settingsSchema: CursorSettings,
  },
  {
    value: ProviderDriverKind.make("grok"),
    label: "Grok",
    icon: GrokIcon,
    settingsSchema: GrokSettings,
  },
  {
    value: ProviderDriverKind.make("gemini"),
    label: "Gemini",
    icon: Gemini,
    settingsSchema: GeminiSettings,
  },
  {
    value: ProviderDriverKind.make("meta"),
    label: "Meta",
    icon: MetaIcon,
    settingsSchema: MetaSettings,
    badgeLabel: "New",
  },
  {
    value: ProviderDriverKind.make("opencode"),
    label: "OpenCode",
    icon: OpenCodeIcon,
    settingsSchema: OpenCodeSettings,
  },
  {
    value: ProviderDriverKind.make("kilo"),
    label: "Kilo",
    icon: KiloIcon,
    settingsSchema: KiloSettings,
  },
  {
    value: ProviderDriverKind.make("kimi"),
    label: "Kimi",
    icon: KimiIcon,
    settingsSchema: KimiSettings,
    badgeLabel: "Early Access",
  },
  {
    value: ProviderDriverKind.make("qwen"),
    label: "Qwen",
    icon: QwenIcon,
    settingsSchema: QwenSettings,
    badgeLabel: "Early Access",
  },
  {
    value: ProviderDriverKind.make("poolside"),
    label: "Poolside",
    icon: PoolsideIcon,
    settingsSchema: PoolsideSettings,
    badgeLabel: "Early Access",
  },
  {
    value: ProviderDriverKind.make("devin"),
    label: "Devin",
    icon: DevinIcon,
    settingsSchema: DevinSettings,
    badgeLabel: "Early Access",
  },
  {
    value: ProviderDriverKind.make("githubCopilot"),
    label: "GitHub Copilot",
    icon: GithubCopilotIcon,
    settingsSchema: GithubCopilotSettings,
  },
  {
    value: ProviderDriverKind.make("droid"),
    label: "Factory Droid",
    icon: DroidIcon,
    settingsSchema: DroidSettings,
  },
  {
    value: ProviderDriverKind.make("pi"),
    label: "Pi",
    icon: PiAgentIcon,
    settingsSchema: PiSettings,
  },
  {
    value: ProviderDriverKind.make("customAcp"),
    label: "Custom ACP Agent",
    icon: ACPRegistryIcon,
    settingsSchema: CustomAcpSettings,
  },
];

export const PROVIDER_CLIENT_DEFINITION_BY_VALUE: Partial<
  Record<ProviderDriverKind, ProviderClientDefinition>
> = Object.fromEntries(
  PROVIDER_CLIENT_DEFINITIONS.map((definition) => [definition.value, definition]),
);

export const DRIVER_OPTIONS = PROVIDER_CLIENT_DEFINITIONS;
export const DRIVER_OPTION_BY_VALUE = PROVIDER_CLIENT_DEFINITION_BY_VALUE;
export type DriverOption = ProviderClientDefinition;

/**
 * Look up the driver metadata for an instance's `driver` field. Accepts
 * Returns `undefined` for fork / unknown drivers so callers can decide how
 * to render them — typically by falling back to a generic card.
 */
export function getDriverOption(driver: ProviderDriverKind | undefined): DriverOption | undefined {
  if (driver === undefined) return undefined;
  return PROVIDER_CLIENT_DEFINITION_BY_VALUE[driver];
}
