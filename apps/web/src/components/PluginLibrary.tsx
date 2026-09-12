// FILE: PluginLibrary.tsx
// Purpose: Modesto's own Claude Code plugin installer - paste a GitHub repo
//          URL, preview what it declares (skills/commands/agents/MCP
//          servers), install it into the real ~/.claude directory, browse
//          and remove what's already installed. Native rebuild for this
//          tree (not a port of the primary tree's multi-provider
//          PluginLibrary.tsx) - Claude only for now, see
//          apps/server/src/provider/claudePluginBundle.ts's header for the
//          current scope.
// Layer: Route-level page component
// Format reference: https://code.claude.com/docs/en/plugins-reference

import { useAtomValue } from "@effect/atom-react";
import type { ClaudePluginComponent, ClaudePluginPreview } from "@modesto/contracts";
import {
  BotIcon,
  BookOpenIcon,
  Loader2Icon,
  PlugIcon,
  PuzzleIcon,
  TerminalSquareIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { isElectron } from "../env";
import { primaryEnvironmentIdAtom } from "../state/primaryEnvironment";
import { useEnvironmentQuery } from "../state/query";
import { useAtomCommand } from "../state/use-atom-command";
import {
  claudePluginInstall,
  claudePluginList,
  claudePluginPreview,
  claudePluginUninstall,
} from "../state/claudePlugins";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { SidebarInset } from "./ui/sidebar";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "./WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "./WorkspacePageContainer";
import { WorkspacePageHeader } from "./WorkspacePageHeader";
import { SkillPackLibrary } from "./SkillPackLibrary";

const COMPONENT_ICON: Record<ClaudePluginComponent["type"], typeof BotIcon> = {
  skill: BookOpenIcon,
  command: TerminalSquareIcon,
  agent: BotIcon,
  mcp: PlugIcon,
};

const COMPONENT_LABEL: Record<ClaudePluginComponent["type"], string> = {
  skill: "Skill",
  command: "Command",
  agent: "Agent",
  mcp: "MCP server",
};

function ComponentRow({ component }: { component: ClaudePluginComponent }) {
  const Icon = COMPONENT_ICON[component.type];
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/60 px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{component.name}</span>
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {COMPONENT_LABEL[component.type]}
          </span>
        </div>
        {component.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{component.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function PluginPreviewCard({
  preview,
  installing,
  onInstall,
  onDismiss,
}: {
  preview: ClaudePluginPreview;
  installing: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{preview.name}</CardTitle>
        <CardDescription>
          {preview.description ?? `${preview.source.owner}/${preview.source.repo}`}
          {preview.version ? ` · v${preview.version}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {preview.warnings.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
            {preview.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-1.5 text-xs text-warning-foreground"
              >
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          {preview.components.map((component) => (
            <ComponentRow key={`${component.type}-${component.name}`} component={component} />
          ))}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button onClick={onInstall} disabled={installing}>
          {installing ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Install
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={installing}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

export function PluginLibrary() {
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const list = useEnvironmentQuery(
    environmentId === null ? null : claudePluginList({ environmentId, input: {} }),
  );
  const previewCommand = useAtomCommand(claudePluginPreview, { reportFailure: false });
  const installCommand = useAtomCommand(claudePluginInstall);
  const uninstallCommand = useAtomCommand(claudePluginUninstall);

  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ClaudePluginPreview | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [installPending, setInstallPending] = useState(false);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (environmentId === null || !trimmedUrl || previewPending) return;
    setPreviewPending(true);
    setPreviewErrorMessage(null);
    setPreview(null);
    try {
      const result = await previewCommand({ environmentId, input: { url: trimmedUrl } });
      if (result._tag === "Success") {
        setPreview(result.value.preview);
      } else {
        setPreviewErrorMessage(
          "Couldn't preview this plugin - check the URL points to a repo with a .claude-plugin/plugin.json.",
        );
      }
    } finally {
      setPreviewPending(false);
    }
  }, [environmentId, previewCommand, previewPending, url]);

  const handleInstall = useCallback(async () => {
    if (environmentId === null || !preview || installPending) return;
    setInstallPending(true);
    try {
      const result = await installCommand({ environmentId, input: { url: url.trim() } });
      if (result._tag === "Success") {
        setPreview(null);
        setUrl("");
      }
    } finally {
      setInstallPending(false);
    }
  }, [environmentId, installCommand, installPending, preview, url]);

  const handleUninstall = useCallback(
    async (pluginId: string) => {
      if (environmentId === null || uninstallingId !== null) return;
      setUninstallingId(pluginId);
      try {
        await uninstallCommand({ environmentId, input: { pluginId } });
      } finally {
        setUninstallingId(null);
      }
    },
    [environmentId, uninstallCommand, uninstallingId],
  );

  const installedPlugins = list.data?.plugins ?? [];

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Plugins breadcrumb">
            <WorkspaceBreadcrumbItem current>
              <h1>Skills &amp; plugins</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
        </WorkspacePageHeader>

        <ScrollArea className="min-h-0 flex-1">
          <WorkspacePageContainer width="wide">
            <div className="flex flex-col gap-6 py-6">
              <SkillPackLibrary />

              <div className="border-t border-border/60" />
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-foreground">Install a Claude plugin</h2>
                <p className="text-sm text-muted-foreground">
                  Paste a GitHub repo that follows{" "}
                  <a
                    href="https://code.claude.com/docs/en/plugins-reference"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Claude Code's plugin format
                  </a>{" "}
                  - its skills, commands, and agents install into your real{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">~/.claude</code> directory.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handlePreview();
                    }}
                    placeholder="https://github.com/owner/repo"
                    disabled={previewPending}
                    className="max-w-md"
                  />
                  <Button
                    onClick={() => void handlePreview()}
                    disabled={!url.trim() || previewPending}
                  >
                    {previewPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                    Preview
                  </Button>
                </div>
                {previewErrorMessage ? (
                  <p className="text-sm text-destructive">{previewErrorMessage}</p>
                ) : null}
              </div>

              {preview ? (
                <PluginPreviewCard
                  preview={preview}
                  installing={installPending}
                  onInstall={() => void handleInstall()}
                  onDismiss={() => setPreview(null)}
                />
              ) : null}

              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-foreground">Installed plugins</h2>
                {list.isPending && installedPlugins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : installedPlugins.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                    <PuzzleIcon className="size-6 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">No plugins installed yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {installedPlugins.map((plugin) => (
                      <Card key={plugin.pluginId}>
                        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                          <div className="min-w-0">
                            <CardTitle className="text-base">{plugin.name}</CardTitle>
                            <CardDescription>
                              {plugin.description ?? `${plugin.source.owner}/${plugin.source.repo}`}
                              {" · "}
                              {plugin.fileCount} file{plugin.fileCount === 1 ? "" : "s"}
                              {plugin.mcpServers.length > 0
                                ? ` · ${plugin.mcpServers.length} MCP server${
                                    plugin.mcpServers.length === 1 ? "" : "s"
                                  }`
                                : ""}
                            </CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Remove ${plugin.name}`}
                            disabled={uninstallingId === plugin.pluginId}
                            onClick={() => void handleUninstall(plugin.pluginId)}
                          >
                            {uninstallingId === plugin.pluginId ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <TrashIcon className="size-3.5" />
                            )}
                          </Button>
                        </CardHeader>
                        {plugin.warnings.length > 0 ? (
                          <CardContent className="pt-0">
                            <div className="flex flex-col gap-1">
                              {plugin.warnings.map((warning) => (
                                <div
                                  key={warning}
                                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                                >
                                  <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                                  <span>{warning}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </WorkspacePageContainer>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}
