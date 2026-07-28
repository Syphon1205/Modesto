// FILE: CursorParitySettingsPanels.tsx
// Purpose: Settings panels for Cursor-parity sections (MCP, hooks, rules, agents, browser, tab, indexing).
// Layer: Settings UI components

import {
  EDITORS,
  type EditorId,
  type ProjectId,
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
} from "@modesto/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useAppSettings } from "~/appSettings";
import { OpenClawSection } from "~/components/automations/OpenClawSection";
import { PluginLibrary } from "~/components/PluginLibrary";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SelectItem } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { toastManager } from "~/components/ui/toast";
import { usePreferredEditor } from "~/editorPreferences";
import { serverConfigQueryOptions, serverSettingsQueryOptions } from "~/lib/serverReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { SettingsSelectControl } from "./SettingControls";
import { SettingsRow, SettingsSection } from "./SettingsPanelPrimitives";
import { SkillsSettingsPanel } from "./SkillsSettingsPanel";

function useDesktopBrowserAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.desktopBridge?.browser);
}

export function PluginsSettingsPanel() {
  return (
    <div className="-mx-2 min-h-[28rem]">
      <PluginLibrary />
    </div>
  );
}

export function AgentsSettingsPanel() {
  const { settings, updateSettings, defaults } = useAppSettings();
  const [launchArgs, setLaunchArgs] = useState("");
  const [savingLaunchArgs, setSavingLaunchArgs] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void ensureNativeApi()
      .server.getSettings()
      .then((serverSettings) => {
        setLaunchArgs(serverSettings.providers.claudeAgent.launchArgs);
      })
      .catch(() => {
        /* keep empty until reconnect */
      });
  }, []);

  const providerOptions = useMemo(
    () => Object.entries(PROVIDER_DISPLAY_NAMES) as Array<[ProviderKind, string]>,
    [],
  );

  return (
    <div className="space-y-6">
      <SettingsSection title="Defaults">
        <SettingsRow
          title="Default provider"
          description="Provider used when creating a new chat."
          control={
            <SettingsSelectControl
              value={settings.defaultProvider}
              onValueChange={(value) => updateSettings({ defaultProvider: value as ProviderKind })}
              ariaLabel="Default provider"
              valueContent={PROVIDER_DISPLAY_NAMES[settings.defaultProvider]}
            >
              {providerOptions.map(([provider, label]) => (
                <SelectItem key={provider} value={provider}>
                  {label}
                </SelectItem>
              ))}
            </SettingsSelectControl>
          }
        />
        <SettingsRow
          title="New threads"
          description="Workspace mode for newly created draft threads."
          control={
            <SettingsSelectControl
              value={settings.defaultThreadEnvMode}
              onValueChange={(value) => {
                if (value !== "local" && value !== "worktree") return;
                updateSettings({ defaultThreadEnvMode: value });
              }}
              ariaLabel="New thread mode"
              valueContent={settings.defaultThreadEnvMode === "worktree" ? "Worktree" : "Local"}
            >
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="worktree">Worktree</SelectItem>
            </SettingsSelectControl>
          }
        />
      </SettingsSection>

      <SettingsSection title="Claude Agent">
        <SettingsRow
          title="Launch arguments"
          description="Extra CLI arguments appended when Modesto starts Claude Agent."
          control={
            <div className="flex w-full max-w-md items-center gap-2">
              <Input
                value={launchArgs}
                onChange={(event) => setLaunchArgs(event.target.value)}
                placeholder="--flag value"
                aria-label="Claude launch arguments"
              />
              <Button
                size="xs"
                disabled={savingLaunchArgs}
                onClick={() => {
                  setSavingLaunchArgs(true);
                  void ensureNativeApi()
                    .server.updateSettings({
                      providers: { claudeAgent: { launchArgs } },
                    })
                    .then(() => {
                      toastManager.add({
                        type: "success",
                        title: "Launch arguments saved",
                      });
                    })
                    .catch((error) => {
                      toastManager.add({
                        type: "error",
                        title: "Could not save launch arguments",
                        description: error instanceof Error ? error.message : String(error),
                      });
                    })
                    .finally(() => setSavingLaunchArgs(false));
                }}
              >
                {savingLaunchArgs ? "Saving…" : "Save"}
              </Button>
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="Provider visibility">
        <SettingsRow
          title="Manage providers"
          description="Show or hide providers in the picker and sync server enabled flags."
          control={
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                void navigate({ to: "/settings", search: { section: "providers" } })
              }
            >
              Open Providers
            </Button>
          }
        />
        {settings.defaultProvider !== defaults.defaultProvider ||
        settings.defaultThreadEnvMode !== defaults.defaultThreadEnvMode ? (
          <SettingsRow
            title="Restore agent defaults"
            description="Reset default provider and new-thread mode."
            control={
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  updateSettings({
                    defaultProvider: defaults.defaultProvider,
                    defaultThreadEnvMode: defaults.defaultThreadEnvMode,
                  })
                }
              >
                Restore
              </Button>
            }
          />
        ) : null}
      </SettingsSection>
    </div>
  );
}

export function CloudAgentsSettingsPanel({
  projects,
}: {
  readonly projects: ReadonlyArray<{ readonly id: ProjectId; readonly title: string }>;
}) {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const serverSettingsQuery = useQuery(serverSettingsQueryOptions());

  return (
    <div className="space-y-4">
      <OpenClawSection
        projects={projects}
        serverProviders={serverSettingsQuery.data?.providers}
        providerOrder={settings.providerOrder}
        hiddenProviders={settings.hiddenProviders}
        onOpenThread={(threadId) => {
          void navigate({ to: "/$threadId", params: { threadId } });
        }}
      />
    </div>
  );
}

export function ToolsMcpsSettingsPanel() {
  const [data, setData] =
    useState<Awaited<ReturnType<ReturnType<typeof ensureNativeApi>["server"]["listMcpServers"]>>>();
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    ensureNativeApi()
      .server.listMcpServers()
      .then(setData)
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Could not load MCP servers",
          description: error instanceof Error ? error.message : String(error),
        });
      });

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <SettingsSection title="Codex MCP servers">
        {(data?.servers ?? []).length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No MCP servers found in {data?.configPath ?? "Codex config.toml"}.
          </p>
        ) : (
          (data?.servers ?? []).map((server) => (
            <SettingsRow
              key={server.name}
              title={server.name}
              description={[
                server.command,
                server.args.join(" "),
                server.cwd ? `(cwd: ${server.cwd})` : null,
                server.hasEnv ? "env configured" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              control={
                <div className="flex items-center gap-2">
                  <Switch
                    checked={server.enabled}
                    aria-label={`Enable ${server.name}`}
                    onCheckedChange={(enabled) => {
                      setBusy(true);
                      void ensureNativeApi()
                        .server.setMcpServerEnabled({ name: server.name, enabled })
                        .then(setData)
                        .catch((error) => {
                          toastManager.add({
                            type: "error",
                            title: "Could not update MCP server",
                            description: error instanceof Error ? error.message : String(error),
                          });
                        })
                        .finally(() => setBusy(false));
                    }}
                  />
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void ensureNativeApi()
                        .server.removeMcpServer({ name: server.name })
                        .then(setData)
                        .catch((error) => {
                          toastManager.add({
                            type: "error",
                            title: "Could not remove MCP server",
                            description: error instanceof Error ? error.message : String(error),
                          });
                        })
                        .finally(() => setBusy(false));
                    }}
                  >
                    Delete
                  </Button>
                </div>
              }
            />
          ))
        )}
      </SettingsSection>

      <SettingsSection title="Add server">
        <SettingsRow
          title="New MCP server"
          description={data?.configPath ?? "Writes into Codex CODEX_HOME/config.toml"}
          control={
            <div className="grid w-full max-w-sm gap-2">
              <Input
                placeholder="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="MCP server name"
              />
              <Input
                placeholder="Command"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                aria-label="MCP server command"
              />
              <Input
                placeholder="Arguments (space separated)"
                value={args}
                onChange={(event) => setArgs(event.target.value)}
                aria-label="MCP server arguments"
              />
              <Button
                size="sm"
                disabled={busy || !name.trim() || !command.trim()}
                onClick={() => {
                  setBusy(true);
                  void ensureNativeApi()
                    .server.upsertMcpServer({
                      name: name.trim(),
                      command: command.trim(),
                      args: args.trim() ? args.trim().split(/\s+/) : [],
                      enabled: true,
                    })
                    .then((next) => {
                      setData(next);
                      setName("");
                      setCommand("");
                      setArgs("");
                    })
                    .catch((error) => {
                      toastManager.add({
                        type: "error",
                        title: "Could not add MCP server",
                        description: error instanceof Error ? error.message : String(error),
                      });
                    })
                    .finally(() => setBusy(false));
                }}
              >
                Add MCP server
              </Button>
            </div>
          }
        />
      </SettingsSection>
    </div>
  );
}

export function HooksSettingsPanel() {
  const [data, setData] =
    useState<Awaited<ReturnType<ReturnType<typeof ensureNativeApi>["server"]["listHooks"]>>>();
  const [commands, setCommands] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureNativeApi()
      .server.listHooks()
      .then((next) => {
        setData(next);
        setCommands(
          Object.fromEntries(
            next.events.map((event) => [event.eventName, event.hooks[0]?.command ?? ""]),
          ),
        );
      })
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Could not load hooks",
          description: error instanceof Error ? error.message : String(error),
        });
      });
  }, []);

  return (
    <SettingsSection title="Codex hooks">
      <p className="px-4 pb-2 text-xs text-muted-foreground">
        Stored at {data?.configPath ?? "$CODEX_HOME/hooks.json"}. Env values are never shown here.
      </p>
      {(data?.events ?? []).map((event) => (
        <SettingsRow
          key={event.eventName}
          title={event.eventName}
          description="Run a shell command for this Codex lifecycle event."
          control={
            <div className="flex w-full max-w-md items-center gap-2">
              <Input
                value={commands[event.eventName] ?? ""}
                onChange={(change) =>
                  setCommands((current) => ({
                    ...current,
                    [event.eventName]: change.target.value,
                  }))
                }
                placeholder="/path/to/hook.sh"
                aria-label={`${event.eventName} command`}
              />
              <Switch
                checked={event.hooks.length > 0}
                disabled={
                  busy ||
                  (!commands[event.eventName]?.trim() && event.hooks.length === 0)
                }
                aria-label={`Enable ${event.eventName}`}
                onCheckedChange={(enabled) => {
                  const command = (commands[event.eventName] ?? "").trim();
                  if (enabled && !command) return;
                  setBusy(true);
                  void ensureNativeApi()
                    .server.setHook({
                      eventName: event.eventName as "UserPromptSubmit" | "Stop",
                      ...(enabled ? { command } : {}),
                      enabled,
                    })
                    .then(setData)
                    .catch((error) => {
                      toastManager.add({
                        type: "error",
                        title: "Could not update hook",
                        description: error instanceof Error ? error.message : String(error),
                      });
                    })
                    .finally(() => setBusy(false));
                }}
              />
              <Button
                size="xs"
                disabled={busy || !commands[event.eventName]?.trim()}
                onClick={() => {
                  const command = (commands[event.eventName] ?? "").trim();
                  setBusy(true);
                  void ensureNativeApi()
                    .server.setHook({
                      eventName: event.eventName as "UserPromptSubmit" | "Stop",
                      command,
                      enabled: true,
                    })
                    .then(setData)
                    .catch((error) => {
                      toastManager.add({
                        type: "error",
                        title: "Could not save hook",
                        description: error instanceof Error ? error.message : String(error),
                      });
                    })
                    .finally(() => setBusy(false));
                }}
              >
                Save
              </Button>
            </div>
          }
        />
      ))}
    </SettingsSection>
  );
}

export function RulesSkillsSettingsPanel() {
  const [rules, setRules] = useState<
    Array<{ path: string; size: number; mtime: string; lineCount: number }>
  >([]);

  useEffect(() => {
    void ensureNativeApi()
      .server.listAgentRules()
      .then((result) => setRules([...result.rules]))
      .catch(() => setRules([]));
  }, []);

  return (
    <div className="space-y-6">
      <SettingsSection title="Codex rules">
        {rules.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No files found in the Codex rules directory. Contents are never sent to the client —
            only path, size, and line count.
          </p>
        ) : (
          rules.map((rule) => (
            <SettingsRow
              key={rule.path}
              title={rule.path.split(/[\\/]/).at(-1) ?? rule.path}
              description={`${rule.lineCount} lines · ${rule.size} bytes · ${new Date(rule.mtime).toLocaleString()}`}
            />
          ))
        )}
      </SettingsSection>

      <SettingsSection title="Subagents">
        <SettingsRow
          title="Thread subagents"
          description="When a parent thread has child agent runs, use the sidebar chevron on that thread to expand or collapse the subagent list. Subagents share the parent provider session."
        />
      </SettingsSection>

      <SkillsSettingsPanel />
    </div>
  );
}

export function BrowserNetworkSettingsPanel() {
  const { settings, updateSettings } = useAppSettings();
  const desktopBrowserAvailable = useDesktopBrowserAvailable();

  return (
    <div className="space-y-6">
      <SettingsSection title="In-app browser">
        <SettingsRow
          title="Desktop browser bridge"
          description={
            desktopBrowserAvailable
              ? "Native Chromium browser panel is available in this desktop build."
              : "Native browser panel requires the Modesto desktop app."
          }
          status={desktopBrowserAvailable ? "Ready" : "Unavailable in this session"}
        />
      </SettingsSection>

      <SettingsSection title="Environment network rows">
        <SettingsRow
          title="Repository"
          description="Show the GitHub repository link in the Environment panel."
          control={
            <Switch
              checked={settings.showEnvironmentRepository}
              onCheckedChange={(checked) =>
                updateSettings({ showEnvironmentRepository: Boolean(checked) })
              }
            />
          }
        />
        <SettingsRow
          title="Pull request"
          description="Show open pull request CI checks and review comments."
          control={
            <Switch
              checked={settings.showEnvironmentPullRequest}
              onCheckedChange={(checked) =>
                updateSettings({ showEnvironmentPullRequest: Boolean(checked) })
              }
            />
          }
        />
        <SettingsRow
          title="Usage"
          description="Show provider usage in the Environment panel."
          control={
            <Switch
              checked={settings.showEnvironmentUsage}
              onCheckedChange={(checked) =>
                updateSettings({ showEnvironmentUsage: Boolean(checked) })
              }
            />
          }
        />
      </SettingsSection>
    </div>
  );
}

export function TabSettingsPanel() {
  const configQuery = useQuery(serverConfigQueryOptions());
  const availableEditors = configQuery.data?.availableEditors ?? [];
  const [preferredEditor, setPreferredEditor] = usePreferredEditor(availableEditors);

  const editorOptions = useMemo(
    () => EDITORS.filter((editor) => availableEditors.includes(editor.id as EditorId)),
    [availableEditors],
  );

  return (
    <SettingsSection title="Preferred editor">
      <SettingsRow
        title="Open files with"
        description="Used for Open in editor, keybindings.json, and favorite-editor shortcuts."
        control={
          preferredEditor ? (
            <SettingsSelectControl
              value={preferredEditor}
              onValueChange={(value) => setPreferredEditor(value as EditorId)}
              ariaLabel="Preferred editor"
              triggerClassName="w-56"
              valueContent={
                editorOptions.find((editor) => editor.id === preferredEditor)?.label ??
                preferredEditor
              }
            >
              {editorOptions.map((editor) => (
                <SelectItem key={editor.id} value={editor.id}>
                  {editor.label}
                </SelectItem>
              ))}
            </SettingsSelectControl>
          ) : (
            <span className="text-sm text-muted-foreground">No editors found</span>
          )
        }
      />
      <SettingsRow
        title="Environment editor row"
        description="Show the Editor section in the chat Environment panel."
        control={<EnvironmentEditorToggle />}
      />
    </SettingsSection>
  );
}

function EnvironmentEditorToggle() {
  const { settings, updateSettings } = useAppSettings();
  return (
    <Switch
      checked={settings.showEnvironmentEditor}
      onCheckedChange={(checked) =>
        updateSettings({ showEnvironmentEditor: Boolean(checked) })
      }
    />
  );
}

export function IndexingSettingsPanel() {
  const [isRepairing, setIsRepairing] = useState(false);
  const queryClient = useQueryClient();

  return (
    <SettingsSection title="Project indexes">
      <SettingsRow
        title="Rebuild indexes"
        description="Rebuild local project indexes and refresh project snapshots without clearing existing chats."
        control={
          <Button
            size="xs"
            variant="outline"
            disabled={isRepairing}
            onClick={() => {
              setIsRepairing(true);
              void ensureNativeApi()
                .orchestration.repairState()
                .then(() => {
                  void queryClient.invalidateQueries();
                  toastManager.add({
                    type: "success",
                    title: "Indexes rebuilt",
                    description: "Project indexes were rebuilt without clearing chats.",
                  });
                })
                .catch((error) => {
                  toastManager.add({
                    type: "error",
                    title: "Rebuild failed",
                    description: error instanceof Error ? error.message : String(error),
                  });
                })
                .finally(() => setIsRepairing(false));
            }}
          >
            {isRepairing ? "Rebuilding…" : "Rebuild indexes"}
          </Button>
        }
      />
    </SettingsSection>
  );
}
