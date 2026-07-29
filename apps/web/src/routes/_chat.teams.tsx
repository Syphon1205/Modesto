import { PROVIDER_DISPLAY_NAMES, type ProjectId } from "@modesto/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { RouteInsetSurface } from "~/components/RouteInsetSurface";
import { SidebarHeaderNavigationControls } from "~/components/SidebarHeaderNavigationControls";
import {
  CHAT_SURFACE_HEADER_DIVIDER_CLASS_NAME,
  CHAT_SURFACE_HEADER_HEIGHT_CLASS,
  CHAT_SURFACE_HEADER_PADDING_X_CLASS,
} from "~/components/chat/chatHeaderControls";
import { CHAT_BACKGROUND_CLASS_NAME } from "~/components/chat/composerPickerStyles";
import {
  useDesktopTopBarTrafficLightGutterClassName,
  useDesktopTopBarWindowControlsGutterClassName,
} from "~/hooks/useDesktopTopBarGutter";
import {
  ActivityIcon,
  BotIcon,
  ChangesIcon,
  CheckCircle2Icon,
  DiffIcon,
  HandoffIcon,
  ReviewIcon,
  UsersIcon,
  type LucideIcon,
} from "~/lib/icons";
import { formatRelativeTime } from "~/lib/relativeTime";
import {
  buildTeamsParticipants,
  buildTeamsRuns,
  buildTeamsTimeline,
  TEAMS_TIMELINE_FILTERS,
  type TeamsRunStatus,
  type TeamsTimelineFilter,
} from "~/lib/teamsSpace";
import { cn } from "~/lib/utils";
import { useStore } from "~/store";

const FILTER_LABELS: Record<TeamsTimelineFilter, string> = {
  all: "All",
  runs: "Runs",
  checkpoints: "Checkpoints",
  handoffs: "Handoffs",
  reviews: "Reviews",
  diffs: "Diffs",
};

const RUN_STATUS_CLASS_NAMES: Record<TeamsRunStatus, string> = {
  running: "bg-blue-500",
  waiting: "bg-amber-500",
  failed: "bg-red-500",
  completed: "bg-emerald-500",
  ready: "bg-muted-foreground/50",
};

const TIMELINE_ICONS: Record<Exclude<TeamsTimelineFilter, "all">, LucideIcon> = {
  runs: ActivityIcon,
  checkpoints: CheckCircle2Icon,
  handoffs: HandoffIcon,
  reviews: ReviewIcon,
  diffs: DiffIcon,
};

function TeamsMetric(props: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
}) {
  const Icon = props.icon;
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{props.label}</span>
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{props.value}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{props.detail}</div>
    </div>
  );
}

function TeamsRouteView() {
  const navigate = useNavigate();
  const projects = useStore((state) => state.projects);
  const threads = useStore((state) => state.threads);
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(
    projects[0]?.id ?? null,
  );
  const [timelineFilter, setTimelineFilter] = useState<TeamsTimelineFilter>("all");
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const spaceThreads = useMemo(
    () =>
      selectedProject
        ? threads.filter((thread) => thread.projectId === selectedProject.id)
        : [],
    [selectedProject, threads],
  );
  const runs = useMemo(() => buildTeamsRuns(spaceThreads), [spaceThreads]);
  const participants = useMemo(
    () => buildTeamsParticipants(spaceThreads, runs),
    [runs, spaceThreads],
  );
  const timeline = useMemo(
    () => buildTeamsTimeline(spaceThreads, timelineFilter),
    [spaceThreads, timelineFilter],
  );
  const activeRunCount = runs.filter(
    (run) => run.status === "running" || run.status === "waiting",
  ).length;
  const attentionCount = runs.filter(
    (run) => run.status === "waiting" || run.status === "failed",
  ).length;
  const checkpointCount = spaceThreads.reduce(
    (count, thread) =>
      count +
      thread.activities.filter((activity) => activity.kind.includes("checkpoint")).length,
    0,
  );
  const trafficLightGutter = useDesktopTopBarTrafficLightGutterClassName();
  const windowControlsGutter = useDesktopTopBarWindowControlsGutterClassName();

  const openThread = (threadId: (typeof spaceThreads)[number]["id"]) =>
    void navigate({ to: "/$threadId", params: { threadId } });

  return (
    <RouteInsetSurface>
      <div className={cn("flex min-h-0 flex-1 flex-col", CHAT_BACKGROUND_CLASS_NAME)}>
        <header
          className={cn(
            CHAT_SURFACE_HEADER_DIVIDER_CLASS_NAME,
            CHAT_SURFACE_HEADER_PADDING_X_CLASS,
            "drag-region",
            trafficLightGutter,
            windowControlsGutter,
          )}
        >
          <div className={cn("flex items-center gap-3", CHAT_SURFACE_HEADER_HEIGHT_CLASS)}>
            <SidebarHeaderNavigationControls />
            <div className="min-w-0">
              <div className="text-sm font-medium">Teams</div>
              <div className="truncate text-xs text-muted-foreground">
                Shared project rooms for people and agents
              </div>
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)_15rem] overflow-hidden">
          <aside className="min-h-0 overflow-y-auto border-r border-border/70 p-3">
            <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Project spaces
            </div>
            <div className="space-y-1">
              {projects.map((project) => {
                const projectThreads = threads.filter((thread) => thread.projectId === project.id);
                const projectRuns = buildTeamsRuns(projectThreads);
                const projectActiveCount = projectRuns.filter(
                  (run) => run.status === "running" || run.status === "waiting",
                ).length;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      selectedProject?.id === project.id
                        ? "bg-[var(--color-background-elevated-secondary)] text-foreground"
                        : "text-muted-foreground hover:bg-[var(--color-background-elevated-secondary)]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          projectActiveCount > 0 ? "bg-blue-500" : "bg-muted-foreground/35",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                    </div>
                    <div className="mt-1 pl-3.5 text-xs">
                      {projectThreads.length} {projectThreads.length === 1 ? "run" : "runs"}
                      {projectActiveCount > 0 ? ` · ${projectActiveCount} active` : ""}
                    </div>
                  </button>
                );
              })}
              {projects.length === 0 ? (
                <p className="px-2 text-xs leading-relaxed text-muted-foreground">
                  Open a project to start a shared room for people and agents.
                </p>
              ) : null}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-6 p-5">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-semibold">
                      {selectedProject?.name ?? "No project space"}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A shared workspace for people and agents — live runs, handoffs, checkpoints,
                      diffs, and review in one room.
                    </p>
                  </div>
                  {selectedProject ? (
                    <span className="shrink-0 rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                      {participants.length} participants
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <TeamsMetric
                    label="Active work"
                    value={activeRunCount}
                    detail="Runs working or waiting"
                    icon={ActivityIcon}
                  />
                  <TeamsMetric
                    label="Needs attention"
                    value={attentionCount}
                    detail="Input, approval, or recovery"
                    icon={UsersIcon}
                  />
                  <TeamsMetric
                    label="Checkpoints"
                    value={checkpointCount}
                    detail="Clean handoff seams"
                    icon={CheckCircle2Icon}
                  />
                </div>
              </div>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium">Shared runs</h2>
                    <p className="text-xs text-muted-foreground">
                      Co-work on any run: watch, steer, recover, or hand off review.
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {runs.length} visible
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
                  {runs.map((run) => (
                    <button
                      key={run.threadId}
                      type="button"
                      onClick={() => openThread(run.threadId)}
                      className="rounded-lg border border-border/70 bg-background/45 p-3 text-left transition-colors hover:bg-[var(--color-background-elevated-secondary)]"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            RUN_STATUS_CLASS_NAMES[run.status],
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{run.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {PROVIDER_DISPLAY_NAMES[run.provider]}
                            {run.branch ? ` · ${run.branch}` : ""}
                          </span>
                          <span className="mt-2 block truncate text-xs text-muted-foreground">
                            {run.lastActivity}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-medium">{run.statusLabel}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {formatRelativeTime(run.updatedAt)}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                  {selectedProject && runs.length === 0 ? (
                    <div className="col-span-full rounded-lg border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
                      This space is ready. Start a project thread and its run will appear here.
                    </div>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="mb-3">
                  <h2 className="text-sm font-medium">Shared timeline</h2>
                  <p className="text-xs text-muted-foreground">
                    The project audit trail, authored by people and agents alike.
                  </p>
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  {TEAMS_TIMELINE_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={timelineFilter === filter}
                      onClick={() => setTimelineFilter(filter)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs transition-colors",
                        timelineFilter === filter
                          ? "bg-[var(--color-background-elevated-secondary)] text-foreground"
                          : "text-muted-foreground hover:bg-[var(--color-background-elevated-secondary)]",
                      )}
                    >
                      {FILTER_LABELS[filter]}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {timeline.map((item) => {
                    const Icon = TIMELINE_ICONS[item.category];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openThread(item.threadId)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-3 text-left transition-colors hover:bg-[var(--color-background-elevated-secondary)]"
                      >
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-background-elevated-secondary)] text-muted-foreground">
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {PROVIDER_DISPLAY_NAMES[item.provider]} · {item.threadTitle} ·{" "}
                            {FILTER_LABELS[item.category]}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </button>
                    );
                  })}
                  {selectedProject && timeline.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
                      No {timelineFilter === "all" ? "shared activity" : FILTER_LABELS[timelineFilter].toLowerCase()} yet.
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-l border-border/70 p-3">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Participants
            </div>
            <p className="px-2 pb-3 text-xs leading-relaxed text-muted-foreground">
              Humans and agents share the same project history.
            </p>
            <div className="space-y-1">
              {participants.map((participant) => (
                <div key={participant.id} className="rounded-md px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-background-elevated-secondary)] text-xs font-medium">
                      {participant.id === "human" ? (
                        participant.label.slice(0, 1)
                      ) : (
                        <BotIcon className="size-3.5" aria-hidden="true" />
                      )}
                      {participant.activeRunCount > 0 ? (
                        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-background bg-emerald-500" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{participant.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {participant.runCount} {participant.runCount === 1 ? "run" : "runs"}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1.5 pl-9 text-xs leading-relaxed text-muted-foreground">
                    {participant.detail}
                  </p>
                </div>
              ))}
            </div>

            {selectedProject ? (
              <div className="mt-4 border-t border-border/70 px-2 pt-4">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <ChangesIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Space context
                </div>
                <dl className="mt-2 space-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Project</dt>
                    <dd className="mt-0.5 truncate">{selectedProject.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Latest activity</dt>
                    <dd className="mt-0.5">
                      {timeline[0] ? formatRelativeTime(timeline[0].createdAt) : "No activity yet"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </aside>
        </main>
      </div>
    </RouteInsetSurface>
  );
}

export const Route = createFileRoute("/_chat/teams")({
  component: TeamsRouteView,
});
