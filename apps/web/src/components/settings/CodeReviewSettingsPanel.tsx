import {
  PROVIDER_DISPLAY_NAMES,
  type ReviewProvider,
  type ReviewRuntime,
} from "@modesto/contracts";
import { getModelOptions } from "@modesto/shared/model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppSettings, type AppSettings } from "~/appSettings";
import { ensureNativeApi } from "~/nativeApi";
import { reviewProvidersQueryOptions, reviewProvidersQueryKey } from "~/lib/reviewReactQuery";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { SelectItem } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { SettingsSegmentedControl, SettingsSelectControl } from "./SettingControls";
import { SettingsRow, SettingsSection } from "./SettingsPanelPrimitives";

const RUNTIMES: readonly ReviewRuntime[] = ["codex", "cursor"];
const RUNTIME_DEFAULT_MODEL = "__runtime_default__";
const REVIEW_PROVIDER_DISPLAY_NAMES: Record<ReviewProvider, string> = {
  modesto: "Modesto",
  coderabbit: "CodeRabbit",
  greptile: "Greptile",
};

function ToggleRow({
  title,
  description,
  settingKey,
  settings,
  patchSettings,
}: {
  title: string;
  description: string;
  settingKey:
    | "reviewIncludeSecurity"
    | "reviewIncludePerformance"
    | "reviewIncludeArchitecture"
    | "reviewIncludeTestCoverage"
    | "reviewAllowFixSuggestions";
  settings: AppSettings;
  patchSettings: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <SettingsRow
      title={title}
      description={description}
      control={
        <Switch
          checked={settings[settingKey]}
          onCheckedChange={(checked) => patchSettings({ [settingKey]: Boolean(checked) })}
          aria-label={title}
        />
      }
    />
  );
}

export function CodeReviewSettingsPanel() {
  const { settings, updateSettings: patchSettings } = useAppSettings();
  const queryClient = useQueryClient();
  const providersQuery = useQuery(reviewProvidersQueryOptions());
  const codeRabbitSetup = useMutation({
    mutationFn: (action: "install" | "authenticate") =>
      ensureNativeApi().review.install({ provider: "coderabbit", action }),
    onSuccess: async (_result, action) => {
      await queryClient.invalidateQueries({ queryKey: reviewProvidersQueryKey });
      toastManager.add({
        type: "success",
        title: action === "install" ? "CodeRabbit installed" : "CodeRabbit connected",
        description:
          action === "install"
            ? "Sign in once, then select CodeRabbit in Review."
            : "CodeRabbit is ready for reviews inside Modesto.",
      });
    },
    onError: (error) =>
      toastManager.add({
        type: "error",
        title: "CodeRabbit setup did not finish",
        description: error instanceof Error ? error.message : "Try setup again.",
      }),
  });
  const provider = providersQuery.data?.providers.find(
    (candidate) => candidate.provider === "modesto",
  );
  const reviewTools = (["modesto", "coderabbit", "greptile"] as const).map(
    (reviewProvider) =>
      providersQuery.data?.providers.find((candidate) => candidate.provider === reviewProvider) ?? {
        provider: reviewProvider,
        displayName: REVIEW_PROVIDER_DISPLAY_NAMES[reviewProvider],
        installation: "not-found" as const,
        executable: null,
        authenticated: "unknown" as const,
        supportedRuntimes: [],
        supportedTargets: [],
        message:
          reviewProvider === "modesto"
            ? "Uses an installed Codex or Cursor runtime."
            : reviewProvider === "coderabbit"
              ? "Install CodeRabbit to run local reviews without leaving Modesto."
              : "Connect Greptile to the repository through GitHub.",
      },
  );
  const runtimeModels = getModelOptions(settings.modestoReviewRuntime);
  const selectedModel = settings.modestoReviewModel || RUNTIME_DEFAULT_MODEL;
  const runtimeAvailable =
    provider?.supportedRuntimes.includes(settings.modestoReviewRuntime) ?? false;

  return (
    <div className="space-y-6">
      <SettingsSection title="Review tools">
        <SettingsRow
          title="Default platform"
          description="Choose which reviewer opens in the editor Review activity."
          control={
            <SettingsSegmentedControl<ReviewProvider>
              value={settings.reviewProvider}
              onValueChange={(reviewProvider) => patchSettings({ reviewProvider })}
              ariaLabel="Default review platform"
              options={[
                { value: "modesto", label: "Modesto" },
                { value: "coderabbit", label: "CodeRabbit" },
                { value: "greptile", label: "Greptile" },
              ]}
            />
          }
        />
        {reviewTools.map((candidate) => (
          <SettingsRow
            key={candidate.provider}
            title={candidate.displayName}
            description={
              candidate.provider === "modesto"
                ? "Review local code with Codex or Cursor."
                : candidate.provider === "coderabbit"
                  ? "Review local changes with the CodeRabbit CLI."
                  : "View Greptile as the connected pull-request review platform."
            }
            status={candidate.message ?? undefined}
            control={
              candidate.provider === "modesto" ? (
                <Button
                  size="xs"
                  variant={settings.reviewProvider === "modesto" ? "secondary" : "outline"}
                  onClick={() => patchSettings({ reviewProvider: "modesto" })}
                >
                  {settings.reviewProvider === "modesto" ? "Selected" : "Use in Review"}
                </Button>
              ) : candidate.provider === "coderabbit" ? (
                <div className="flex items-center gap-2">
                  {candidate.installation === "detected" ? (
                    <>
                      {candidate.authenticated !== "yes" && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={codeRabbitSetup.isPending}
                          onClick={() => codeRabbitSetup.mutate("authenticate")}
                        >
                          {codeRabbitSetup.isPending ? "Waiting for browser…" : "Sign in"}
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant={settings.reviewProvider === "coderabbit" ? "secondary" : "outline"}
                        onClick={() => patchSettings({ reviewProvider: "coderabbit" })}
                      >
                        {settings.reviewProvider === "coderabbit" ? "Selected" : "Use in Review"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="xs"
                      disabled={codeRabbitSetup.isPending}
                      onClick={() => codeRabbitSetup.mutate("install")}
                    >
                      {codeRabbitSetup.isPending ? "Installing…" : "Install in Modesto"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      void ensureNativeApi().shell.openExternal(
                        "https://app.greptile.com/connections/code-providers",
                      )
                    }
                  >
                    Sign in & connect
                  </Button>
                  <Button
                    size="xs"
                    variant={settings.reviewProvider === "greptile" ? "secondary" : "outline"}
                    onClick={() => patchSettings({ reviewProvider: "greptile" })}
                  >
                    {settings.reviewProvider === "greptile" ? "Selected" : "Use in Review"}
                  </Button>
                </div>
              )
            }
          />
        ))}
      </SettingsSection>

      <SettingsSection title="Runtime">
        <SettingsRow
          title="Modesto Review"
          description="Runs a structured, read-only repository review through the selected local agent runtime."
          status={
            provider?.message ??
            (providersQuery.isError ? "Unable to inspect review runtimes." : undefined)
          }
          control={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {runtimeAvailable
                  ? "Available"
                  : providersQuery.isPending
                    ? "Checking…"
                    : "Runtime required"}
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: reviewProvidersQueryKey.slice(0, 1),
                  })
                }
              >
                Recheck
              </Button>
            </div>
          }
        />
        <SettingsRow
          title="Review engine"
          description="Codex uses a schema-constrained read-only exec; Cursor uses its non-interactive review stream."
          control={
            <SettingsSegmentedControl<ReviewRuntime>
              value={settings.modestoReviewRuntime}
              onValueChange={(runtime) =>
                patchSettings({
                  modestoReviewRuntime: runtime,
                  modestoReviewModel: "",
                })
              }
              ariaLabel="Review runtime"
              options={RUNTIMES.map((runtime) => ({
                value: runtime,
                label: PROVIDER_DISPLAY_NAMES[runtime],
              }))}
            />
          }
        />
        <SettingsRow
          title="Model"
          description="Use the runtime default or choose a model only for code review runs."
          control={
            <SettingsSelectControl
              value={selectedModel}
              onValueChange={(model) =>
                patchSettings({
                  modestoReviewModel: model === RUNTIME_DEFAULT_MODEL ? "" : model,
                })
              }
              ariaLabel="Review model"
              valueContent={
                selectedModel === RUNTIME_DEFAULT_MODEL
                  ? "Runtime default"
                  : (runtimeModels.find((model) => model.slug === selectedModel)?.name ??
                    selectedModel)
              }
            >
              <SelectItem value={RUNTIME_DEFAULT_MODEL}>Runtime default</SelectItem>
              {runtimeModels.map((model) => (
                <SelectItem key={model.slug} value={model.slug}>
                  {model.name}
                </SelectItem>
              ))}
            </SettingsSelectControl>
          }
        />
        <SettingsRow
          title="Review depth"
          description="Controls how broadly the runtime traces affected behavior."
          control={
            <SettingsSegmentedControl
              value={settings.modestoReviewDepth}
              onValueChange={(modestoReviewDepth) => patchSettings({ modestoReviewDepth })}
              ariaLabel="Review depth"
              options={[
                { value: "quick", label: "Quick" },
                { value: "standard", label: "Standard" },
                { value: "deep", label: "Deep" },
              ]}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Scope and results">
        <SettingsRow
          title="Default scope"
          description="Initial target shown when the editor review panel opens."
          control={
            <SettingsSelectControl
              value={settings.modestoReviewScope}
              onValueChange={(value) =>
                patchSettings({
                  modestoReviewScope: value as AppSettings["modestoReviewScope"],
                })
              }
              ariaLabel="Default review scope"
              valueContent={
                {
                  currentFile: "Current file",
                  uncommittedChanges: "Changed files",
                  selectedFiles: "Selected files",
                  repository: "Repository",
                }[settings.modestoReviewScope]
              }
            >
              <SelectItem value="currentFile">Current file</SelectItem>
              <SelectItem value="uncommittedChanges">Changed files</SelectItem>
              <SelectItem value="selectedFiles">Selected files</SelectItem>
              <SelectItem value="repository">Repository</SelectItem>
            </SettingsSelectControl>
          }
        />
        <SettingsRow
          title="Minimum severity"
          description="Hide lower-priority findings from the editor panel."
          control={
            <SettingsSelectControl
              value={settings.reviewMinimumSeverity}
              onValueChange={(value) =>
                patchSettings({
                  reviewMinimumSeverity: value as AppSettings["reviewMinimumSeverity"],
                })
              }
              ariaLabel="Minimum review severity"
              valueContent={
                {
                  critical: "Critical",
                  warning: "Warning",
                  suggestion: "Suggestion",
                  informational: "Informational",
                }[settings.reviewMinimumSeverity]
              }
            >
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="suggestion">Suggestion</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
            </SettingsSelectControl>
          }
        />
      </SettingsSection>

      <SettingsSection title="Checks and guidance">
        <ToggleRow
          title="Security checks"
          description="Look for security risks and unsafe data handling."
          settingKey="reviewIncludeSecurity"
          settings={settings}
          patchSettings={patchSettings}
        />
        <ToggleRow
          title="Performance checks"
          description="Look for inefficient or failure-prone hot paths."
          settingKey="reviewIncludePerformance"
          settings={settings}
          patchSettings={patchSettings}
        />
        <ToggleRow
          title="Architecture checks"
          description="Evaluate boundaries, coupling, and cross-module contracts."
          settingKey="reviewIncludeArchitecture"
          settings={settings}
          patchSettings={patchSettings}
        />
        <ToggleRow
          title="Test coverage suggestions"
          description="Call out changed behavior that lacks focused tests."
          settingKey="reviewIncludeTestCoverage"
          settings={settings}
          patchSettings={patchSettings}
        />
        <ToggleRow
          title="Automatic fix suggestions"
          description="Allow concrete fix code or instructions on findings."
          settingKey="reviewAllowFixSuggestions"
          settings={settings}
          patchSettings={patchSettings}
        />
        <SettingsRow
          title="Repository instruction files"
          description="One repository-relative instruction file per line, such as AGENTS.md or CONTRIBUTING.md."
        >
          <div className="mt-3">
            <Textarea
              size="sm"
              value={settings.reviewInstructionFiles}
              onChange={(event) => patchSettings({ reviewInstructionFiles: event.target.value })}
              aria-label="Repository review instruction files"
              spellCheck={false}
            />
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
