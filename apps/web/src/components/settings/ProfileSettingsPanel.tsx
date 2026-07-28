// FILE: ProfileSettingsPanel.tsx
// Purpose: Local-first profile / stats dashboard rendered inside Settings → Profile. Core
// stats render instantly from a fast SQL RPC; lifetime/peak token figures and the tokens/day
// heatmap stream in from a second DB-backed RPC. Centered, low-chrome layout
// with an explicit edit mode for the local name + handle.
// Layer: web profile feature (settings panel body).

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  type ProfileCommit,
  type ProfileCommitActivity,
  type ProfileStats,
  type ProfileTokenStats,
  type ProviderKind,
} from "@modesto/contracts";
import {
  serverProfileCommitActivityQueryOptions,
  serverProfileStatsQueryOptions,
  serverProfileTokenStatsQueryOptions,
} from "~/lib/serverReactQuery";
import { formatRelativeTime } from "~/lib/relativeTime";
import { GitHubIcon } from "~/lib/icons";
import { ensureNativeApi } from "~/nativeApi";
import { SETTINGS_TARGETS } from "~/settingsNavigation";
import { gitGithubAuthQueryOptions, gitGithubSignOutMutationOptions } from "~/lib/gitReactQuery";
import { CentralIcon } from "~/lib/central-icons";
import { ProviderIcon } from "~/components/ProviderIcon";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { toastManager } from "~/components/ui/toast";
import { ActivityHeatmap } from "../profile/ActivityHeatmap";
import {
  selectProfileHeatmap,
  selectProfileModelUsage,
  selectProfileTopProvider,
} from "../profile/profileSelectors";
import { ShareDialog } from "../profile/ShareDialog";
import { useProfileHandle } from "../profile/useProfileHandle";
import { useProfileName } from "../profile/useProfileName";
import { useProfileAvatarColor } from "../profile/useProfileAvatarColor";
import { useProfileAvatarImage } from "../profile/useProfileAvatarImage";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import {
  formatCompact,
  formatDays,
  formatNumber,
  toDisplayName,
} from "../profile/profileFormatting";

export function ProfileSettingsPanel() {
  const coreQuery = useQuery(serverProfileStatsQueryOptions());
  const tokenQuery = useQuery(serverProfileTokenStatsQueryOptions());
  const commitsQuery = useQuery(serverProfileCommitActivityQueryOptions());

  if (coreQuery.isPending) {
    return <ProfileSkeleton />;
  }
  if (coreQuery.isError || !coreQuery.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-sm text-muted-foreground">Couldn’t load your local stats.</p>
        <Button variant="outline" size="sm" onClick={() => void coreQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <ProfileContent
      stats={coreQuery.data}
      tokenStats={tokenQuery.data ?? null}
      tokensPending={tokenQuery.isPending}
      commitActivity={commitsQuery.data ?? null}
      commitsPending={commitsQuery.isPending}
      commitsError={commitsQuery.isError}
      onRetryCommits={() => void commitsQuery.refetch()}
    />
  );
}

function ProfileContent({
  stats,
  tokenStats,
  tokensPending,
  commitActivity,
  commitsPending,
  commitsError,
  onRetryCommits,
}: {
  stats: ProfileStats;
  tokenStats: ProfileTokenStats | null;
  tokensPending: boolean;
  commitActivity: ProfileCommitActivity | null;
  commitsPending: boolean;
  commitsError: boolean;
  onRetryCommits: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const githubAuthQuery = useQuery(gitGithubAuthQueryOptions());
  const githubSignOutMutation = useMutation({
    ...gitGithubSignOutMutationOptions({
      queryClient,
      onSuccess: () => {
        toastManager.add({ type: "success", title: "Signed out of GitHub" });
      },
    }),
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not sign out of GitHub",
        description: error instanceof Error ? error.message : "GitHub CLI sign-out failed.",
      });
    },
  });
  const [shareOpen, setShareOpen] = useState(false);

  const defaultName = useMemo(
    () => toDisplayName(stats.identity.homeDirBasename),
    [stats.identity.homeDirBasename],
  );
  const { name: localName } = useProfileName(defaultName);
  const { handle: localHandle } = useProfileHandle(stats.identity.defaultHandle);
  const { color: avatarColor } = useProfileAvatarColor();
  const { image: localAvatarImage } = useProfileAvatarImage();
  const githubProfile = githubAuthQuery.data?.authenticated ? githubAuthQuery.data : null;
  const githubLogin = githubProfile?.login ?? null;
  const name = githubProfile?.name?.trim() || githubProfile?.login || localName;
  const handle = githubProfile?.login ? `@${githubProfile.login}` : localHandle;
  const avatarImage = githubProfile?.avatarUrl ?? localAvatarImage;

  // Tokens/day when available, prompts/day otherwise — shared with ShareCard.
  const heatmap = selectProfileHeatmap(stats, tokenStats);
  const topProvider = selectProfileTopProvider(stats, tokenStats);
  const modelUsage = selectProfileModelUsage(stats, tokenStats);
  const peakHourLabel = formatPeakHourLabel(stats.activeHours.startHour);
  const mostWorkedProjectLabel = formatMostWorkedProjectLabel(stats.mostWorkedProject);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card/35 p-5 shadow-[0_18px_60px_-50px_color-mix(in_srgb,var(--color-foreground)_30%,transparent)] sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-blue-500/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-foreground/[0.035] to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProfileAvatar
            initials={stats.identity.initials}
            color={avatarColor}
            image={avatarImage}
            className="size-20 shrink-0 shadow-sm ring-1 ring-border/70"
            textClassName="text-2xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-semibold tracking-tight">{name}</h2>
              <span className="rounded-full border border-border/70 bg-background/55 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Modesto
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{handle}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-muted/70">
                <GitHubIcon className="size-3" />
              </span>
              <span>
                {githubAuthQuery.isPending
                  ? "Checking GitHub connection…"
                  : githubProfile
                    ? "GitHub identity connected"
                    : "Connect GitHub to use your profile photo and identity"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-start">
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              Share
            </Button>
            {githubLogin ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void ensureNativeApi().shell.openExternal(
                    `https://github.com/${encodeURIComponent(githubLogin)}`,
                  )
                }
              >
                GitHub
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={githubAuthQuery.isPending}
                onClick={() =>
                  void navigate({
                    to: "/settings",
                    search: {
                      section: "providers",
                      target: SETTINGS_TARGETS.providerInstalls,
                    },
                  })
                }
              >
                Connect GitHub
              </Button>
            )}
          </div>
        </div>
        {githubProfile ? (
          <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
            <p className="text-xs text-muted-foreground">
              Your name, username, and profile photo come directly from GitHub.
            </p>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              disabled={githubSignOutMutation.isPending}
              onClick={() => githubSignOutMutation.mutate()}
            >
              {githubSignOutMutation.isPending ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        ) : null}
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card/25 shadow-sm sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        <StatTile
          label="Lifetime tokens"
          value={tokensPending ? null : formatCompact(tokenStats?.lifetimeTotalTokens ?? null)}
        />
        <StatTile
          label="Peak day"
          value={tokensPending ? null : formatCompact(tokenStats?.peakDayTokens ?? null)}
        />
        <StatTile label="Total prompts" value={formatNumber(stats.activity.totalPromptsSent)} />
        <StatTile label="Current streak" value={formatDays(stats.activity.currentStreakDays)} />
        <StatTile label="Longest streak" value={formatDays(stats.activity.longestStreakDays)} />
      </div>

      {/* Heatmap */}
      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="text-sm font-medium">Activity</h3>
        {tokensPending ? (
          <Skeleton className="h-28 w-full rounded-lg" />
        ) : (
          <ActivityHeatmap
            cells={heatmap.cells}
            fill
            radius={5}
            gap={3}
            tooltip
            tooltipUnit={heatmap.unit}
            showMonths
            monthsPosition="bottom"
          />
        )}
      </section>

      <CommitActivitySection
        activity={commitActivity}
        pending={commitsPending}
        error={commitsError}
        onRetry={onRetryCommits}
      />

      {/* Insights + plugins */}
      <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Activity insights</h3>
          <dl className="flex flex-col gap-2.5">
            <InsightRow
              label="Most used provider"
              value={
                topProvider.provider
                  ? `${formatProviderLabel(topProvider.provider)}${
                      topProvider.percent !== null ? ` · ${topProvider.percent}%` : ""
                    }`
                  : "—"
              }
            />
            <InsightRow
              label="Most used reasoning"
              value={
                stats.insights.topReasoning
                  ? `${capitalize(stats.insights.topReasoning)}${
                      stats.insights.topReasoningPercent !== null
                        ? ` · ${stats.insights.topReasoningPercent}%`
                        : ""
                    }`
                  : "—"
              }
            />
            <InsightRow label="Most active hour" value={peakHourLabel} />
            <InsightRow label="Most worked project" value={mostWorkedProjectLabel} />
            <InsightRow
              label="Skills explored"
              value={formatNumber(stats.insights.skillsExplored)}
            />
            <InsightRow
              label="Total skills used"
              value={formatNumber(stats.insights.totalSkillsUsed)}
            />
            <InsightRow label="Total threads" value={formatNumber(stats.activity.totalThreads)} />
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Most used plugins</h3>
          {stats.skills.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {stats.skills.slice(0, 6).map((skill) => (
                <li
                  key={`${skill.kind}:${skill.name}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60">
                      <CentralIcon
                        name={skill.kind === "agent" ? "agent" : "building-blocks"}
                        className="size-3"
                      />
                    </span>
                    <span className="truncate text-sm">{skill.displayName}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {formatNumber(skill.runCount)} runs
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No skills or agents used yet.</p>
          )}
        </section>
      </div>

      {/* Model usage */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Model usage</h3>
        {modelUsage.entries.length > 0 ? (
          <ul className="grid grid-cols-1 gap-x-12 gap-y-3 sm:grid-cols-2">
            {modelUsage.entries.slice(0, 6).map((entry) => (
              <ModelUsageRow
                key={`${entry.provider}:${entry.model}`}
                provider={entry.provider}
                model={entry.model}
                percent={entry.percent}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No model activity yet.</p>
        )}
      </section>

      <ShareDialog
        stats={stats}
        tokenStats={tokenStats}
        displayName={name}
        handle={handle}
        avatarColor={avatarColor}
        avatarImage={avatarImage}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </div>
  );
}

// ── Small pieces ───────────────────────────────────────────────────────

function CommitActivitySection({
  activity,
  pending,
  error,
  onRetry,
}: {
  activity: ProfileCommitActivity | null;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const [source, setSource] = useState<"workspace" | "github">("github");
  const commits = activity?.[source] ?? [];

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card/20 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Recent commits</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your latest work from GitHub and local Modesto projects.
          </p>
        </div>
        <div
          className="inline-flex rounded-lg bg-muted/70 p-0.5"
          role="group"
          aria-label="Commit source"
        >
          <CommitSourceButton
            active={source === "workspace"}
            onClick={() => setSource("workspace")}
          >
            Workspace
            {activity ? <span className="tabular-nums">{activity.workspace.length}</span> : null}
          </CommitSourceButton>
          <CommitSourceButton active={source === "github"} onClick={() => setSource("github")}>
            GitHub
            {activity ? <span className="tabular-nums">{activity.github.length}</span> : null}
          </CommitSourceButton>
        </div>
      </div>

      {pending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[58px] w-full rounded-lg" />
          ))}
        </div>
      ) : error || !activity ? (
        <CommitEmptyState
          message="Couldn’t load commit activity."
          actionLabel="Try again"
          onAction={onRetry}
        />
      ) : source === "github" && !activity.githubAuthenticated ? (
        <CommitEmptyState
          message={
            activity.githubInstalled
              ? "Connect GitHub to see commits authored by your account."
              : "Install and connect the GitHub CLI to show your GitHub commits."
          }
          actionLabel={activity.githubInstalled ? "Connect GitHub" : "Set up GitHub"}
          onAction={() =>
            void navigate({
              to: "/settings",
              search: {
                section: "providers",
                target: SETTINGS_TARGETS.providerInstalls,
              },
            })
          }
        />
      ) : source === "github" && activity.githubFetchFailed ? (
        <CommitEmptyState
          message="Couldn’t reach GitHub to load your commits."
          actionLabel="Try again"
          onAction={onRetry}
        />
      ) : commits.length === 0 ? (
        <CommitEmptyState
          message={
            source === "github"
              ? `No recent GitHub commits found${activity.githubLogin ? ` for @${activity.githubLogin}` : ""}.`
              : "No commits found in projects added to Modesto yet."
          }
        />
      ) : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
          {commits.map((commit) => (
            <CommitRow
              key={`${commit.source}:${commit.repository}:${commit.sha}`}
              commit={commit}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CommitSourceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CommitRow({ commit }: { commit: ProfileCommit }) {
  const canOpen = commit.source === "github" && commit.url !== null;
  return (
    <li>
      <button
        type="button"
        disabled={!canOpen}
        className="group flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
        onClick={() => {
          if (commit.url) void ensureNativeApi().shell.openExternal(commit.url);
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{commit.message}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {commit.repository} · {commit.author} · {formatRelativeTime(commit.committedAt)}
          </span>
        </span>
        <code className="shrink-0 text-[11px] text-muted-foreground">{commit.shortSha}</code>
      </button>
    </li>
  );
}

function CommitEmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-5 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction ? (
        <Button type="button" size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-3">
      {value === null ? (
        <Skeleton className="h-4 w-12" />
      ) : (
        <span className="text-sm font-normal tabular-nums text-foreground">{value}</span>
      )}
      <span className="text-sm font-normal text-muted-foreground">{label}</span>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-normal tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return "12 AM";
  if (normalized === 12) return "12 PM";
  return normalized < 12 ? `${normalized} AM` : `${normalized - 12} PM`;
}

function formatPeakHourLabel(startHour: number | null): string {
  return startHour === null ? "—" : formatHour(startHour);
}

function formatMostWorkedProjectLabel(project: ProfileStats["mostWorkedProject"]): string {
  if (!project) {
    return "—";
  }
  const promptLabel = project.promptCount === 1 ? "prompt" : "prompts";
  return `${project.title} · ${formatNumber(project.promptCount)} ${promptLabel}`;
}

function formatProviderLabel(provider: ProviderKind): string {
  switch (provider) {
    case "codex":
      return "Codex";
    case "claudeAgent":
      return "Claude";
    case "cursor":
      return "Cursor";
    case "gemini":
      return "Gemini";
    case "grok":
      return "Grok";
    case "droid":
      return "Droid";
    case "kilo":
      return "Kilo";
    case "opencode":
      return "OpenCode";
    case "pi":
      return "Pi";
  }
}

function ModelUsageRow({
  provider,
  model,
  percent,
}: {
  provider: ProviderKind | "unknown";
  model: string;
  percent: number;
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {provider !== "unknown" ? (
            <ProviderIcon provider={provider} className="size-3.5 shrink-0" />
          ) : (
            <CentralIcon name="chart-2" className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{model}</span>
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--info)]"
          style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
        />
      </div>
    </li>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-7">
      <Skeleton className="size-16 rounded-full" />
      <div className="flex flex-col items-center gap-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-[72px] w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid w-full gap-7 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}
