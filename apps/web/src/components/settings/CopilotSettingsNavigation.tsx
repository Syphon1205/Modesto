import { useState } from "react";
import {
  BlocksIcon,
  CpuIcon,
  FlaskConicalIcon,
  GitPullRequestIcon,
  KeyboardIcon,
  PaletteIcon,
  SearchIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  UsersIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import { useSettingsDialogStore } from "../../settings/settingsDialogStore";
import { GitHubAccountRow } from "../sidebar/GitHubAccountRow";
import { searchSettings } from "./settingsSearch";
import { MOTION_ROW_CLASS } from "../../lib/motion";

export const COPILOT_SETTINGS_SECTIONS = [
  { path: "/settings/general", label: "General", icon: Settings2Icon, group: "Workspace" },
  { path: "/settings/sessions", label: "Sessions", icon: WorkflowIcon, group: "Workspace" },
  { path: "/settings/appearance", label: "Appearance", icon: PaletteIcon, group: "Workspace" },
  { path: "/settings/keybindings", label: "Keyboard", icon: KeyboardIcon, group: "Workspace" },
  {
    path: "/settings/advanced",
    label: "Advanced",
    icon: SlidersHorizontalIcon,
    group: "Workspace",
  },
  { path: "/settings/integrations", label: "Customize", icon: BlocksIcon, group: "Extensions" },
  { path: "/settings/connections", label: "Accounts", icon: UsersIcon, group: "Extensions" },
  { path: "/settings/providers", label: "Model providers", icon: CpuIcon, group: "Extensions" },
  {
    path: "/settings/source-control",
    label: "Git & pull requests",
    icon: GitPullRequestIcon,
    group: "Developer",
  },
  {
    path: "/settings/experimental",
    label: "Experimental",
    icon: FlaskConicalIcon,
    group: "Developer",
  },
];
export function CopilotSettingsNavigation() {
  const { pathname, show } = useSettingsDialogStore();
  const [query, setQuery] = useState("");
  const sections = COPILOT_SETTINGS_SECTIONS.filter((section) =>
    section.label.toLowerCase().includes(query.toLowerCase().trim()),
  );
  const results = query.trim() ? searchSettings(query) : [];
  return (
    <>
      <GitHubAccountRow settingsHeader />
      <label className="my-3 flex h-7 items-center gap-1.5 rounded-md border border-input px-2">
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search settings"
          placeholder="Search settings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              e.stopPropagation();
              setQuery("");
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
        {query ? (
          <button type="button" aria-label="Clear settings search" onClick={() => setQuery("")}>
            <XIcon className="size-3" />
          </button>
        ) : null}
      </label>
      <button
        type="button"
        className="sr-only focus:not-sr-only"
        onClick={() => document.getElementById("settings-dialog-content")?.focus()}
      >
        Skip to settings content
      </button>
      <select
        aria-label="Settings section"
        className="copilot-settings-mobile-section"
        value={pathname}
        onChange={(event) => {
          show(event.target.value);
          setQuery("");
        }}
      >
        {!COPILOT_SETTINGS_SECTIONS.some((section) => section.path === pathname) ? (
          <option value={pathname}>More settings</option>
        ) : null}
        {COPILOT_SETTINGS_SECTIONS.map((section) => (
          <option key={section.path} value={section.path}>
            {section.label}
          </option>
        ))}
      </select>
      <nav aria-label="Settings sections" className="min-h-0 flex-1 overflow-y-auto">
        {sections.map(({ path, label, icon: Icon, group }, index) => (
          <div key={path}>
            {!query && sections[index - 1]?.group !== group ? (
              <p className="mb-1 mt-4 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 first:mt-1">
                {group}
              </p>
            ) : null}
            <button
              type="button"
              aria-current={pathname === path ? "page" : undefined}
              onClick={() => {
                show(path);
                setQuery("");
              }}
              className={`copilot-settings-nav-item ${MOTION_ROW_CLASS}`}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span>{label}</span>
            </button>
          </div>
        ))}
        {results.length ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 px-2 text-[10px] text-muted-foreground">Matching settings</p>
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="copilot-settings-nav-item"
                onClick={() => {
                  show(
                    result.to === "/settings/general"
                      ? "/settings/advanced"
                      : result.to === "/settings/integrations"
                        ? "/settings/integration-preferences"
                        : result.to === "/settings/connections"
                          ? "/settings/environment-connections"
                          : result.to,
                    result.targetId ?? result.id,
                  );
                  setQuery("");
                }}
              >
                {result.title}
              </button>
            ))}
          </div>
        ) : null}
        {!sections.length && !results.length ? (
          <p role="status" className="px-2 py-4 text-xs text-muted-foreground">
            No settings found.
          </p>
        ) : null}
      </nav>
    </>
  );
}
