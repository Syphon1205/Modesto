// FILE: AutomationsPage.tsx
// Purpose: Cursor-style Automations home — featured agents, Mine list, templates.
// Layer: Automations UI

import { useAtomValue } from "@effect/atom-react";
import type { AutomationSummary } from "@modesto/contracts";
import { useNavigate } from "@tanstack/react-router";
import {
  BugIcon,
  FlaskConicalIcon,
  GitPullRequestIcon,
  InboxIcon,
  SearchIcon,
  ShieldIcon,
  SunIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { APP_BASE_NAME } from "~/branding";
import { GridDistortion } from "~/components/GridDistortion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import { automationList, automationSetState } from "~/state/automations";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

import { describeNextRun, describeSchedule } from "./automationSchedule";
import { WebhookPanel } from "./WebhookPanel";
import {
  AUTOMATION_TEMPLATE_CATEGORIES,
  FEATURED_CAPABILITIES,
  templatesForCategory,
  type AutomationTemplate,
  type AutomationTemplateCategory,
  type FeaturedCapability,
} from "./automationTemplates";

function TemplateIcon({
  icon,
  className,
}: {
  readonly icon: AutomationTemplate["icon"];
  readonly className?: string;
}) {
  const props = { className: cn("size-4", className), "aria-hidden": true as const };
  switch (icon) {
    case "bug":
      return <BugIcon {...props} />;
    case "shield":
      return <ShieldIcon {...props} />;
    case "search":
      return <SearchIcon {...props} />;
    case "sun":
      return <SunIcon {...props} />;
    case "git":
      return <GitPullRequestIcon {...props} />;
    case "flask":
      return <FlaskConicalIcon {...props} />;
    case "inbox":
      return <InboxIcon {...props} />;
    case "zap":
      return <ZapIcon {...props} />;
  }
}

function LastRunLine({ automation }: { readonly automation: AutomationSummary }) {
  const run = automation.latestRun;
  if (!run) return <span className="text-muted-foreground">Never run</span>;
  if (run.status === "running" || run.status === "claimed") {
    return <span className="text-muted-foreground">Running now…</span>;
  }
  if (run.status === "failed") {
    return (
      <span className="text-destructive-foreground">
        Last run failed{run.errorMessage ? `: ${run.errorMessage}` : ""}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      Last run {run.status}
      {run.resultSummary ? ` · ${run.resultSummary}` : ""}
    </span>
  );
}

function AutomationRow({
  automation,
  now,
  onToggle,
  busy,
}: {
  readonly automation: AutomationSummary;
  readonly now: number;
  readonly onToggle: (next: "active" | "inactive") => void;
  readonly busy: boolean;
}) {
  const active = automation.state === "active";
  return (
    <li className="rounded-xl border border-border/70 bg-card/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{automation.name}</span>
            {automation.state === "needs_attention" ? (
              <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] text-amber-600 dark:text-amber-300/90">
                Needs attention
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {describeSchedule(automation.schedule)} ·{" "}
            {active ? describeNextRun(automation.nextDueAt, now, automation.schedule) : "Paused"}
          </p>
          <p className="mt-0.5 truncate text-[11.5px]">
            <LastRunLine automation={automation} />
          </p>
        </div>
        <Switch
          checked={active}
          disabled={busy}
          onCheckedChange={(checked) => onToggle(checked ? "active" : "inactive")}
          aria-label={`${active ? "Pause" : "Resume"} ${automation.name}`}
        />
      </div>
    </li>
  );
}

function FeaturedHero({
  onGetStarted,
}: {
  readonly onGetStarted: (capability: FeaturedCapability) => void;
}) {
  const [activeId, setActiveId] = useState(FEATURED_CAPABILITIES[1]?.id ?? "security");
  const active =
    FEATURED_CAPABILITIES.find((capability) => capability.id === activeId) ??
    FEATURED_CAPABILITIES[0];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">From {APP_BASE_NAME}</h2>
      <div className="relative overflow-hidden rounded-2xl border border-border/70">
        <GridDistortion className="absolute inset-0" />
        <div className="relative z-10 flex min-h-[18rem] flex-col justify-between gap-5 bg-gradient-to-r from-background/88 via-background/70 to-background/35 p-5 sm:p-6 md:min-h-[20rem] md:max-w-[28rem]">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              Ship better code, faster
            </h3>
            <ul className="mt-4 space-y-1">
              {FEATURED_CAPABILITIES.map((capability) => {
                const selected = capability.id === active?.id;
                return (
                  <li key={capability.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(capability.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        selected ? "bg-background/70 backdrop-blur-sm" : "hover:bg-background/45",
                      )}
                    >
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <TemplateIcon icon={capability.icon} className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {capability.title}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">
                          {capability.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <Button
            className="w-full sm:w-auto sm:self-start"
            onClick={() => {
              if (active) onGetStarted(active);
            }}
          >
            Get Started →
          </Button>
        </div>
      </div>
    </section>
  );
}

function TemplateCard({
  template,
  onUse,
}: {
  readonly template: AutomationTemplate;
  readonly onUse: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="flex h-full flex-col rounded-2xl border border-border/70 bg-card/25 p-4 text-left transition-colors hover:bg-card/45"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TemplateIcon icon={template.icon} />
      </span>
      <span className="mt-3 text-sm font-semibold text-foreground">{template.name}</span>
      <span className="mt-1 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {template.description}
      </span>
      <span className="mt-4 text-[11.5px] text-muted-foreground">
        {template.triggerLabel} → {template.actionLabel}
      </span>
    </button>
  );
}

function EmptyMine({ onCreate }: { readonly onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 px-6 py-14 text-center">
      <h3 className="text-base font-semibold tracking-tight">No Automations Yet</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Automate repetitive tasks with always-on scheduled agents — digests, reviews, and health
        checks that run without opening a thread.
      </p>
      <Button className="mt-5" variant="outline" onClick={onCreate}>
        New Automation
      </Button>
    </div>
  );
}

export function AutomationsPage() {
  const navigate = useNavigate();
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const list = useEnvironmentQuery(
    environmentId === null ? null : automationList({ environmentId, input: {} }),
  );
  const setStateCommand = useAtomCommand(automationSetState);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AutomationTemplateCategory | "all">("popular");
  const [showRuns, setShowRuns] = useState(false);

  const openCreate = useCallback(
    (templateId?: string) => {
      void navigate({
        to: "/automations/new",
        ...(templateId ? { search: { template: templateId } } : { search: {} }),
      });
    },
    [navigate],
  );

  const handleToggle = useCallback(
    async (automationId: string, state: "active" | "inactive") => {
      if (environmentId === null) return;
      setTogglingId(automationId);
      try {
        await setStateCommand({ environmentId, input: { automationId, state } });
      } finally {
        setTogglingId(null);
      }
    },
    [environmentId, setStateCommand],
  );

  const automations = list.data?.automations ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return automations;
    return automations.filter(
      (automation) =>
        automation.name.toLowerCase().includes(needle) ||
        automation.instructions.toLowerCase().includes(needle),
    );
  }, [automations, query]);
  const templates = useMemo(() => templatesForCategory(category), [category]);
  const recentRuns = useMemo(
    () =>
      automations
        .flatMap((automation) =>
          automation.latestRun
            ? [{ automationName: automation.name, run: automation.latestRun }]
            : [],
        )
        .toSorted((left, right) => (right.run.startedAt ?? 0) - (left.run.startedAt ?? 0)),
    [automations],
  );
  const now = Date.now();

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-8 sm:px-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Automations</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Automate repetitive tasks with always-on agents and configure {APP_BASE_NAME}&apos;s
                scheduled agents for your workspace.
              </p>
            </div>
            <Button onClick={() => openCreate()}>New Automation</Button>
          </header>

          <WebhookPanel environmentId={environmentId} automations={automations} />

          <FeaturedHero
            onGetStarted={(capability) => {
              openCreate(capability.templateId);
            }}
          />

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1 rounded-full border border-border/70 p-1">
                <TabPill active={tab === "mine"} onClick={() => setTab("mine")}>
                  Mine
                </TabPill>
                <TabPill active={tab === "team"} onClick={() => setTab("team")}>
                  Team
                </TabPill>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowRuns((current) => !current)}
                >
                  All Runs {showRuns ? "▾" : "↗"}
                </button>
                <div className="relative min-w-[12rem] flex-1 sm:w-56">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search"
                    aria-label="Search automations"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
            </div>

            {showRuns ? (
              <div className="rounded-2xl border border-border/70 bg-card/20 p-4">
                <h3 className="text-sm font-medium">Recent runs</h3>
                {recentRuns.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No runs yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {recentRuns.map(({ automationName, run }) => (
                      <li
                        key={run.id}
                        className="flex items-center justify-between gap-3 text-[12.5px]"
                      >
                        <span className="min-w-0 truncate font-medium">{automationName}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {run.status}
                          {run.startedAt ? ` · ${new Date(run.startedAt).toLocaleString()}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {tab === "team" ? (
              <div className="rounded-2xl border border-dashed border-border/80 px-6 py-12 text-center">
                <h3 className="text-base font-semibold">Team automations are local-only for now</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Sharing across an org comes later. Your scheduled agents still live under Mine on
                  this machine.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyMine onCreate={() => openCreate()} />
            ) : (
              <ul className="space-y-2">
                {filtered.map((automation) => (
                  <AutomationRow
                    key={automation.id}
                    automation={automation}
                    now={now}
                    busy={togglingId === automation.id}
                    onToggle={(state) => void handleToggle(automation.id, state)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4 pb-8">
            <div className="flex flex-wrap gap-1.5">
              {AUTOMATION_TEMPLATE_CATEGORIES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setCategory(entry.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                    category === entry.id
                      ? "bg-foreground text-background"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={() => openCreate(template.id)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-muted text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
