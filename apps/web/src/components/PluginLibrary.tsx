// FILE: PluginLibrary.tsx
// Purpose: Hosts the plugin and skill browser surfaced from provider discovery APIs.
// Layer: Route-level screen
// Exports: PluginLibrary

import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ProviderListPluginsResult,
  type ProviderPluginDescriptor,
  type ProviderPluginSkillSummary,
  type ProviderSkillDescriptor,
} from "@modesto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { type ReactNode, useDeferredValue, useEffect, useMemo, useState } from "react";
import { PROVIDER_ICON_COMPONENT_BY_PROVIDER } from "./ProviderIcon";
import { useStore } from "~/store";
import {
  buildPluginSearchFields,
  buildSkillSearchFields,
  isInstalledProviderPlugin,
  normalizeProviderDiscoveryText,
  rankProviderDiscoveryItems,
  resolveProviderDiscoveryCwd,
  supportsProviderDiscoveryTab,
} from "~/lib/providerDiscovery";
import { createFirstProjectSelector } from "~/storeSelectors";
import {
  providerComposerCapabilitiesQueryOptions,
  providerDiscoveryQueryKeys,
  providerPluginsQueryOptions,
  providerReadPluginQueryOptions,
  providerSkillsQueryOptions,
  supportsPluginDiscovery,
  supportsSkillDiscovery,
} from "~/lib/providerDiscoveryReactQuery";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { useFocusedChatContext } from "~/focusedChatContext";
import {
  CheckIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  HammerIcon,
  ListChecksIcon,
  PluginIcon,
  Loader2Icon,
  SearchIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";
import { buildLocalImageUrl, isLocalImageMarkdownSrc } from "~/lib/localImageUrls";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "./ui/input-group";
import { SidebarInset } from "./ui/sidebar";
import { SidebarHeaderNavigationControls } from "./SidebarHeaderNavigationControls";
import {
  useDesktopTopBarTrafficLightGutterClassName,
  useDesktopTopBarWindowControlsGutterClassName,
} from "~/hooks/useDesktopTopBarGutter";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { ensureNativeApi } from "~/nativeApi";
import { toastManager } from "./ui/toast";
import { OpenAI } from "./Icons";
import { newCommandId } from "~/lib/utils";
import type { ProviderPluginOperationStage } from "@modesto/contracts";

// ── Types ──────────────────────────────────────────────────────────────────

type DiscoveryTab = "plugins" | "skills";
type PluginFilter = "all" | "installed";
type SkillFilter = "all" | "installed";
type ProviderCapabilities = { plugins: boolean; skills: boolean };
type PluginEntry = {
  marketplaceName: string;
  marketplacePath: string;
  plugin: ProviderPluginDescriptor;
  isFeatured: boolean;
};
type PluginSkillEntry = {
  entry: PluginEntry;
  skill: ProviderPluginSkillSummary;
};

const PLUGIN_STAGE_LABELS: Record<ProviderPluginOperationStage, string> = {
  queued: "Queued",
  installing: "Installing",
  removing: "Removing",
  refreshing: "Refreshing discovery",
  verifying: "Verifying",
  complete: "Complete",
  failed: "Failed",
};

// ── Constants ──────────────────────────────────────────────────────────────

const PROVIDER_ICON: Record<ProviderKind, React.FC<React.SVGProps<SVGSVGElement>>> = {
  ...PROVIDER_ICON_COMPONENT_BY_PROVIDER,
  codex: HammerIcon,
};
const PROVIDER_DISCOVERY_ORDER: ReadonlyArray<ProviderKind> = [
  "codex",
  "claudeAgent",
  "cursor",
  "poolside",
  "gemini",
  "grok",
  "droid",
  "kilo",
  "opencode",
  "pi",
];
const PLUGIN_CATEGORY_ORDER = [
  "Productivity",
  "Developer Tools",
  "Business & Operations",
  "Data & Analytics",
  "Communication",
  "Creativity",
  "Finance",
  "Education & Research",
  "Travel",
  "Engineering",
  "Security",
  "Other",
] as const;

// ── Utilities ──────────────────────────────────────────────────────────────

function pluginEntryKey(entry: Pick<PluginEntry, "marketplacePath" | "plugin">): string {
  return `${entry.marketplacePath}::${entry.plugin.name}`;
}

function sectionTitle(value: string): string {
  const n = value.trim();
  return n.length === 0 ? "Unknown" : n;
}

function resolvePluginAccent(plugin: ProviderPluginDescriptor): string | undefined {
  return plugin.interface?.brandColor?.trim() || undefined;
}

function normalizeBrandKey(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolvePluginLogo(plugin: ProviderPluginDescriptor): string | undefined {
  return plugin.interface?.logo?.trim() || undefined;
}

function resolvePluginLogoUrl(plugin: ProviderPluginDescriptor): string | undefined {
  const logo = resolvePluginLogo(plugin);
  if (!logo) return undefined;
  return isLocalImageMarkdownSrc(logo)
    ? buildLocalImageUrl({ src: logo, cwd: plugin.source.path })
    : logo;
}

function pluginCategory(plugin: ProviderPluginDescriptor): string {
  return plugin.interface?.category?.trim() || "Other";
}

function categoryRank(category: string): number {
  const rank = PLUGIN_CATEGORY_ORDER.indexOf(category as (typeof PLUGIN_CATEGORY_ORDER)[number]);
  return rank === -1 ? PLUGIN_CATEGORY_ORDER.length : rank;
}

/** Stable hue 0–359 from a string, for consistent per-item icon colors. */
function nameToHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

// ── Icon glyphs ────────────────────────────────────────────────────────────

function PluginGlyph({
  plugin,
  compact = false,
}: {
  plugin: ProviderPluginDescriptor;
  compact?: boolean;
}) {
  const accent = resolvePluginAccent(plugin);
  const logo = resolvePluginLogoUrl(plugin);
  const isOpenAiOwned = normalizeBrandKey(plugin.interface?.developerName) === "openai";
  const shellClassName = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden border border-black/10 bg-white shadow-xs dark:border-white/12",
    compact ? "size-9 rounded-[10px]" : "size-11 rounded-[13px]",
  );

  if (logo) {
    return (
      <span className={shellClassName} style={accent ? { borderColor: `${accent}55` } : undefined}>
        <img
          src={logo}
          alt=""
          className={cn("object-contain", compact ? "size-7" : "size-9")}
          loading="lazy"
        />
      </span>
    );
  }

  // The sole current Codex plugin without an artwork file is OpenAI-owned, so
  // use its actual developer mark rather than inventing a generic fallback.
  if (isOpenAiOwned) {
    return (
      <span className={shellClassName}>
        <OpenAI className={cn("text-black", compact ? "size-5" : "size-6")} />
      </span>
    );
  }

  return <span className={shellClassName} aria-hidden="true" />;
}

function SkillGlyph({ skill }: { skill: Pick<ProviderSkillDescriptor, "name" | "interface"> }) {
  const hue = nameToHue(skill.interface?.displayName ?? skill.name);
  return (
    <span
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px]"
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 55% 30%), hsl(${hue} 45% 18%))`,
        boxShadow: `0 0 0 0.5px hsl(${hue} 40% 30% / 0.35)`,
      }}
    >
      <ListChecksIcon className="size-5 text-white/80" />
    </span>
  );
}

// ── UI controls ────────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center border-b-2 px-1 text-[13px] font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground/80",
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ProviderToggleButton({
  label,
  active,
  disabled,
  onClick,
  provider,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  provider: ProviderKind;
}) {
  const Icon = PROVIDER_ICON[provider] ?? HammerIcon;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-[var(--color-text-foreground)] text-[var(--color-background-surface)] shadow-xs"
          : "text-muted-foreground hover:bg-[var(--sidebar-accent)] hover:text-foreground",
        disabled && "pointer-events-none opacity-35",
      )}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <Icon className="size-3.5 shrink-0" />
      {/* Below ~860px of header width the 9 labeled pills overflow the top bar and clip;
          collapse to icon-only pills while keeping the accessible name (same pattern as
          BranchToolbar's responsive sr-only labels). */}
      <span className="@max-[860px]:sr-only">{label}</span>
    </button>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/40 px-5 py-6 text-center">
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InlineWarning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2.5 text-xs text-muted-foreground">
      <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
      <div>{children}</div>
    </div>
  );
}

function InstalledStatus({ installed }: { installed: boolean }) {
  if (!installed) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
      <CheckIcon className="size-3.5" />
      Installed
    </span>
  );
}

// ── Grid items ─────────────────────────────────────────────────────────────

function PluginGridItem({
  entry,
  installing,
  installationSupported,
  onSelect,
  onInstall,
}: {
  entry: PluginEntry;
  installing: boolean;
  installationSupported: boolean;
  onSelect: () => void;
  onInstall: () => void;
}) {
  const description =
    entry.plugin.interface?.shortDescription ??
    entry.plugin.interface?.longDescription ??
    entry.plugin.source.path;

  return (
    <div className="group flex min-h-[76px] items-center gap-2 rounded-xl pr-3 transition-colors hover:bg-[var(--sidebar-accent)] focus-within:bg-[var(--sidebar-accent)]">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelect}
      >
        <PluginGlyph plugin={entry.plugin} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug text-foreground">
            {entry.plugin.interface?.displayName ?? entry.plugin.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{description}</p>
        </div>
      </button>
      {isInstalledProviderPlugin(entry.plugin) ? (
        <InstalledStatus installed />
      ) : entry.plugin.installPolicy === "AVAILABLE" && installationSupported ? (
        <Button size="xs" variant="outline" disabled={installing} onClick={onInstall}>
          {installing ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Install
        </Button>
      ) : (
        <span className="text-[10px] font-medium text-muted-foreground/65">Unavailable</span>
      )}
    </div>
  );
}

function SkillGridItem({ skill }: { skill: ProviderSkillDescriptor }) {
  const description =
    skill.interface?.shortDescription ?? skill.description ?? "No description available.";

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--sidebar-accent)]">
      <SkillGlyph skill={skill} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-foreground">
          {skill.interface?.displayName ?? skill.name}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{description}</p>
      </div>
      <InstalledStatus installed />
    </div>
  );
}

function PluginSkillGridItem({
  item,
  installing,
  installationSupported,
  onSelectPlugin,
  onInstall,
}: {
  item: PluginSkillEntry;
  installing: boolean;
  installationSupported: boolean;
  onSelectPlugin: () => void;
  onInstall: () => void;
}) {
  const installed = isInstalledProviderPlugin(item.entry.plugin);
  const description =
    item.skill.interface?.shortDescription ??
    item.skill.description ??
    `Included with ${item.entry.plugin.interface?.displayName ?? item.entry.plugin.name}.`;

  return (
    <div className="group flex min-h-[76px] items-center gap-2 rounded-xl pr-3 transition-colors hover:bg-[var(--sidebar-accent)] focus-within:bg-[var(--sidebar-accent)]">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelectPlugin}
      >
        <SkillGlyph skill={item.skill} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug text-foreground">
            {item.skill.interface?.displayName ?? item.skill.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{description}</p>
          <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground/70">
            From {item.entry.plugin.interface?.displayName ?? item.entry.plugin.name}
          </p>
        </div>
      </button>
      {installed ? (
        <InstalledStatus installed />
      ) : item.entry.plugin.installPolicy === "AVAILABLE" && installationSupported ? (
        <Button size="xs" variant="outline" disabled={installing} onClick={onInstall}>
          {installing ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Install
        </Button>
      ) : (
        <span className="text-[10px] font-medium text-muted-foreground/65">Unavailable</span>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="border-b border-border/55 px-2 pb-3 text-[15px] font-semibold text-foreground">
      {title}
    </h2>
  );
}

function InstalledPluginStrip({
  entries,
  onSelect,
}: {
  entries: PluginEntry[];
  onSelect: (entry: PluginEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Installed" />
      <div className="flex flex-wrap gap-2 px-2 py-3">
        {entries.map((entry) => {
          const label = entry.plugin.interface?.displayName ?? entry.plugin.name;
          return (
            <button
              key={pluginEntryKey(entry)}
              type="button"
              className="rounded-[11px] transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={label}
              aria-label={`Open ${label}`}
              onClick={() => onSelect(entry)}
            >
              <PluginGlyph plugin={entry.plugin} compact />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PluginDetailDialog({
  entry,
  provider,
  cwd,
  threadId,
  changing,
  installationSupported,
  onOpenChange,
  onSetInstalled,
}: {
  entry: PluginEntry | null;
  provider: ProviderKind;
  cwd: string | null;
  threadId: string | null;
  changing: boolean;
  installationSupported: boolean;
  onOpenChange: (open: boolean) => void;
  onSetInstalled: (installed: boolean) => void;
}) {
  const detailQuery = useQuery(
    providerReadPluginQueryOptions({
      provider,
      marketplacePath: entry?.marketplacePath ?? "__no-plugin__",
      pluginName: entry?.plugin.name ?? "__no-plugin__",
      cwd,
      threadId,
      enabled: entry !== null,
    }),
  );
  const detail = detailQuery.data?.plugin;
  const plugin = entry?.plugin;
  const installed = plugin ? isInstalledProviderPlugin(plugin) : false;
  const title = plugin?.interface?.displayName ?? plugin?.name ?? "Plugin";
  const description =
    detail?.description ??
    plugin?.interface?.longDescription ??
    plugin?.interface?.shortDescription ??
    "No description is available for this plugin.";

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogPopup surface="solid" className="max-w-2xl">
        <DialogHeader className="pr-12">
          <div className="flex items-start gap-3">
            {plugin ? <PluginGlyph plugin={plugin} /> : null}
            <div className="min-w-0 flex-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {plugin?.interface?.developerName
                  ? `By ${plugin.interface.developerName} · ${entry?.marketplaceName}`
                  : entry?.marketplaceName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogPanel className="space-y-5 pt-3">
          {detailQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : detailQuery.isError ? (
            <InlineWarning>
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Plugin details could not be loaded."}
            </InlineWarning>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                {description}
              </p>

              {plugin?.interface?.capabilities?.length ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Capabilities
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {plugin.interface.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-foreground/80"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail?.skills.length ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Skills
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {detail.skills.map((skill) => (
                      <div key={skill.path} className="rounded-xl border border-border/60 p-3">
                        <p className="text-sm font-medium text-foreground">
                          {skill.interface?.displayName ?? skill.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {skill.interface?.shortDescription ?? skill.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail?.apps.length ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Apps and connectors
                  </h3>
                  <div className="space-y-2">
                    {detail.apps.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                      >
                        <PluginIcon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{app.name}</p>
                          {app.description ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {app.description}
                            </p>
                          ) : null}
                        </div>
                        {installed && app.installUrl ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              void ensureNativeApi().shell.openExternal(app.installUrl!)
                            }
                          >
                            <ExternalLinkIcon className="size-3.5" />
                            {app.needsAuth ? "Connect" : "Open"}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail?.mcpServers.length ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    MCP servers
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.mcpServers.map((server) => (
                      <code
                        key={server}
                        className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px]"
                      >
                        {server}
                      </code>
                    ))}
                  </div>
                </section>
              ) : null}

              {plugin?.interface?.defaultPrompt?.length ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Try asking
                  </h3>
                  <div className="space-y-1.5">
                    {plugin.interface.defaultPrompt.map((prompt) => (
                      <div
                        key={prompt}
                        className="rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-xs text-foreground/80"
                      >
                        {prompt}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                {plugin?.interface?.websiteUrl ? (
                  <button
                    type="button"
                    className="hover:text-foreground hover:underline"
                    onClick={() =>
                      void ensureNativeApi().shell.openExternal(plugin.interface!.websiteUrl!)
                    }
                  >
                    Website
                  </button>
                ) : null}
                {plugin?.interface?.privacyPolicyUrl ? (
                  <button
                    type="button"
                    className="hover:text-foreground hover:underline"
                    onClick={() =>
                      void ensureNativeApi().shell.openExternal(plugin.interface!.privacyPolicyUrl!)
                    }
                  >
                    Privacy policy
                  </button>
                ) : null}
                {plugin?.interface?.termsOfServiceUrl ? (
                  <button
                    type="button"
                    className="hover:text-foreground hover:underline"
                    onClick={() =>
                      void ensureNativeApi().shell.openExternal(
                        plugin.interface!.termsOfServiceUrl!,
                      )
                    }
                  >
                    Terms
                  </button>
                ) : null}
              </div>
            </>
          )}
        </DialogPanel>
        <DialogFooter>
          {installed ? (
            <Button
              variant="destructive-outline"
              disabled={changing || !installationSupported}
              onClick={() => onSetInstalled(false)}
            >
              {changing ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Remove
            </Button>
          ) : (
            <Button
              disabled={changing || !installationSupported || plugin?.installPolicy !== "AVAILABLE"}
              onClick={() => onSetInstalled(true)}
            >
              {changing ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {plugin?.installPolicy === "AVAILABLE" && installationSupported
                ? "Install"
                : "Unavailable"}
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PluginLibrary() {
  const queryClient = useQueryClient();
  const desktopTopBarTrafficLightGutterClassName = useDesktopTopBarTrafficLightGutterClassName();
  const desktopTopBarWindowControlsGutterClassName =
    useDesktopTopBarWindowControlsGutterClassName();
  const firstProject = useStore(useMemo(() => createFirstProjectSelector(), []));
  const { activeProject: focusedProject, activeThread, focusedThreadId } = useFocusedChatContext();
  const activeProject = focusedProject ?? firstProject ?? null;

  const preferredProvider =
    activeThread?.modelSelection.provider ??
    activeProject?.defaultModelSelection?.provider ??
    "codex";

  const [selectedProvider, setSelectedProvider] = useState<ProviderKind>(preferredProvider);
  const [selectedTab, setSelectedTab] = useState<DiscoveryTab>("plugins");
  const [pluginFilter, setPluginFilter] = useState<PluginFilter>("all");
  const [skillFilter, setSkillFilter] = useState<SkillFilter>("all");
  const [selectedPluginKey, setSelectedPluginKey] = useState<string | null>(null);
  const [pluginSearch, setPluginSearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const deferredPluginSearch = useDeferredValue(pluginSearch);
  const deferredSkillSearch = useDeferredValue(skillSearch);
  const providerThreadId = focusedThreadId;

  useEffect(() => {
    setSelectedPluginKey(null);
  }, [selectedProvider]);

  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const codexCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("codex"));
  const claudeCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("claudeAgent"));
  const cursorCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("cursor"));
  const poolsideCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("poolside"));
  const geminiCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("gemini"));
  const grokCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("grok"));
  const droidCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("droid"));
  const kiloCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("kilo"));
  const openCodeCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("opencode"));
  const piCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("pi"));

  const providerCapabilities = useMemo<Record<ProviderKind, ProviderCapabilities>>(
    () => ({
      codex: {
        plugins: supportsPluginDiscovery(codexCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(codexCapabilitiesQuery.data),
      },
      claudeAgent: {
        plugins: supportsPluginDiscovery(claudeCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(claudeCapabilitiesQuery.data),
      },
      cursor: {
        plugins: supportsPluginDiscovery(cursorCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(cursorCapabilitiesQuery.data),
      },
      poolside: {
        plugins: supportsPluginDiscovery(poolsideCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(poolsideCapabilitiesQuery.data),
      },
      gemini: {
        plugins: supportsPluginDiscovery(geminiCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(geminiCapabilitiesQuery.data),
      },
      grok: {
        plugins: supportsPluginDiscovery(grokCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(grokCapabilitiesQuery.data),
      },
      droid: {
        plugins: supportsPluginDiscovery(droidCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(droidCapabilitiesQuery.data),
      },
      kilo: {
        plugins: supportsPluginDiscovery(kiloCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(kiloCapabilitiesQuery.data),
      },
      opencode: {
        plugins: supportsPluginDiscovery(openCodeCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(openCodeCapabilitiesQuery.data),
      },
      pi: {
        plugins: supportsPluginDiscovery(piCapabilitiesQuery.data),
        skills: supportsSkillDiscovery(piCapabilitiesQuery.data),
      },
    }),
    [
      claudeCapabilitiesQuery.data,
      codexCapabilitiesQuery.data,
      cursorCapabilitiesQuery.data,
      poolsideCapabilitiesQuery.data,
      geminiCapabilitiesQuery.data,
      grokCapabilitiesQuery.data,
      droidCapabilitiesQuery.data,
      kiloCapabilitiesQuery.data,
      openCodeCapabilitiesQuery.data,
      piCapabilitiesQuery.data,
    ],
  );

  // Auto-fallback: switch provider when current tab/provider combo is unsupported
  useEffect(() => {
    const supportsTab = supportsProviderDiscoveryTab({
      provider: selectedProvider,
      tab: selectedTab,
      capabilities: providerCapabilities[selectedProvider],
    });
    if (supportsTab) return;
    const fallbackOrder =
      selectedTab === "plugins"
        ? PROVIDER_DISCOVERY_ORDER
        : [preferredProvider, ...PROVIDER_DISCOVERY_ORDER.filter((p) => p !== preferredProvider)];
    const fallback =
      fallbackOrder.find((provider) =>
        supportsProviderDiscoveryTab({
          provider,
          tab: selectedTab,
          capabilities: providerCapabilities[provider],
        }),
      ) ?? null;
    if (fallback) setSelectedProvider(fallback);
  }, [preferredProvider, providerCapabilities, selectedProvider, selectedTab]);

  const discoveryCwd = resolveProviderDiscoveryCwd({
    activeThreadWorktreePath: activeThread?.worktreePath ?? null,
    activeProjectCwd: activeProject?.cwd ?? null,
    serverCwd: serverConfigQuery.data?.cwd ?? null,
  });

  const providerLabel = PROVIDER_DISPLAY_NAMES[selectedProvider];
  const canListPlugins = providerCapabilities[selectedProvider].plugins;
  const canListSkills = providerCapabilities[selectedProvider].skills;

  const pluginsQueryOptions = providerPluginsQueryOptions({
    provider: selectedProvider,
    cwd: discoveryCwd,
    threadId: providerThreadId,
    forceRemoteSync: selectedProvider === "codex",
    enabled:
      canListPlugins &&
      (selectedTab === "plugins" || (selectedTab === "skills" && selectedProvider === "codex")),
  });
  const pluginsQuery = useQuery(pluginsQueryOptions);

  const skillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: selectedProvider,
      cwd: discoveryCwd,
      threadId: providerThreadId,
      enabled: selectedTab === "skills" && canListSkills && discoveryCwd !== null,
    }),
  );

  const discoveredSkills = useMemo(
    () => skillsQuery.data?.skills ?? [],
    [skillsQuery.data?.skills],
  );

  const pluginEntries = useMemo<PluginEntry[]>(() => {
    const featuredIds = new Set(pluginsQuery.data?.featuredPluginIds ?? []);
    return (pluginsQuery.data?.marketplaces ?? []).flatMap((m) =>
      m.plugins.map((plugin) => ({
        marketplaceName: m.name,
        marketplacePath: m.path,
        plugin,
        isFeatured: featuredIds.has(plugin.id),
      })),
    );
  }, [pluginsQuery.data]);

  const installedPluginEntries = useMemo(
    () => pluginEntries.filter((entry) => isInstalledProviderPlugin(entry.plugin)),
    [pluginEntries],
  );

  const pluginSkillEntries = useMemo<PluginSkillEntry[]>(
    () =>
      pluginEntries.flatMap((entry) =>
        (entry.plugin.bundledSkills ?? []).map((skill) => ({ entry, skill })),
      ),
    [pluginEntries],
  );

  const installedPluginSkillEntries = useMemo(
    () => pluginSkillEntries.filter((item) => isInstalledProviderPlugin(item.entry.plugin)),
    [pluginSkillEntries],
  );

  const localSkills = useMemo(() => {
    const catalogSkillNames = new Set(
      pluginSkillEntries.map((item) => normalizeProviderDiscoveryText(item.skill.name)),
    );
    return discoveredSkills.filter(
      (skill) => !catalogSkillNames.has(normalizeProviderDiscoveryText(skill.name)),
    );
  }, [discoveredSkills, pluginSkillEntries]);

  const filteredPluginEntries = useMemo(() => {
    const q = normalizeProviderDiscoveryText(deferredPluginSearch);
    const visibleEntries = pluginFilter === "installed" ? installedPluginEntries : pluginEntries;
    if (!q) return visibleEntries;
    return rankProviderDiscoveryItems(visibleEntries, q, (entry) =>
      buildPluginSearchFields(entry.plugin),
    );
  }, [deferredPluginSearch, installedPluginEntries, pluginEntries, pluginFilter]);

  const selectedPluginEntry = useMemo(
    () =>
      selectedPluginKey
        ? (pluginEntries.find((entry) => pluginEntryKey(entry) === selectedPluginKey) ?? null)
        : null,
    [pluginEntries, selectedPluginKey],
  );

  const [pluginOperationStage, setPluginOperationStage] =
    useState<ProviderPluginOperationStage | null>(null);

  const restartCodexAgentForPlugins = async () => {
    if (!providerThreadId) return;
    try {
      await ensureNativeApi().orchestration.dispatchCommand({
        type: "thread.session.stop",
        commandId: newCommandId(),
        threadId: providerThreadId,
        createdAt: new Date().toISOString(),
      });
      toastManager.add({
        type: "success",
        title: "Codex agent restarted",
        description: "The next message will start a fresh session with the updated plugins.",
      });
      void queryClient.invalidateQueries({ queryKey: providerDiscoveryQueryKeys.all });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not restart agent",
        description:
          error instanceof Error
            ? error.message
            : "Stop the session from chat, then send a new message.",
      });
    }
  };

  const pluginMutation = useMutation({
    mutationFn: async (input: {
      entry: PluginEntry;
      installed: boolean;
      requestedSkillName?: string;
    }) => {
      if (selectedProvider !== "codex") {
        throw new Error(
          `${PROVIDER_DISPLAY_NAMES[selectedProvider]} does not support plugin installation here.`,
        );
      }
      setPluginOperationStage("queued");
      const stageTicker = window.setInterval(() => {
        setPluginOperationStage((current) => {
          if (current === "queued") return input.installed ? "installing" : "removing";
          if (current === "installing" || current === "removing") return "refreshing";
          if (current === "refreshing") return "verifying";
          return current;
        });
      }, 900);
      try {
        return await ensureNativeApi().provider.setPluginInstalled({
          provider: selectedProvider,
          marketplaceName: input.entry.marketplaceName,
          pluginName: input.entry.plugin.name,
          installed: input.installed,
          ...(discoveryCwd ? { cwd: discoveryCwd } : {}),
          ...(providerThreadId ? { threadId: providerThreadId } : {}),
        });
      } finally {
        window.clearInterval(stageTicker);
      }
    },
    onSuccess: (result, input) => {
      const finalStage =
        [...(result.stages ?? [])]
          .reverse()
          .find((stage) => stage === "complete" || stage === "failed") ?? "complete";
      setPluginOperationStage(finalStage);
      queryClient.setQueryData<ProviderListPluginsResult>(pluginsQueryOptions.queryKey, (current) =>
        current
          ? {
              ...current,
              cached: false,
              marketplaces: current.marketplaces.map((marketplace) => ({
                ...marketplace,
                plugins: marketplace.plugins.map((plugin) =>
                  plugin.id === input.entry.plugin.id
                    ? { ...plugin, installed: result.installed, enabled: result.installed }
                    : plugin,
                ),
              })),
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: pluginsQueryOptions.queryKey });
      void queryClient.invalidateQueries({ queryKey: providerDiscoveryQueryKeys.all });
      const pluginLabel = input.entry.plugin.interface?.displayName ?? input.entry.plugin.name;
      const installingSkill = result.installed && input.requestedSkillName !== undefined;
      const needsRestart = result.requiresAgentRestart === true && Boolean(providerThreadId);
      toastManager.add({
        type: "success",
        title: installingSkill
          ? "Skill installed"
          : result.installed
            ? "Plugin installed"
            : "Plugin removed",
        description: installingSkill
          ? `${input.requestedSkillName} was installed with ${pluginLabel}.${needsRestart ? " Restart the Codex agent to use it." : " Start a new Codex agent to use it."}`
          : result.installed
            ? needsRestart
              ? `${pluginLabel} is installed. Restart the Codex agent to load it in this thread.`
              : `${pluginLabel} is ready for new Codex agents.`
            : `${pluginLabel} was removed from Codex.`,
        ...(needsRestart
          ? {
              actionProps: {
                children: "Restart agent",
                onClick: () => {
                  void restartCodexAgentForPlugins();
                },
              },
            }
          : {}),
      });
      window.setTimeout(() => setPluginOperationStage(null), 1200);
    },
    onError: (error, input) => {
      setPluginOperationStage("failed");
      toastManager.add({
        type: "error",
        title: input.installed
          ? input.requestedSkillName
            ? "Skill install failed"
            : "Plugin install failed"
          : "Plugin removal failed",
        description: error instanceof Error ? error.message : "The Codex plugin command failed.",
      });
      window.setTimeout(() => setPluginOperationStage(null), 1800);
    },
  });

  const setPluginInstalled = (entry: PluginEntry, installed: boolean) => {
    if (pluginMutation.isPending) return;
    pluginMutation.mutate({ entry, installed });
  };

  const installPluginSkill = (item: PluginSkillEntry) => {
    if (pluginMutation.isPending) return;
    pluginMutation.mutate({
      entry: item.entry,
      installed: true,
      requestedSkillName: item.skill.interface?.displayName ?? item.skill.name,
    });
  };

  const pluginSections = useMemo(() => {
    const featured =
      pluginFilter === "all" ? filteredPluginEntries.filter((entry) => entry.isFeatured) : [];
    const categorizedEntries =
      featured.length > 0
        ? filteredPluginEntries.filter((entry) => !entry.isFeatured)
        : filteredPluginEntries;
    const map = new Map<string, PluginEntry[]>();
    for (const entry of categorizedEntries) {
      const category = pluginCategory(entry.plugin);
      const existing = map.get(category);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(category, [entry]);
      }
    }
    const categories = Array.from(map.entries())
      .toSorted(
        ([left], [right]) => categoryRank(left) - categoryRank(right) || left.localeCompare(right),
      )
      .map(([category, entries]) => ({ key: category, title: category, entries }));
    return featured.length > 0
      ? [{ key: "featured", title: "Featured", entries: featured }, ...categories]
      : categories;
  }, [filteredPluginEntries, pluginFilter]);

  const filteredPluginSkills = useMemo(() => {
    const q = normalizeProviderDiscoveryText(deferredSkillSearch);
    const visible = skillFilter === "installed" ? installedPluginSkillEntries : pluginSkillEntries;
    if (!q) return visible;
    return rankProviderDiscoveryItems(visible, q, (item) => [
      ...buildSkillSearchFields(item.skill),
      ...buildPluginSearchFields(item.entry.plugin),
    ]);
  }, [deferredSkillSearch, installedPluginSkillEntries, pluginSkillEntries, skillFilter]);

  const filteredLocalSkills = useMemo(() => {
    const q = normalizeProviderDiscoveryText(deferredSkillSearch);
    if (!q) return localSkills;
    return rankProviderDiscoveryItems(localSkills, q, buildSkillSearchFields);
  }, [deferredSkillSearch, localSkills]);

  const installedSkillCount = installedPluginSkillEntries.length + localSkills.length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden isolate">
      <div className="flex h-full flex-col">
        {/* ── Top nav ───────────────────────────────────────────────────── */}
        <div
          className={cn(
            "drag-region @container flex shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6",
            desktopTopBarTrafficLightGutterClassName,
            desktopTopBarWindowControlsGutterClassName,
          )}
        >
          <SidebarHeaderNavigationControls />
          <div className="flex items-end gap-3">
            <TabButton
              label="Plugins"
              active={selectedTab === "plugins"}
              onClick={() => setSelectedTab("plugins")}
            />
            <TabButton
              label="Skills"
              active={selectedTab === "skills"}
              onClick={() => setSelectedTab("skills")}
            />
          </div>
          <div className="flex-1" />
          <div className="inline-flex rounded-full border border-border/60 bg-background/60 p-0.5">
            {PROVIDER_DISCOVERY_ORDER.map((provider) => {
              const capabilities = providerCapabilities[provider];
              const label = PROVIDER_DISPLAY_NAMES[provider];
              return (
                <ProviderToggleButton
                  key={provider}
                  label={label}
                  provider={provider}
                  active={selectedProvider === provider}
                  disabled={!capabilities.plugins && !capabilities.skills}
                  onClick={() => {
                    setSelectedProvider(provider);
                    if (
                      !supportsProviderDiscoveryTab({
                        provider,
                        tab: selectedTab,
                        capabilities,
                      })
                    ) {
                      setSelectedTab(selectedTab === "plugins" ? "skills" : "plugins");
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Search */}
          <div className="mx-auto max-w-4xl space-y-4 px-6 pb-5 pt-8">
            <InputGroup className="rounded-xl bg-background/70 shadow-xs">
              <InputGroupAddon>
                <InputGroupText>
                  <SearchIcon className="size-4 text-muted-foreground/60" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                value={selectedTab === "plugins" ? pluginSearch : skillSearch}
                onChange={(e) => {
                  if (selectedTab === "plugins") setPluginSearch(e.target.value);
                  else setSkillSearch(e.target.value);
                }}
                placeholder={selectedTab === "plugins" ? "Search plugins" : "Search skills"}
                className="text-sm"
              />
            </InputGroup>
            {pluginOperationStage ? (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                  pluginOperationStage === "failed"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : pluginOperationStage === "complete"
                      ? "border-border/60 bg-background/70 text-muted-foreground"
                      : "border-border/60 bg-background/70 text-foreground",
                )}
              >
                {pluginOperationStage === "complete" || pluginOperationStage === "failed" ? null : (
                  <Loader2Icon className="size-3.5 animate-spin" />
                )}
                <span>
                  {PLUGIN_STAGE_LABELS[pluginOperationStage]}
                  {pluginMutation.isPending ? "…" : ""}
                </span>
              </div>
            ) : null}
            {selectedTab === "plugins" ? (
              <>
                {pluginFilter === "all" && pluginSearch.length === 0 ? (
                  <InstalledPluginStrip
                    entries={installedPluginEntries}
                    onSelect={(entry) => setSelectedPluginKey(pluginEntryKey(entry))}
                  />
                ) : null}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="inline-flex rounded-lg border border-border/60 bg-background/60 p-0.5">
                    {(["all", "installed"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          pluginFilter === filter
                            ? "bg-[var(--sidebar-accent-active)] text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        aria-pressed={pluginFilter === filter}
                        onClick={() => setPluginFilter(filter)}
                      >
                        {filter === "all"
                          ? "Explore"
                          : `Installed (${installedPluginEntries.length})`}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pluginEntries.length} available
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="inline-flex rounded-lg border border-border/60 bg-background/60 p-0.5">
                  {(["all", "installed"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        skillFilter === filter
                          ? "bg-[var(--sidebar-accent-active)] text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={skillFilter === filter}
                      onClick={() => setSkillFilter(filter)}
                    >
                      {filter === "all" ? "Explore" : `Installed (${installedSkillCount})`}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {pluginSkillEntries.length} available
                </span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {((!discoveryCwd && selectedTab === "skills") ||
            (selectedTab === "plugins" && !!pluginsQuery.data?.remoteSyncError) ||
            (selectedTab === "plugins" &&
              (pluginsQuery.data?.marketplaceLoadErrors.length ?? 0) > 0)) && (
            <div className="mx-auto max-w-4xl space-y-1.5 px-6 pb-4">
              {!discoveryCwd && selectedTab === "skills" ? (
                <InlineWarning>
                  Open a project or thread to include workspace and provider-local skills. Plugin
                  skills can still be installed here.
                </InlineWarning>
              ) : null}
              {selectedTab === "plugins" && pluginsQuery.data?.remoteSyncError ? (
                <InlineWarning>{pluginsQuery.data.remoteSyncError}</InlineWarning>
              ) : null}
              {selectedTab === "plugins" &&
              (pluginsQuery.data?.marketplaceLoadErrors.length ?? 0) > 0 ? (
                <InlineWarning>
                  {pluginsQuery.data?.marketplaceLoadErrors
                    .map((err) => `${sectionTitle(err.marketplacePath)}: ${err.message}`)
                    .join(" • ")}
                </InlineWarning>
              ) : null}
            </div>
          )}

          {/* Grid content */}
          <div className="mx-auto max-w-4xl px-6 pb-16">
            {selectedTab === "plugins" ? (
              <>
                {!canListPlugins ? (
                  <div className="mx-auto max-w-2xl">
                    <EmptyPanel
                      title={`Plugins unavailable for ${providerLabel}`}
                      description="This provider does not expose plugin discovery."
                    />
                  </div>
                ) : pluginsQuery.isLoading && pluginEntries.length === 0 ? (
                  <div className="space-y-1">
                    {["1", "2", "3", "4", "5", "6"].map((k) => (
                      <Skeleton key={k} className="h-[68px] w-full rounded-xl" />
                    ))}
                  </div>
                ) : filteredPluginEntries.length === 0 ? (
                  <EmptyPanel
                    title={
                      pluginFilter === "installed"
                        ? "No installed plugins found"
                        : "No plugins found"
                    }
                    description={
                      pluginSearch
                        ? "No plugins match this search."
                        : pluginFilter === "installed"
                          ? "Install a plugin from Explore and it will appear here."
                          : "No marketplaces exposed plugins for this Codex setup."
                    }
                  />
                ) : (
                  <div className="space-y-10">
                    {pluginSections.map((section) => (
                      <div key={section.key}>
                        <SectionHeader title={section.title} />
                        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                          {section.entries.map((entry) => (
                            <PluginGridItem
                              key={pluginEntryKey(entry)}
                              entry={entry}
                              installing={
                                pluginMutation.isPending &&
                                pluginMutation.variables !== undefined &&
                                pluginEntryKey(pluginMutation.variables.entry) ===
                                  pluginEntryKey(entry)
                              }
                              installationSupported={selectedProvider === "codex"}
                              onSelect={() => setSelectedPluginKey(pluginEntryKey(entry))}
                              onInstall={() => setPluginInstalled(entry, true)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {!canListSkills ? (
                  <div className="mx-auto max-w-2xl">
                    <EmptyPanel
                      title={`Skills unavailable for ${providerLabel}`}
                      description="This provider does not expose skill discovery."
                    />
                  </div>
                ) : pluginsQuery.isLoading &&
                  selectedProvider === "codex" &&
                  pluginSkillEntries.length === 0 &&
                  discoveredSkills.length === 0 ? (
                  <div className="space-y-1">
                    {["1", "2", "3", "4", "5", "6"].map((k) => (
                      <Skeleton key={k} className="h-[68px] w-full rounded-xl" />
                    ))}
                  </div>
                ) : filteredPluginSkills.length === 0 && filteredLocalSkills.length === 0 ? (
                  <EmptyPanel
                    title={
                      skillFilter === "installed" ? "No installed skills found" : "No skills found"
                    }
                    description={
                      skillSearch
                        ? "No skills match this search."
                        : skillFilter === "installed"
                          ? "Install a skill from Explore and it will appear here."
                          : "No skills are available for this provider."
                    }
                  />
                ) : (
                  <div className="space-y-10">
                    {filteredPluginSkills.length > 0 ? (
                      <div>
                        <SectionHeader title="Plugin skills" />
                        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                          {filteredPluginSkills.map((item) => (
                            <PluginSkillGridItem
                              key={`${pluginEntryKey(item.entry)}::${item.skill.name}`}
                              item={item}
                              installing={
                                pluginMutation.isPending &&
                                pluginMutation.variables !== undefined &&
                                pluginEntryKey(pluginMutation.variables.entry) ===
                                  pluginEntryKey(item.entry)
                              }
                              installationSupported={selectedProvider === "codex"}
                              onSelectPlugin={() =>
                                setSelectedPluginKey(pluginEntryKey(item.entry))
                              }
                              onInstall={() => installPluginSkill(item)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {filteredLocalSkills.length > 0 ? (
                      <div>
                        <SectionHeader title="Local skills" />
                        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                          {filteredLocalSkills.map((skill) => (
                            <SkillGridItem key={skill.path} skill={skill} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <PluginDetailDialog
          entry={selectedPluginEntry}
          provider={selectedProvider}
          cwd={discoveryCwd}
          threadId={providerThreadId}
          changing={
            pluginMutation.isPending &&
            pluginMutation.variables !== undefined &&
            selectedPluginEntry !== null &&
            pluginEntryKey(pluginMutation.variables.entry) === pluginEntryKey(selectedPluginEntry)
          }
          installationSupported={selectedProvider === "codex"}
          onOpenChange={(open) => {
            if (!open) setSelectedPluginKey(null);
          }}
          onSetInstalled={(installed) => {
            if (selectedPluginEntry) setPluginInstalled(selectedPluginEntry, installed);
          }}
        />
      </div>
    </SidebarInset>
  );
}
