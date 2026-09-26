// FILE: ModelRoutersSection.tsx
// Purpose: Settings > Providers > "API providers" - connects hosted,
// API-key model APIs (OpenRouter, NVIDIA NIM, Groq, ...) and self-hosted
// OpenAI-compatible servers (vLLM, LM Studio, Ollama). Each saved entry is a
// custom model endpoint that becomes a selectable entry in the model picker.
// Picking a preset from `@modesto/shared/apiKeyProviders` fills in the
// connection details so the user only pastes a key and picks models; "Custom"
// keeps the free-form URL flow. Codex consumes endpoints through
// `model_providers` launch args; OpenCode and Kilo use their native provider
// block.

import type { CustomModelEndpointConfig, EnvironmentId } from "@modesto/contracts";
import {
  API_KEY_PROVIDER_PRESETS,
  apiKeyProviderPresetForBaseUrl,
} from "@modesto/shared/apiKeyProviders";
import { ExternalLinkIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { ApiProviderMark } from "../ApiProviderIcons";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@modesto/client-runtime/state/runtime";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  CUSTOM_PRESET_VALUE,
  EMPTY_DRAFT,
  type EndpointDraft,
  addModelsToDraft,
  applyDiscoveredModels,
  applyPresetToDraft,
  canSaveDraft,
  draftFromEndpoint,
  draftPreset,
  inferEndpointLabel,
  modelSuggestions,
  removeModelFromDraft,
} from "./ModelRoutersSection.logic";
import { SettingsRow, SettingsSection } from "./settingsLayout";

const HOSTED_PRESETS = API_KEY_PROVIDER_PRESETS.filter((preset) => !preset.local);
const LOCAL_PRESETS = API_KEY_PROVIDER_PRESETS.filter((preset) => preset.local);

function PresetOption({ presetId }: { readonly presetId: string }) {
  const label =
    API_KEY_PROVIDER_PRESETS.find((preset) => preset.id === presetId)?.label ?? "Custom endpoint";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ApiProviderMark presetId={presetId} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function EndpointTitle({ endpoint }: { readonly endpoint: CustomModelEndpointConfig }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ApiProviderMark presetId={apiKeyProviderPresetForBaseUrl(endpoint.baseUrl)?.id} />
      <span className="truncate">{endpoint.label}</span>
    </span>
  );
}

function openKeyPage(url: string) {
  void ensureLocalApi()
    .shell.openExternal(url)
    .catch((error: unknown) => {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not open link",
          description: error instanceof Error ? error.message : "Failed to open the link.",
        }),
      );
    });
}

function endpointDescription(endpoint: CustomModelEndpointConfig): string {
  const preset = apiKeyProviderPresetForBaseUrl(endpoint.baseUrl);
  const location = preset && !preset.local ? preset.label : endpoint.baseUrl;
  const models =
    endpoint.models.length === 0
      ? ""
      : endpoint.models.length <= 3
        ? ` · ${endpoint.models.join(", ")}`
        : ` · ${endpoint.models.slice(0, 3).join(", ")} +${endpoint.models.length - 3} more`;
  const availability = preset?.codexCompatible === false ? " · OpenCode & Kilo only" : "";
  return `${location}${models}${availability}`;
}

export function ModelRoutersSection({
  environmentId,
  endpoints,
  readOnly,
}: {
  readonly environmentId: EnvironmentId;
  readonly endpoints: ReadonlyArray<CustomModelEndpointConfig>;
  readonly readOnly: boolean;
}) {
  const [draft, setDraft] = useState<EndpointDraft | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const setCustomModelEndpoint = useAtomCommand(serverEnvironment.setCustomModelEndpoint, {
    reportFailure: false,
  });
  const discoverCustomModelEndpoint = useAtomCommand(
    serverEnvironment.discoverCustomModelEndpoint,
    { reportFailure: false },
  );
  const deleteCustomModelEndpoint = useAtomCommand(serverEnvironment.deleteCustomModelEndpoint, {
    reportFailure: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const openDraft = (next: EndpointDraft | null) => {
    setDraft(next);
    setModelQuery("");
  };

  const discoverModels = async (target: EndpointDraft, reportFailure: boolean) => {
    if (!target.baseUrl.trim() || isDiscovering) return;
    setIsDiscovering(true);
    const result = await discoverCustomModelEndpoint({
      environmentId,
      input: {
        baseUrl: target.baseUrl.trim(),
        ...(target.apiKey.trim() ? { apiKey: target.apiKey.trim() } : {}),
      },
    });
    setIsDiscovering(false);
    if (result._tag === "Success") {
      setDraft((current) =>
        // Ignore a late response for a provider the user has since switched away from.
        current && current.baseUrl === target.baseUrl
          ? applyDiscoveredModels(current, result.value.models)
          : current,
      );
      return;
    }
    if (reportFailure && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not discover models",
          description:
            error instanceof Error
              ? error.message
              : "Enter a model ID manually and you can still save this endpoint.",
        }),
      );
    }
  };

  const selectPreset = (presetId: string) => {
    if (!draft) return;
    const next = applyPresetToDraft(draft, presetId);
    openDraft(next);
    const preset = draftPreset(next);
    // Keyless presets and ones whose key is already typed can list models right away.
    if (preset && (!preset.requiresApiKey || next.apiKey.trim())) {
      void discoverModels(next, false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const pending = modelQuery.trim() ? addModelsToDraft(draft, modelQuery) : draft;
    setIsSaving(true);
    const result = await setCustomModelEndpoint({
      environmentId,
      input: {
        ...(pending.id ? { id: pending.id } : {}),
        label: pending.label.trim(),
        baseUrl: pending.baseUrl.trim(),
        // Kept on the RPC for compatibility with older servers. Current
        // servers treat transport as a provider implementation detail.
        wireApi: "chat",
        models: pending.models,
        ...(pending.apiKey.trim() ? { apiKey: pending.apiKey.trim() } : {}),
      },
    });
    setIsSaving(false);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not save endpoint",
          description:
            error instanceof Error ? error.message : "Please check the details and retry.",
        }),
      );
      return;
    }
    openDraft(null);
  };

  const removeEndpoint = async (id: string) => {
    setDeletingId(id);
    const result = await deleteCustomModelEndpoint({ environmentId, input: { id } });
    setDeletingId(null);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not remove endpoint",
          description: error instanceof Error ? error.message : "Please try again.",
        }),
      );
    }
  };

  const preset = draft ? draftPreset(draft) : undefined;
  const isCustom = !preset;
  const suggestions = draft ? modelSuggestions(draft, modelQuery) : [];
  const commitModelQuery = () => {
    if (!draft || !modelQuery.trim()) return;
    setDraft(addModelsToDraft(draft, modelQuery));
    setModelQuery("");
  };

  return (
    <SettingsSection
      title="API providers"
      headerAction={
        !readOnly && !draft ? (
          <Button type="button" size="xs" variant="outline" onClick={() => openDraft(EMPTY_DRAFT)}>
            Add provider
          </Button>
        ) : null
      }
    >
      {endpoints.length === 0 && !draft ? (
        <SettingsRow
          title="No API providers yet"
          description="Paste an API key for OpenRouter, NVIDIA NIM, Groq, DeepSeek and more, or point at a self-hosted OpenAI-compatible server, to use its models from OpenCode, Kilo, and Codex."
        />
      ) : (
        endpoints.map((endpoint) => (
          <SettingsRow
            key={endpoint.id}
            title={<EndpointTitle endpoint={endpoint} />}
            description={endpointDescription(endpoint)}
            control={
              !readOnly ? (
                <>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => openDraft(draftFromEndpoint(endpoint))}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    disabled={deletingId === endpoint.id}
                    onClick={() => void removeEndpoint(endpoint.id)}
                  >
                    Remove
                  </Button>
                </>
              ) : null
            }
          />
        ))
      )}

      {draft ? (
        <SettingsRow title={draft.id ? `Edit ${draft.label || "provider"}` : "New provider"}>
          <div className="space-y-3 pt-2 pb-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-xs text-muted-foreground">
                Provider
                <Select
                  value={draft.presetId}
                  onValueChange={(value) => {
                    if (typeof value === "string") selectPreset(value);
                  }}
                >
                  <SelectTrigger size="sm" aria-label="Provider">
                    <SelectValue>
                      <PresetOption presetId={draft.presetId} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup alignItemWithTrigger={false} className="max-h-80">
                    <SelectGroup>
                      <SelectGroupLabel>Hosted · API key</SelectGroupLabel>
                      {HOSTED_PRESETS.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          <PresetOption presetId={entry.id} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectGroupLabel>Local</SelectGroupLabel>
                      {LOCAL_PRESETS.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          <PresetOption presetId={entry.id} />
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_PRESET_VALUE}>
                        <PresetOption presetId={CUSTOM_PRESET_VALUE} />
                      </SelectItem>
                    </SelectGroup>
                  </SelectPopup>
                </Select>
              </div>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span className="flex items-center justify-between">
                  <span>
                    API key{" "}
                    {preset?.requiresApiKey ? null : (
                      <span className="font-normal text-muted-foreground/60">(optional)</span>
                    )}
                  </span>
                  {preset?.keyUrl ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] text-foreground/70 hover:text-foreground"
                      onClick={() => openKeyPage(preset.keyUrl!)}
                    >
                      Get a key
                      <ExternalLinkIcon className="size-3" />
                    </button>
                  ) : null}
                </span>
                <Input
                  type="password"
                  size="sm"
                  value={draft.apiKey}
                  onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                  onBlur={() => {
                    if (draft.apiKey.trim() && draft.availableModels.length === 0) {
                      void discoverModels(draft, false);
                    }
                  }}
                  placeholder={
                    draft.id
                      ? "Leave blank to keep the saved key"
                      : preset?.requiresApiKey
                        ? `Paste your ${preset.label} key`
                        : "Not required for local servers"
                  }
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
            </div>

            {isCustom || preset?.local ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  Label
                  <Input
                    size="sm"
                    value={draft.label}
                    onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                    placeholder="My vLLM server"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Base URL
                  <Input
                    size="sm"
                    value={draft.baseUrl}
                    onChange={(event) => {
                      const baseUrl = event.target.value;
                      setDraft({
                        ...draft,
                        baseUrl,
                        label: draft.label || inferEndpointLabel(baseUrl) || "",
                      });
                    }}
                    onBlur={() => {
                      if (draft.models.length === 0) void discoverModels(draft, false);
                    }}
                    placeholder="http://127.0.0.1:8000/v1"
                    spellCheck={false}
                  />
                </label>
              </div>
            ) : null}

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>
                  Models
                  {draft.availableModels.length > 0 ? (
                    <span className="font-normal text-muted-foreground/60">
                      {" "}
                      · {draft.availableModels.length} available
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="text-[11px] text-foreground/70 hover:text-foreground disabled:opacity-50"
                  disabled={!draft.baseUrl.trim() || isDiscovering}
                  onClick={() => void discoverModels(draft, true)}
                >
                  {isDiscovering
                    ? "Discovering…"
                    : draft.availableModels.length > 0
                      ? "Refresh list"
                      : "Discover models"}
                </button>
              </div>
              {draft.models.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {draft.models.map((model) => (
                    <span
                      key={model}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/40 py-0.5 ps-2 pe-1 font-mono text-[11px] text-foreground"
                    >
                      <span className="truncate">{model}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${model}`}
                        className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setDraft(removeModelFromDraft(draft, model))}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <Input
                size="sm"
                value={modelQuery}
                onChange={(event) => setModelQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const [first] = suggestions;
                    if (first && modelQuery.trim() && first !== modelQuery.trim()) {
                      setDraft(addModelsToDraft(draft, first));
                      setModelQuery("");
                    } else {
                      commitModelQuery();
                    }
                  }
                }}
                placeholder={
                  draft.availableModels.length > 0
                    ? "Search models, Enter to add"
                    : "Enter a model ID, Enter to add"
                }
                spellCheck={false}
              />
              {suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((model) => (
                    <button
                      key={model}
                      type="button"
                      className="max-w-full truncate rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-[11px] text-foreground/70 hover:border-solid hover:text-foreground"
                      onClick={() => setDraft(addModelsToDraft(draft, model))}
                    >
                      + {model}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground/70">
                {preset?.codexCompatible === false
                  ? `${preset.label} models appear in OpenCode and Kilo. Codex needs a Responses-compatible API.`
                  : null}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="xs" variant="ghost" onClick={() => openDraft(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  disabled={
                    !canSaveDraft(
                      modelQuery.trim() ? addModelsToDraft(draft, modelQuery) : draft,
                      draft.id !== null,
                    ) || isSaving
                  }
                  onClick={() => void saveDraft()}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </SettingsRow>
      ) : null}
    </SettingsSection>
  );
}
