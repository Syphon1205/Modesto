import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import {
  ArchiveIcon,
  BlocksIcon,
  CpuIcon,
  GitBranchIcon,
  KeyboardIcon,
  Link2Icon,
  PaletteIcon,
  SearchIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Kbd } from "../ui/kbd";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import { T3ConnectSidebarAvatar, T3ConnectSidebarSignIn } from "../clerk/T3ConnectSidebarSignIn";
import { SidebarUtilityMenu } from "../sidebar/SidebarChrome";
import { GitHubAccountRow } from "../sidebar/GitHubAccountRow";
import { useInterfaceStyle } from "../../hooks/useSettings";
import { scrollToSettingsTarget } from "./settingsLayout";
import {
  searchSettings,
  SETTINGS_SECTION_LABELS,
  type SettingsPath,
  type SettingsSearchItem,
} from "./settingsSearch";

const SETTINGS_SECTION_ICONS: Readonly<
  Record<SettingsPath, ComponentType<{ className?: string }>>
> = {
  "/settings/general": Settings2Icon,
  "/settings/appearance": PaletteIcon,
  "/settings/keybindings": KeyboardIcon,
  "/settings/providers": CpuIcon,
  "/settings/integrations": BlocksIcon,
  "/settings/source-control": GitBranchIcon,
  "/settings/connections": Link2Icon,
  "/settings/archived": ArchiveIcon,
};

export const SETTINGS_NAV_ITEMS: ReadonlyArray<{
  label: string;
  to: SettingsPath;
  icon: ComponentType<{ className?: string }>;
}> = (Object.keys(SETTINGS_SECTION_LABELS) as SettingsPath[]).map((to) => ({
  to,
  label: SETTINGS_SECTION_LABELS[to],
  icon: SETTINGS_SECTION_ICONS[to],
}));

const SETTINGS_NAV_GROUPS: ReadonlyArray<{
  label: string;
  paths: ReadonlyArray<SettingsPath>;
}> = [
  {
    label: "Personal",
    paths: ["/settings/general", "/settings/appearance", "/settings/keybindings"],
  },
  {
    label: "Workspace",
    paths: ["/settings/providers", "/settings/integrations", "/settings/source-control"],
  },
  {
    label: "Data & access",
    paths: ["/settings/connections", "/settings/archived"],
  },
];

const OPENCODE_SETTINGS_NAV_GROUPS: typeof SETTINGS_NAV_GROUPS = [
  {
    label: "Desktop",
    paths: ["/settings/general", "/settings/appearance", "/settings/keybindings"],
  },
  {
    label: "Server",
    paths: ["/settings/connections", "/settings/providers", "/settings/integrations"],
  },
  {
    label: "Advanced",
    paths: ["/settings/source-control", "/settings/archived"],
  },
];

const GITHUB_SETTINGS_NAV_GROUPS: typeof SETTINGS_NAV_GROUPS = [
  {
    label: "Settings",
    paths: [
      "/settings/general",
      "/settings/connections",
      "/settings/source-control",
      "/settings/appearance",
      "/settings/keybindings",
      "/settings/integrations",
      "/settings/providers",
      "/settings/archived",
    ],
  },
];

function SettingsSectionIcon({ to }: { to: SettingsPath }) {
  const Icon = SETTINGS_SECTION_ICONS[to];
  return <Icon className="mt-0.5 size-3.5 shrink-0 text-sidebar-muted-foreground/60" />;
}

export function SettingsSidebarNav({ pathname }: { pathname: string }) {
  const interfaceStyle = useInterfaceStyle();
  const isOpenCode = interfaceStyle === "opencode";
  const isGitHub = interfaceStyle === "github";
  const navigate = useNavigate();
  const currentHash = useLocation({ select: (location) => location.hash });
  const { isMobile, setOpenMobile, open, setOpen } = useSidebar();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const results = useMemo(() => searchSettings(query), [query]);
  const isSearching = query.trim().length > 0;
  const hasResults = results.length > 0;

  useEffect(() => {
    const result = results[activeResultIndex];
    if (!result) return;
    document
      .getElementById(`settings-search-result-${result.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeResultIndex, results]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          // Keep focus inside open dialogs and popups instead of escaping
          // their focus trap into the sidebar search.
          (target.closest('[role="dialog"], [aria-modal="true"], [data-slot$="popup"]') !== null &&
            !target.closest("[data-settings-dialog]")))
      ) {
        return;
      }

      event.preventDefault();
      if (isMobile) {
        setOpenMobile(true);
      } else if (!open) {
        setOpen(true);
      }
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, open, setOpen, setOpenMobile]);

  const handleSectionClick = useCallback(
    (to: SettingsPath) => {
      if (isMobile) {
        setOpenMobile(false);
      }
      void navigate({ to, hash: "", replace: true, hashScrollIntoView: false });
    },
    [isMobile, navigate, setOpenMobile],
  );
  const clearSearch = useCallback(() => {
    setQuery("");
    setActiveResultIndex(0);
  }, []);
  const handleSearchResultClick = useCallback(
    (item: SettingsSearchItem) => {
      clearSearch();
      if (isMobile) {
        setOpenMobile(false);
      }
      const targetId = item.targetId ?? item.id;
      if (pathname === item.to && currentHash.replace(/^#/, "") === targetId) {
        scrollToSettingsTarget(targetId);
        return;
      }
      void navigate({ to: item.to, hash: targetId, replace: true, hashScrollIntoView: false });
    },
    [clearSearch, currentHash, isMobile, navigate, pathname, setOpenMobile],
  );
  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape" && isSearching) {
        event.preventDefault();
        event.stopPropagation();
        clearSearch();
        return;
      }
      if (results.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveResultIndex((index) => (index + 1) % results.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveResultIndex((index) => (index - 1 + results.length) % results.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const result = results[activeResultIndex];
        if (result) handleSearchResultClick(result);
      }
    },
    [activeResultIndex, clearSearch, handleSearchResultClick, isSearching, results],
  );
  return (
    <>
      <SidebarContent data-opencode-settings-nav="" className="overflow-x-hidden">
        <SidebarGroup className="gap-2 p-[var(--sidebar-content-inset)]">
          {isGitHub ? <GitHubAccountRow settingsHeader /> : null}
          <div
            data-settings-search=""
            className="flex h-8 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
          >
            <SearchIcon className="size-4 shrink-0 text-sidebar-muted-foreground/80" />
            <Input
              ref={searchInputRef}
              nativeInput
              unstyled
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setActiveResultIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search settings…"
              aria-label="Search settings"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isSearching && hasResults}
              aria-controls={isSearching && hasResults ? "settings-search-results" : undefined}
              aria-activedescendant={
                isSearching && results[activeResultIndex]
                  ? `settings-search-result-${results[activeResultIndex].id}`
                  : undefined
              }
              className="min-w-0 flex-1 [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:p-0 [&_[data-slot=input]]:leading-normal [&_[data-slot=input]]:text-sm [&_[data-slot=input]]:font-medium [&_[data-slot=input]]:text-sidebar-foreground [&_[data-slot=input]]:placeholder:text-sidebar-muted-foreground"
            />
            {isSearching ? (
              <Button
                type="button"
                size="icon-micro"
                variant="ghost"
                className="shrink-0 text-sidebar-muted-foreground hover:bg-sidebar-control-surface hover:text-sidebar-foreground"
                aria-label="Clear settings search"
                onClick={() => {
                  clearSearch();
                  searchInputRef.current?.focus();
                }}
              >
                <XIcon className="size-3" />
              </Button>
            ) : (
              <Kbd className="h-4 min-w-0 rounded-sm px-1.5 text-[10px]">/</Kbd>
            )}
          </div>
          {isSearching && results.length === 0 ? (
            <p
              role="status"
              className="px-2 py-6 text-center text-xs text-sidebar-muted-foreground"
            >
              No settings found
            </p>
          ) : null}
          <SidebarMenu
            className="ps-px"
            id={isSearching && hasResults ? "settings-search-results" : undefined}
            role={isSearching && hasResults ? "listbox" : undefined}
            aria-label={isSearching && hasResults ? "Settings search results" : undefined}
          >
            {isSearching
              ? results.map((item, index) => (
                  <SidebarMenuItem key={item.id} role="presentation">
                    <SidebarMenuButton
                      id={`settings-search-result-${item.id}`}
                      role="option"
                      aria-selected={index === activeResultIndex}
                      tabIndex={-1}
                      size="sm"
                      isActive={index === activeResultIndex}
                      className="h-auto min-h-10 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
                      onMouseMove={() => setActiveResultIndex(index)}
                      onClick={() => handleSearchResultClick(item)}
                    >
                      <SettingsSectionIcon to={item.to} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-sidebar-foreground">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-sidebar-muted-foreground/75">
                          {SETTINGS_SECTION_LABELS[item.to]}
                        </span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              : (isGitHub
                  ? GITHUB_SETTINGS_NAV_GROUPS
                  : isOpenCode
                    ? OPENCODE_SETTINGS_NAV_GROUPS
                    : SETTINGS_NAV_GROUPS
                ).map((group) => (
                  <SidebarMenuItem key={group.label} className="list-none pt-2 first:pt-0">
                    <p className="px-2 pb-1 text-[11px] font-medium text-sidebar-muted-foreground/65">
                      {group.label}
                    </p>
                    <SidebarMenu className="gap-px">
                      {group.paths.map((to) => {
                        const item = SETTINGS_NAV_ITEMS.find((candidate) => candidate.to === to);
                        if (!item) return null;
                        const Icon = item.icon;
                        const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
                        return (
                          <SidebarMenuItem key={item.to}>
                            <SidebarMenuButton
                              isActive={isActive}
                              className="h-8 gap-2 rounded-md px-2 text-xs data-[active=true]:bg-sidebar-accent"
                              onClick={() => handleSectionClick(item.to)}
                            >
                              <Icon className="size-4" />
                              <span className="truncate">
                                {isGitHub && item.to === "/settings/general"
                                  ? "General"
                                  : isGitHub && item.to === "/settings/appearance"
                                    ? "Themes"
                                    : isGitHub && item.to === "/settings/keybindings"
                                      ? "Accessibility"
                                      : isGitHub && item.to === "/settings/providers"
                                        ? "Model providers"
                                        : isGitHub && item.to === "/settings/integrations"
                                          ? "Customize"
                                          : isGitHub && item.to === "/settings/source-control"
                                            ? "Sessions"
                                            : isGitHub && item.to === "/settings/connections"
                                              ? "Accounts"
                                              : isGitHub && item.to === "/settings/archived"
                                                ? "Experimental"
                                                : isOpenCode && item.to === "/settings/keybindings"
                                                  ? "Shortcuts"
                                                  : isOpenCode &&
                                                      item.to === "/settings/connections"
                                                    ? "Servers"
                                                    : isOpenCode &&
                                                        item.to === "/settings/integrations"
                                                      ? "Models"
                                                      : item.label}
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarMenuItem>
                ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter
        data-opencode-settings-footer={isOpenCode || undefined}
        className="p-[var(--sidebar-content-inset)]"
      >
        {isGitHub ? null : isOpenCode ? (
          <div className="flex flex-col gap-2 px-1 py-1 text-[11px] leading-none text-sidebar-muted-foreground/55">
            <span>Modesto Desktop</span>
            <span>OpenCode interface</span>
          </div>
        ) : (
          <>
            <T3ConnectSidebarSignIn />
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <SidebarUtilityMenu />
              </div>
              <T3ConnectSidebarAvatar />
            </div>
          </>
        )}
      </SidebarFooter>
    </>
  );
}
