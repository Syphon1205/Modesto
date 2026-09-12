// FILE: ConnectionsPage.tsx
// Purpose: The Connections surface - the web apps Modesto can work inside,
//          and whether you are signed in to each one.
// Layer: Connections UI
//
// Connecting here means what it means everywhere else: you sign in to the app,
// in Modesto's own browser. The session then lives in that browser's partition
// exactly as it would in Chrome, and "connected" is a fact about that session
// rather than a token Modesto stored. That is the whole reason this surface
// exists separately from the MCP catalog in `connectionsCatalog.ts`, which
// connects a service by installing a server and running an OAuth flow against
// the user's account.
//
// Sign-in state is observed, not stored: `useWebAppConnections` asks the
// desktop bridge whether that browser's cookie jar carries each site's session
// cookies. The probe returns names and expiry only - a session cookie's value
// is the credential itself, so it never crosses the bridge.
//
// Presentation notes: this page is a flat, dense surface - hairline rules,
// one accent, no filled panels - and every interactive element borrows its
// motion from `lib/motion.ts` rather than hand-rolling a transition. What
// filters, groups, and counts lives in `ConnectionsPage.logic.ts` so this file
// is only layout.

import { CheckIcon, CopyIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nativeAppMentionLabel, type NativeApp } from "@modesto/shared/nativeApps";

import { GridDistortion } from "~/components/GridDistortion";
import { nativeAppBrandHex, nativeAppIcon } from "~/components/NativeAppIcons";
import { webAppBrandHex, webAppIcon } from "~/components/WebAppIcons";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Kbd } from "~/components/ui/kbd";
import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";
import {
  MOTION_CONTROL_CLASS,
  MOTION_FADE_CLASS,
  MOTION_SURFACE_CLASS,
  motionEnter,
  motionStaggerIndex,
} from "~/lib/motion";
import { cn } from "~/lib/utils";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { ConnectionsHeroStage } from "./ConnectionsHeroStage";
import type { ConnectionsHeroLogoId } from "./ConnectionsHeroStage.logic";
import { CONNECTIONS_HERO_LOGO_IDS } from "./ConnectionsHeroStage.logic";
import {
  ADOBE_CATEGORY_LABEL,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  NATIVE_APP_CARD_DESCRIPTION,
  canReportSignIn,
  categoryMatchCounts,
  connectionCopyForMarketplaceItem,
  connectionCopyForWebApp,
  countConnectedApps,
  filterConnectionApps,
  filterConnectionNativeApps,
  groupConnectionApps,
  type ConnectionsCategoryFilter,
} from "./ConnectionsPage.logic";
import { WORK_MARKETPLACE_ITEMS } from "./connectionsCatalog";
import { useWebAppConnections, type WebAppConnectionStatuses } from "./useWebAppConnections";
import {
  describeConnectionStatus,
  isExpiringSoon,
  type WebAppConnectionStatus,
} from "./webAppConnections";
import { WEB_APPS, WEB_APP_BY_ID, webAppMentionLabel, type WebApp } from "./webApps";

const WEB_APP_MCP_SERVER_NAMES = new Set(
  WEB_APPS.flatMap((app) => (app.mcpServerName ? [app.mcpServerName, app.id] : [app.id])),
);

const MCP_ONLY_MARKETPLACE_ITEMS = WORK_MARKETPLACE_ITEMS.filter((item) => {
  if (item.install !== "mcp-http" && item.install !== "mcp-stdio") return false;
  return !WEB_APP_MCP_SERVER_NAMES.has(item.id) && !WEB_APP_MCP_SERVER_NAMES.has(item.serverName);
});

/** State colour for a status, used for both the dot and its halo. */
function statusColor(status: WebAppConnectionStatus, expiringSoon: boolean): string {
  if (status.kind !== "connected") return "var(--muted-foreground)";
  return expiringSoon ? "var(--color-amber-500)" : "var(--color-emerald-500)";
}

function StatusDot({
  status,
  showLabel = true,
}: {
  readonly status: WebAppConnectionStatus;
  readonly showLabel?: boolean;
}) {
  const expiringSoon = isExpiringSoon(status, Math.floor(Date.now() / 1000));
  const label = expiringSoon ? "Expiring soon" : describeConnectionStatus(status);
  const color = statusColor(status, expiringSoon);

  return (
    <span
      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
      title={showLabel ? undefined : label}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          // A live session gets a slow halo, an unanswered probe breathes.
          // Everything settled sits still - motion here means "something is
          // true right now", not decoration.
          status.kind === "connected" && "connection-dot-live",
          status.kind === "checking" && "connection-dot-checking",
        )}
        style={
          {
            backgroundColor: color,
            opacity: status.kind === "connected" ? 1 : 0.55,
            "--connection-dot": color,
          } as React.CSSProperties
        }
      />
      {showLabel ? label : <span className="sr-only">{label}</span>}
    </span>
  );
}

/**
 * Signed-in tally as a hairline meter. The rail is always full width so the
 * number and the bar tell the same story at a glance.
 */
function ConnectedMeter({
  connectedCount,
  totalCount,
}: {
  readonly connectedCount: number;
  readonly totalCount: number;
}) {
  const ratio = totalCount === 0 ? 0 : connectedCount / totalCount;
  return (
    <div className="mt-6 max-w-xs">
      <div className="flex items-baseline gap-1.5 text-[12px]">
        <span className="font-medium text-foreground tabular-nums">{connectedCount}</span>
        <span className="text-muted-foreground">of {totalCount} signed in</span>
      </div>
      <div className="mt-2 h-px w-full bg-border">
        <div
          className="h-px bg-emerald-500 transition-[width] duration-(--motion-slow) ease-fluid motion-reduce:transition-none"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Hero copy follows the coverflow: whichever tile is facing front names the
 * mention shown in the example line, so the words and the marks are never
 * describing two different apps.
 */
function ConnectionsHero({
  statuses,
  connectedCount,
  onCopyMention,
  copiedMention,
}: {
  readonly statuses: WebAppConnectionStatuses;
  readonly connectedCount: number;
  readonly onCopyMention: (mention: string) => void;
  readonly copiedMention: string | null;
}) {
  const [featuredId, setFeaturedId] = useState<ConnectionsHeroLogoId>(CONNECTIONS_HERO_LOGO_IDS[0]);
  const featured = WEB_APP_BY_ID[featuredId];
  const mention = featured ? webAppMentionLabel(featured) : "@drive";
  const copied = copiedMention === mention;

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/50">
      <GridDistortion className="opacity-[0.55] [mask-image:radial-gradient(120%_100%_at_18%_0%,#000,transparent_72%)] [mask-size:100%_100%] [mask-repeat:no-repeat]" />
      <div className="relative z-10 grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="px-6 py-8 sm:px-7">
          <p className="font-mono text-[10.5px] tracking-[0.16em] text-muted-foreground uppercase">
            Connections
          </p>
          <h1 className="mt-2.5 text-[26px] leading-tight font-semibold tracking-tight text-foreground">
            Work in the apps you already use
          </h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Sign in once in Modesto's browser. The session stays there, exactly as it would in
            Chrome — nothing is stored on your behalf.
          </p>

          <div className="mt-5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <span>Mention</span>
            <button
              type="button"
              onClick={() => onCopyMention(mention)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card/40 px-2 py-1 font-mono text-[11.5px] text-foreground",
                MOTION_CONTROL_CLASS,
                "hover:border-border hover:bg-card",
              )}
              aria-label={`Copy ${mention}`}
            >
              <span className="tabular-nums">{mention}</span>
              {copied ? (
                <CheckIcon className="size-3 text-emerald-500" />
              ) : (
                <CopyIcon className="size-3 text-muted-foreground" />
              )}
            </button>
            <span>in chat.</span>
          </div>

          {canReportSignIn(statuses) ? (
            <ConnectedMeter connectedCount={connectedCount} totalCount={WEB_APPS.length} />
          ) : (
            <p className="mt-6 text-[12px] text-muted-foreground">
              Sign-in state is a desktop-app fact — this build can't read the browser session.
            </p>
          )}
        </div>
        <ConnectionsHeroStage onFeaturedChange={setFeaturedId} />
      </div>
    </section>
  );
}

function AppCard({
  app,
  status,
  copied,
  index,
  onCopy,
}: {
  readonly app: WebApp;
  readonly status: WebAppConnectionStatus;
  readonly copied: boolean;
  readonly index: number;
  readonly onCopy: (key: string, text: string) => void;
}) {
  const Icon = webAppIcon(app.id);
  const mention = webAppMentionLabel(app);
  const copy = connectionCopyForWebApp(app);
  const hex = webAppBrandHex(app.id);
  const enter = motionEnter(motionStaggerIndex(index));
  const copyLabel =
    copy.kind === "mcp" ? `Copy ${app.name} MCP install command` : `Copy ${mention}`;

  return (
    <button
      type="button"
      onClick={() => onCopy(copy.key, copy.text)}
      aria-label={copyLabel}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card/10 text-left",
        MOTION_SURFACE_CLASS,
        "hover:border-border hover:bg-card/40",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        enter.className,
      )}
      style={enter.style}
    >
      {/* Brand only shows up on approach - a wall of thirty always-on accent
          lines would be louder than the logos it is meant to point at. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-(--motion-base) ease-fluid group-hover:opacity-100 motion-reduce:transition-none"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
      />

      <div className="flex items-start gap-3 p-3.5 pb-2.5">
        <Icon className="mt-0.5 size-6 shrink-0 text-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-foreground">{app.name}</span>
            {app.mcpServerName ? (
              <span className="shrink-0 rounded px-1 py-px font-mono text-[9px] tracking-wide text-muted-foreground uppercase ring-1 ring-border/70">
                MCP
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {app.description}
          </p>
        </div>
        <StatusDot status={status} showLabel={false} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/40 px-3.5 py-2">
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {copy.kind === "mcp" ? "MCP command" : mention}
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-[10.5px]",
            MOTION_FADE_CLASS,
            copied ? "text-emerald-500" : "text-muted-foreground opacity-0 group-hover:opacity-100",
          )}
        >
          {copied ? (
            <>
              <CheckIcon className="size-3" /> Copied
            </>
          ) : (
            <>
              <CopyIcon className="size-3" /> Copy
            </>
          )}
        </span>
      </div>
    </button>
  );
}

function NativeAppCard({
  app,
  copied,
  index,
  onCopyMention,
}: {
  readonly app: NativeApp;
  readonly copied: boolean;
  readonly index: number;
  readonly onCopyMention: (mention: string) => void;
}) {
  const Icon = nativeAppIcon(app.id);
  const mention = nativeAppMentionLabel(app);
  const hex = nativeAppBrandHex(app.id);
  const enter = motionEnter(motionStaggerIndex(index));

  return (
    <button
      type="button"
      onClick={() => onCopyMention(mention)}
      aria-label={`Copy ${mention}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card/10 text-left",
        MOTION_SURFACE_CLASS,
        "hover:border-border hover:bg-card/40",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        enter.className,
      )}
      style={enter.style}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-(--motion-base) ease-fluid group-hover:opacity-100 motion-reduce:transition-none"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
      />

      <div className="flex items-start gap-3 p-3.5 pb-2.5">
        <Icon className="mt-0.5 size-6 shrink-0 text-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-foreground">{app.name}</span>
            <span className="shrink-0 rounded px-1 py-px font-mono text-[9px] tracking-wide text-muted-foreground uppercase ring-1 ring-border/70">
              Desktop
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {NATIVE_APP_CARD_DESCRIPTION[app.id]}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/40 px-3.5 py-2">
        <span className="truncate font-mono text-[11px] text-muted-foreground">{mention}</span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-[10.5px]",
            MOTION_FADE_CLASS,
            copied ? "text-emerald-500" : "text-muted-foreground opacity-0 group-hover:opacity-100",
          )}
        >
          {copied ? (
            <>
              <CheckIcon className="size-3" /> Copied
            </>
          ) : (
            <>
              <CopyIcon className="size-3" /> Copy
            </>
          )}
        </span>
      </div>
    </button>
  );
}

function FilterPill({
  active,
  count,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly count: number;
  readonly onClick: () => void;
  readonly children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px]",
        MOTION_CONTROL_CLASS,
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        count === 0 && "pointer-events-none opacity-35",
      )}
    >
      {children}
      <span
        className={cn(
          "font-mono text-[10px] tabular-nums",
          active ? "text-background/60" : "text-muted-foreground/60",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function ConnectionsPage() {
  const environmentId = usePrimaryEnvironmentId();
  const { statuses, refresh, probing } = useWebAppConnections(environmentId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ConnectionsCategoryFilter>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const connectedCount = countConnectedApps(statuses);
  const counts = useMemo(() => categoryMatchCounts(query), [query]);
  const grouped = useMemo(
    () => groupConnectionApps(filterConnectionApps({ query, category })),
    [category, query],
  );
  const nativeApps = useMemo(
    () => filterConnectionNativeApps({ query, category }),
    [category, query],
  );

  // One continuous stagger down the page rather than a fresh wave per group -
  // the sections are a reading aid, not separate arrivals.
  const enterOrder = useMemo(() => {
    const order = new Map<string, number>();
    let position = 0;
    for (const group of grouped) {
      for (const app of group.apps) {
        order.set(app.id, position);
        position += 1;
      }
    }
    for (const app of nativeApps) {
      order.set(app.id, position);
      position += 1;
    }
    return order;
  }, [grouped, nativeApps]);

  // `/` jumps to search the way it does in Cursor and on GitHub; Escape gets
  // you back out. Guarded so it never steals a keystroke from a real field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleCopy = useCallback((key: string, text: string) => {
    void writeTextToClipboard(text, "connection").then(() => {
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1400);
    });
  }, []);

  const handleCopyMention = useCallback(
    (mention: string) => {
      handleCopy(`mention:${mention}`, mention);
    },
    [handleCopy],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <span className="text-[13px] font-medium text-foreground">Connections</span>
        {canReportSignIn(statuses) ? (
          <span className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground tabular-nums ring-1 ring-border/60">
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", probing && "connection-dot-checking")}
              style={
                {
                  backgroundColor: "var(--color-emerald-500)",
                  "--connection-dot": "var(--color-emerald-500)",
                } as React.CSSProperties
              }
            />
            {connectedCount}/{WEB_APPS.length}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label="Re-check sign-in status"
          onClick={refresh}
        >
          <RefreshCwIcon className={cn(probing && "animate-spin")} />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8">
          <ConnectionsHero
            statuses={statuses}
            connectedCount={connectedCount}
            copiedMention={
              copiedKey?.startsWith("mention:") ? copiedKey.slice("mention:".length) : null
            }
            onCopyMention={handleCopyMention}
          />

          <div className="sticky top-0 z-20 -mx-6 mt-6 border-b border-border/40 bg-background/85 px-6 py-3 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap gap-1">
                <FilterPill
                  active={category === "all"}
                  count={counts.all}
                  onClick={() => setCategory("all")}
                >
                  All
                </FilterPill>
                {CATEGORY_ORDER.map((id) => (
                  <FilterPill
                    key={id}
                    active={category === id}
                    count={counts[id]}
                    onClick={() => setCategory(id)}
                  >
                    {CATEGORY_LABELS[id]}
                  </FilterPill>
                ))}
                <FilterPill
                  active={category === "adobe"}
                  count={counts.adobe}
                  onClick={() => setCategory("adobe")}
                >
                  {ADOBE_CATEGORY_LABEL}
                </FilterPill>
              </div>
              <div className="relative min-w-[12rem] shrink-0 sm:w-60">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    if (query.length > 0) setQuery("");
                    else event.currentTarget.blur();
                  }}
                  placeholder="Search apps"
                  aria-label="Search connections"
                  className="h-8 pr-8 pl-8 text-[12.5px]"
                />
                <span className="absolute top-1/2 right-2 -translate-y-1/2">
                  {query.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className={cn(
                        "flex size-4 items-center justify-center rounded text-muted-foreground",
                        MOTION_CONTROL_CLASS,
                        "hover:text-foreground",
                      )}
                    >
                      <XIcon className="size-3" />
                    </button>
                  ) : (
                    <Kbd className="h-4 min-w-4 bg-transparent text-[10px] ring-1 ring-border/60">
                      /
                    </Kbd>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-8">
            {grouped.length === 0 && nativeApps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-6 py-14 text-center">
                <p className="text-[13px] text-foreground">No apps match that search.</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Try a shorter word, or clear the filters.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              grouped.map((group) => (
                <section key={group.id} className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
                      {group.label}
                    </h2>
                    <span className="font-mono text-[10.5px] text-muted-foreground/50 tabular-nums">
                      {group.apps.length}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-border/50" />
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {group.apps.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        index={enterOrder.get(app.id) ?? 0}
                        status={statuses[app.id] ?? { kind: "checking" }}
                        copied={copiedKey === connectionCopyForWebApp(app).key}
                        onCopy={handleCopy}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}

            {nativeApps.length > 0 ? (
              <section className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
                    {ADOBE_CATEGORY_LABEL}
                  </h2>
                  <span className="font-mono text-[10.5px] text-muted-foreground/50 tabular-nums">
                    {nativeApps.length}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-border/50" />
                </div>
                <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
                  These open the app on this computer. Photoshop and the rest of Creative Cloud do
                  not ship a general MCP server — mention them in chat to launch the desktop app.
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {nativeApps.map((app) => (
                    <NativeAppCard
                      key={app.id}
                      app={app}
                      index={enterOrder.get(app.id) ?? 0}
                      copied={copiedKey === `mention:${nativeAppMentionLabel(app)}`}
                      onCopyMention={handleCopyMention}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-2.5">
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
                  MCP-only tools
                </h2>
                <span aria-hidden className="h-px flex-1 bg-border/50" />
              </div>
              <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
                These don't have a website to sign into here. Click one to copy the MCP install
                command, then paste it into chat so the agent can install it.
              </p>
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {MCP_ONLY_MARKETPLACE_ITEMS.map((item) => {
                  const copy = connectionCopyForMarketplaceItem(item);
                  if (copy === null) {
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1",
                          MOTION_CONTROL_CLASS,
                          "hover:border-border hover:bg-muted/40",
                        )}
                      >
                        <span className="text-[11px] text-foreground">{item.name}</span>
                        {item.badge ? (
                          <span className="font-mono text-[9.5px] text-muted-foreground">
                            {item.badge}
                          </span>
                        ) : null}
                      </li>
                    );
                  }
                  const copied = copiedKey === copy.key;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleCopy(copy.key, copy.text)}
                        aria-label={`Copy ${item.name} MCP install command`}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1",
                          MOTION_CONTROL_CLASS,
                          "hover:border-border hover:bg-muted/40",
                          copied && "border-emerald-500/40 text-emerald-600",
                        )}
                      >
                        <span className="text-[11px] text-foreground">{item.name}</span>
                        {item.badge ? (
                          <span className="font-mono text-[9.5px] text-muted-foreground">
                            {item.badge}
                          </span>
                        ) : null}
                        {copied ? (
                          <CheckIcon className="size-3 text-emerald-500" />
                        ) : (
                          <CopyIcon className="size-3 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
