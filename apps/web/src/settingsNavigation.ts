// FILE: settingsNavigation.ts
// Purpose: Share the settings topic taxonomy between the main sidebar and the settings screen.
// Layer: Route/UI support
// Exports: section ids, nav items, and search normalization helper

export const SETTINGS_SECTION_IDS = [
  "general",
  "profile",
  "appearance",
  "fonts",
  "notifications",
  "updates",
  "behavior",
  "shortcuts",
  "usage",
  "agents",
  "cloudAgents",
  "models",
  "codeReview",
  "gitPrs",
  "worktrees",
  "plugins",
  "skills",
  "rulesSkills",
  "toolsMcps",
  "hooks",
  "browserNetwork",
  "tab",
  "indexing",
  "modelRouters",
  "providers",
  "archived",
  "about",
  "advanced",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
export type SettingsNavGroupId = "app" | "agents" | "tools";

/**
 * Deep-link scroll targets inside a settings panel. Each id is shared by the element that owns
 * it (its `id` + scroll ref), the panel effect that scrolls it into view, and any caller that
 * navigates to it via `?target=…`. Centralizing them keeps the anchor and its links from
 * silently drifting apart.
 */
export const SETTINGS_TARGETS = {
  providerUpdates: "provider-updates",
  providerInstalls: "provider-installs",
  environmentPanel: "environment-panel",
} as const;

export type SettingsTargetId = (typeof SETTINGS_TARGETS)[keyof typeof SETTINGS_TARGETS];

export type SettingsNavItem = {
  id: SettingsSectionId;
  group: SettingsNavGroupId;
  label: string;
  description: string;
  eyebrow: string;
  /** Central Icons basename (SF-style glyph set shipped under /central-icons-reversed). */
  icon: string;
};

export const SETTINGS_NAV_GROUPS: ReadonlyArray<{
  id: SettingsNavGroupId;
  label: string;
}> = [
  { id: "app", label: "App" },
  { id: "agents", label: "Agents" },
  { id: "tools", label: "Tools" },
] as const;

/**
 * Cursor-inspired settings IA. Legacy ids (`codeReview`, `skills`) remain for deep links;
 * newer aliases (`gitPrs`, `rulesSkills`) render the same panels.
 */
export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    id: "general",
    group: "app",
    label: "General",
    description: "Default provider, thread mode, and sidebar organization.",
    eyebrow: "Workflow defaults",
    icon: "settings-gear-2",
  },
  {
    id: "profile",
    group: "app",
    label: "Profile",
    description: "Your local activity, streaks, and a shareable stats card.",
    eyebrow: "Your stats",
    icon: "circle-person",
  },
  {
    id: "appearance",
    group: "app",
    label: "Appearance",
    description: "Theme, layout density, and timestamp formatting.",
    eyebrow: "Visual language",
    icon: "circle-half-fill",
  },
  {
    id: "fonts",
    group: "app",
    label: "Fonts",
    description: "UI, code, and terminal typography.",
    eyebrow: "Typography",
    icon: "text-size",
  },
  {
    id: "notifications",
    group: "app",
    label: "Notifications",
    description: "In-app toasts and desktop alerts.",
    eyebrow: "Alerts",
    icon: "bell",
  },
  {
    id: "updates",
    group: "app",
    label: "Updates",
    description: "Check GitHub for new Modesto releases and manage installation.",
    eyebrow: "App releases",
    icon: "arrow-rotate-clockwise",
  },
  {
    id: "behavior",
    group: "app",
    label: "Behavior",
    description: "Streaming, diff handling, and destructive confirmations.",
    eyebrow: "Interaction rules",
    icon: "settings-slider-hor",
  },
  {
    id: "shortcuts",
    group: "app",
    label: "Keyboard Shortcuts",
    description: "Every keyboard shortcut available in Modesto, grouped by context.",
    eyebrow: "Key bindings",
    icon: "keyboard",
  },
  {
    id: "archived",
    group: "app",
    label: "Archived",
    description: "View and restore archived threads.",
    eyebrow: "Thread management",
    icon: "archive",
  },
  {
    id: "about",
    group: "app",
    label: "About",
    description: "Modesto version, community links, release notes, and feedback.",
    eyebrow: "About Modesto",
    icon: "circle-info",
  },
  {
    id: "usage",
    group: "agents",
    label: "Usage",
    description: "Remaining quota and credits for each signed-in provider.",
    eyebrow: "Limits & credits",
    icon: "credit-card-1",
  },
  {
    id: "agents",
    group: "agents",
    label: "Agents",
    description: "Default provider, thread mode, and Claude launch arguments.",
    eyebrow: "Agent defaults",
    icon: "cursor-click",
  },
  {
    id: "cloudAgents",
    group: "agents",
    label: "Cloud Agents",
    description: "Connect OpenClaw and choose which enabled providers can run cloud tasks.",
    eyebrow: "Remote agents",
    icon: "cloud",
  },
  {
    id: "models",
    group: "agents",
    label: "Models",
    description: "Git writing defaults and custom model slugs.",
    eyebrow: "AI configuration",
    icon: "3d-box-top",
  },
  {
    id: "codeReview",
    group: "agents",
    label: "Git & PRs",
    description: "Choose a review provider, scope, depth, and checks.",
    eyebrow: "Review configuration",
    icon: "branch",
  },
  {
    id: "worktrees",
    group: "agents",
    label: "Worktrees",
    description: "Review and clean up the worktrees created by Modesto.",
    eyebrow: "Workspace management",
    icon: "tree",
  },
  {
    id: "plugins",
    group: "tools",
    label: "Plugins",
    description: "Browse, install, and remove provider plugins.",
    eyebrow: "Extensions",
    icon: "puzzle",
  },
  {
    id: "skills",
    group: "tools",
    label: "Rules, Skills, Subagents",
    description: "Codex rules metadata, cross-provider skills, and subagent guidance.",
    eyebrow: "Agent guidance",
    icon: "books",
  },
  {
    id: "toolsMcps",
    group: "tools",
    label: "Tools & MCPs",
    description: "Enable, add, and remove Codex MCP servers in config.toml.",
    eyebrow: "Tool servers",
    icon: "toolbox",
  },
  {
    id: "hooks",
    group: "tools",
    label: "Hooks",
    description: "Lifecycle command hooks stored in Codex hooks.json.",
    eyebrow: "Automation",
    icon: "lightning-bolt",
  },
  {
    id: "browserNetwork",
    group: "tools",
    label: "Browser & Network",
    description: "In-app browser bridge status and Environment panel network rows.",
    eyebrow: "Web tools",
    icon: "globe",
  },
  {
    id: "tab",
    group: "tools",
    label: "Tab",
    description: "Preferred editor used when opening files and keybindings.",
    eyebrow: "Editing",
    icon: "text-indent-right",
  },
  {
    id: "indexing",
    group: "tools",
    label: "Indexing",
    description: "Rebuild local project indexes without clearing chats.",
    eyebrow: "Project search",
    icon: "layers-three",
  },
  {
    id: "modelRouters",
    group: "tools",
    label: "Model Routers",
    description:
      "Connect self-hosted or OpenAI-compatible backends (vLLM, OpenRouter, Portkey, LiteLLM) as custom Codex endpoints.",
    eyebrow: "Custom endpoints",
    icon: "api-connection",
  },
  {
    id: "providers",
    group: "tools",
    label: "Providers",
    description: "Choose visible providers, review CLI installs, and update provider tools.",
    eyebrow: "Picker visibility",
    icon: "apps",
  },
  {
    id: "advanced",
    group: "tools",
    label: "Advanced",
    description: "Keybindings, recovery, and version info.",
    eyebrow: "System tools",
    icon: "settings-knob",
  },
] as const;

/**
 * Stable DOM id for a settings row, derived from its (string) title. Shared by the row that
 * renders the anchor and by the search index that deep-links to it via `?target=…`, so the
 * two can't drift. Panels mount one section at a time, so the slug only needs to be unique
 * within a section.
 */
export function settingRowAnchorId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `setting-${slug}`;
}

/** Map alias section ids onto the canonical nav item used for titles/eyebrows. */
export function resolveSettingsNavItem(section: SettingsSectionId): SettingsNavItem {
  const aliases: Partial<Record<SettingsSectionId, SettingsSectionId>> = {
    gitPrs: "codeReview",
    rulesSkills: "skills",
  };
  const resolved = aliases[section] ?? section;
  return SETTINGS_NAV_ITEMS.find((item) => item.id === resolved) ?? SETTINGS_NAV_ITEMS[0]!;
}

export function normalizeSettingsSection(value: unknown): SettingsSectionId {
  if (typeof value !== "string") {
    return "general";
  }
  return SETTINGS_SECTION_IDS.find((candidate) => candidate === value) ?? "general";
}
