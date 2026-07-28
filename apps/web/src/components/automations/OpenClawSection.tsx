import {
  DEFAULT_SERVER_SETTINGS,
  PROVIDER_DISPLAY_NAMES,
  type ModelSelection,
  type OpenClawConnectionConfigUpdate,
  type ProjectId,
  type ProviderKind,
  type ServerSettings,
} from "@modesto/contracts";
import {
  defaultCloudAgentModelSelection,
  isCloudAgentProviderEnabled,
  listCloudAgentProviders,
} from "@modesto/shared/cloudAgents";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "../ui/button";
import {
  openClawSnapshotQueryOptions,
  useSetupOpenClaw,
  useTestOpenClawConnection,
  useUpdateOpenClawConfig,
} from "../../lib/openClawReactQuery";
import { cn } from "../../lib/utils";

function providersFromHidden(
  hiddenProviders: ReadonlyArray<ProviderKind> | undefined,
): ServerSettings["providers"] {
  const hidden = new Set(hiddenProviders ?? []);
  const next = { ...DEFAULT_SERVER_SETTINGS.providers };
  for (const provider of Object.keys(next) as ProviderKind[]) {
    next[provider] = {
      ...next[provider],
      enabled: !hidden.has(provider),
    };
  }
  return next;
}

function statusTone(status: "connected" | "disconnected" | "unknown") {
  if (status === "connected") return "bg-emerald-500";
  if (status === "disconnected") return "bg-destructive";
  return "bg-muted-foreground/50";
}

function SettingGroup({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-t border-border/60 py-4 first:border-t-0">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</div>
      </div>
      {children}
    </div>
  );
}

export function OpenClawSection({
  projects,
  onOpenThread,
  serverProviders,
  providerOrder,
  hiddenProviders,
}: {
  readonly projects: ReadonlyArray<{ readonly id: ProjectId; readonly title: string }>;
  readonly onOpenThread: (threadId: string) => void;
  readonly serverProviders?: ServerSettings["providers"] | null | undefined;
  readonly providerOrder?: ReadonlyArray<ProviderKind>;
  readonly hiddenProviders?: ReadonlyArray<ProviderKind>;
}) {
  const query = useQuery(openClawSnapshotQueryOptions());
  const update = useUpdateOpenClawConfig();
  const setup = useSetupOpenClaw();
  const test = useTestOpenClawConnection();
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");

  useEffect(() => {
    if (query.data) setGatewayUrl(query.data.config.gatewayUrl ?? "");
  }, [query.data]);

  const allowedByProvider = useMemo(
    () =>
      new Map(
        (query.data?.config.allowedModelSelections ?? []).map((selection) => [
          selection.provider,
          selection,
        ]),
      ),
    [query.data?.config.allowedModelSelections],
  );

  const resolvedProviders = serverProviders ?? providersFromHidden(hiddenProviders);
  const cloudAgentProviders = useMemo(
    () =>
      listCloudAgentProviders({
        providers: resolvedProviders,
        ...(providerOrder ? { providerOrder } : {}),
        ...(hiddenProviders ? { hiddenProviders } : {}),
        currentlyAllowed: [...allowedByProvider.keys()],
      }),
    [allowedByProvider, hiddenProviders, providerOrder, resolvedProviders],
  );

  const patch = (input: OpenClawConnectionConfigUpdate) => update.mutate(input);
  const saveConnection = () => {
    patch({
      gatewayUrl: gatewayUrl.trim() || null,
      ...(gatewayToken.trim() ? { gatewayToken: gatewayToken.trim() } : {}),
    });
    setGatewayToken("");
  };

  if (query.isLoading || !query.data) {
    return (
      <section className="rounded-lg border border-border/70 px-4 py-6 text-sm text-muted-foreground">
        Detecting OpenClaw…
      </section>
    );
  }

  const { status, tasks, config } = query.data;
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="flex items-start justify-between gap-4 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">OpenClaw</h2>
            <span className={cn("size-2 rounded-full", statusTone(status.gateway))} />
            <span className="text-xs capitalize text-muted-foreground">{status.gateway}</span>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Let OpenClaw submit coding tasks to Modesto’s existing agents. Every task is checked
            against the workspace, agent, and permission policy below.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={test.isPending}
            onClick={() => test.mutate()}
          >
            Test connection
          </Button>
          <Button
            size="sm"
            disabled={setup.isPending || status.installation === "not-found"}
            onClick={() => setup.mutate()}
          >
            {status.plugin === "installed" ? "Repair setup" : "Set up"}
          </Button>
        </div>
      </div>

      <div className="border-t border-border/70 px-4">
        <SettingGroup
          title="Connection"
          description={
            status.installation === "detected"
              ? `${status.version ?? "OpenClaw detected"} · Companion tool ${status.plugin}`
              : "Install OpenClaw and make the openclaw CLI available on PATH."
          }
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={gatewayUrl}
              onChange={(event) => setGatewayUrl(event.target.value)}
              placeholder="ws://127.0.0.1:18789"
              className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus:border-ring"
            />
            <input
              type="password"
              value={gatewayToken}
              onChange={(event) => setGatewayToken(event.target.value)}
              placeholder="Gateway token (unchanged if blank)"
              className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs outline-none focus:border-ring"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={saveConnection}
            >
              Save
            </Button>
          </div>
          {status.message ? (
            <p className="text-xs text-muted-foreground">{status.message}</p>
          ) : null}
        </SettingGroup>

        <SettingGroup
          title="Allowed workspaces"
          description="OpenClaw can only create tasks in selected Modesto projects."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {projects.map((project) => {
              const checked = config.allowedProjectIds.includes(project.id);
              return (
                <label
                  key={project.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      patch({
                        allowedProjectIds: checked
                          ? config.allowedProjectIds.filter((id) => id !== project.id)
                          : [...config.allowedProjectIds, project.id],
                      })
                    }
                  />
                  <span className="min-w-0 truncate">{project.title}</span>
                </label>
              );
            })}
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add a project before enabling intake.</p>
            ) : null}
          </div>
        </SettingGroup>

        <SettingGroup
          title="Allowed coding agents"
          description="Only providers enabled in Settings → Providers can accept cloud agent tasks. Local/worktree is a workspace mode, not an agent."
        >
          <div className="flex flex-wrap gap-2">
            {cloudAgentProviders.map((provider) => {
              const checked = allowedByProvider.has(provider);
              const providerEnabled = isCloudAgentProviderEnabled(resolvedProviders, provider);
              return (
                <label
                  key={provider}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                    checked ? "border-foreground/25 bg-muted/50" : "border-border/60",
                    !providerEnabled ? "opacity-70" : null,
                  )}
                  title={
                    providerEnabled
                      ? undefined
                      : "Provider is disabled. Uncheck it or re-enable it in Providers."
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!providerEnabled && !checked}
                    onChange={() => {
                      if (!providerEnabled && !checked) return;
                      const next = checked
                        ? config.allowedModelSelections.filter(
                            (selection) => selection.provider !== provider,
                          )
                        : [
                            ...config.allowedModelSelections,
                            defaultCloudAgentModelSelection(provider),
                          ];
                      const nextDefault: ModelSelection | null =
                        config.defaultModelSelection?.provider === provider && checked
                          ? (next[0] ?? null)
                          : (config.defaultModelSelection ?? next[0] ?? null);
                      patch({
                        allowedModelSelections: next,
                        defaultModelSelection: nextDefault,
                      });
                    }}
                  />
                  {PROVIDER_DISPLAY_NAMES[provider]}
                  {!providerEnabled ? (
                    <span className="text-[0.6875rem] text-muted-foreground">disabled</span>
                  ) : null}
                </label>
              );
            })}
            {cloudAgentProviders.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Enable at least one provider in Settings → Providers to allow cloud agents.
              </p>
            ) : null}
          </div>
          <label className="grid max-w-sm gap-1 text-xs text-muted-foreground">
            Default agent
            <select
              value={config.defaultModelSelection?.provider ?? ""}
              onChange={(event) =>
                patch({
                  defaultModelSelection:
                    allowedByProvider.get(event.target.value as ProviderKind) ?? null,
                })
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
            >
              <option value="">Select an allowed agent</option>
              {[...allowedByProvider.keys()].map((provider) => (
                <option key={provider} value={provider}>
                  {PROVIDER_DISPLAY_NAMES[provider]}
                </option>
              ))}
            </select>
          </label>
        </SettingGroup>

        <SettingGroup
          title="Permissions"
          description="Approval-required is safest. Worktree mode keeps incoming work isolated from the local checkout."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Runtime access
              <select
                value={config.runtimeMode}
                onChange={(event) =>
                  patch({
                    runtimeMode: event.target.value as "approval-required" | "full-access",
                  })
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="approval-required">Approval required</option>
                <option value="full-access">Full access</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Workspace mode
              <select
                value={config.envMode}
                onChange={(event) => patch({ envMode: event.target.value as "local" | "worktree" })}
                className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="worktree">New worktree</option>
                <option value="local">Local checkout</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => patch({ enabled: event.target.checked })}
              />
              Accept incoming tasks
            </label>
          </div>
        </SettingGroup>

        <SettingGroup
          title="Incoming task history"
          description="Accepted tasks continue in ordinary Modesto threads using the selected provider."
        >
          <div className="grid gap-1">
            {tasks.map((task) => (
              <button
                type="button"
                key={task.id}
                disabled={!task.threadId}
                onClick={() => task.threadId && onOpenThread(task.threadId)}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50 disabled:cursor-default"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {task.title}
                </span>
                <span className="text-[0.6875rem] capitalize text-muted-foreground">
                  {task.status}
                </span>
                <span className="text-[0.6875rem] text-muted-foreground">
                  {new Date(task.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
            {tasks.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">No incoming tasks yet.</p>
            ) : null}
          </div>
        </SettingGroup>
      </div>
    </section>
  );
}
