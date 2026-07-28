// FILE: ModelRoutersSettingsPanel.tsx
// Purpose: Settings → Model Routers panel. Lets users define custom OpenAI-compatible
// Codex backends (vLLM, LM Studio, OpenRouter, Portkey, LiteLLM, etc) — each becomes a
// selectable entry in the Codex model picker via `-c model_provider=<id>`.

import type { CustomModelEndpointStatus, CustomModelEndpointWireApi } from "@modesto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SecretInput } from "~/components/ui/secret-input";
import {
  SettingsListRow,
  SettingsRow,
  SettingsSection,
} from "~/components/settings/SettingsPanelPrimitives";
import { CheckIcon, Loader2Icon } from "~/lib/icons";
import { ensureNativeApi } from "~/nativeApi";
import { serverConfigQueryOptions, serverQueryKeys } from "~/lib/serverReactQuery";
import { toastManager } from "~/components/ui/toast";

interface EndpointDraft {
  id: string | null;
  label: string;
  baseUrl: string;
  wireApi: CustomModelEndpointWireApi;
  modelsText: string;
  apiKey: string;
}

const EMPTY_DRAFT: EndpointDraft = {
  id: null,
  label: "",
  baseUrl: "",
  wireApi: "chat",
  modelsText: "",
  apiKey: "",
};

function draftFromEndpoint(endpoint: CustomModelEndpointStatus): EndpointDraft {
  return {
    id: endpoint.id,
    label: endpoint.label,
    baseUrl: endpoint.baseUrl,
    wireApi: endpoint.wireApi,
    modelsText: endpoint.models.join(", "),
    apiKey: "",
  };
}

function parseModelsText(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ];
}

export function ModelRoutersSettingsPanel() {
  const queryClient = useQueryClient();
  const configQuery = useQuery(serverConfigQueryOptions());
  const endpoints = configQuery.data?.customModelEndpoints ?? [];
  const [draft, setDraft] = useState<EndpointDraft | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });

  const saveMutation = useMutation({
    mutationFn: (input: EndpointDraft) =>
      ensureNativeApi().server.setCustomModelEndpoint({
        ...(input.id ? { id: input.id } : {}),
        label: input.label.trim(),
        baseUrl: input.baseUrl.trim(),
        wireApi: input.wireApi,
        models: parseModelsText(input.modelsText),
        ...(input.apiKey.trim() ? { apiKey: input.apiKey.trim() } : {}),
      }),
    onSuccess: async () => {
      setDraft(null);
      await invalidate();
      toastManager.add({ type: "success", title: "Endpoint saved" });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not save endpoint",
        description: error instanceof Error ? error.message : "Please check the details and retry.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ensureNativeApi().server.deleteCustomModelEndpoint({ id }),
    onSuccess: async () => {
      await invalidate();
      toastManager.add({ type: "info", title: "Endpoint removed" });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not remove endpoint",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  return (
    <div className="space-y-6">
      <SettingsSection title="Custom endpoints">
        {endpoints.length === 0 && !draft ? (
          <SettingsListRow
            title="No custom endpoints yet"
            description="Add a self-hosted OpenAI-compatible server (vLLM, LM Studio) or a router (OpenRouter, Portkey, LiteLLM) to use it from the Codex model picker."
            actions={
              <Button type="button" size="sm" onClick={() => setDraft(EMPTY_DRAFT)}>
                Add endpoint
              </Button>
            }
          />
        ) : (
          endpoints.map((endpoint) => (
            <SettingsListRow
              key={endpoint.id}
              title={endpoint.label}
              description={`${endpoint.baseUrl} · ${endpoint.wireApi === "responses" ? "Responses API" : "Chat Completions"}${endpoint.models.length > 0 ? ` · ${endpoint.models.join(", ")}` : ""}`}
              actions={
                <>
                  {endpoint.apiKeyConfigured ? (
                    <span className="flex items-center gap-1.5 text-xs text-success">
                      <CheckIcon className="size-3.5" /> Key saved
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setDraft(draftFromEndpoint(endpoint))}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(endpoint.id)}
                  >
                    Remove
                  </Button>
                </>
              }
            />
          ))
        )}
        {endpoints.length > 0 && !draft ? (
          <SettingsListRow
            title="Add another endpoint"
            description="Every endpoint you add shows up as its own selectable model under Codex."
            actions={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft(EMPTY_DRAFT)}
              >
                Add endpoint
              </Button>
            }
          />
        ) : null}
      </SettingsSection>

      {draft ? (
        <SettingsSection title={draft.id ? "Edit endpoint" : "New endpoint"}>
          <div className="space-y-4 px-4 py-4">
            <SettingsRow title="Label" description="Shown in the Codex model picker.">
              <Input
                size="sm"
                variant="soft"
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                placeholder="OpenRouter"
              />
            </SettingsRow>
            <SettingsRow
              title="Base URL"
              description="The OpenAI-compatible API root, e.g. http://localhost:8000/v1."
            >
              <Input
                size="sm"
                variant="soft"
                value={draft.baseUrl}
                onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                placeholder="https://openrouter.ai/api/v1"
                spellCheck={false}
              />
            </SettingsRow>
            <SettingsRow
              title="Wire API"
              description="Chat Completions works with almost every OpenAI-compatible server; use Responses only if the backend explicitly supports it."
            >
              <div className="flex gap-2">
                {(["chat", "responses"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={draft.wireApi === option ? "secondary" : "outline"}
                    onClick={() => setDraft({ ...draft, wireApi: option })}
                  >
                    {option === "chat" ? "Chat Completions" : "Responses"}
                  </Button>
                ))}
              </div>
            </SettingsRow>
            <SettingsRow
              title="Models"
              description="Comma-separated model IDs this endpoint serves (Modesto can't discover them automatically)."
            >
              <Input
                size="sm"
                variant="soft"
                value={draft.modelsText}
                onChange={(event) => setDraft({ ...draft, modelsText: event.target.value })}
                placeholder="meta-llama/Llama-3.3-70B-Instruct"
                spellCheck={false}
              />
            </SettingsRow>
            <SettingsRow
              title="API key"
              description={
                draft.id
                  ? "Leave blank to keep the currently saved key."
                  : "Sent as the endpoint's env_key in Codex's config, never shown again after saving."
              }
            >
              <SecretInput
                size="sm"
                variant="soft"
                value={draft.apiKey}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                placeholder={draft.id ? "Replace saved key" : "Paste API key"}
                spellCheck={false}
              />
            </SettingsRow>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draft.label.trim() || !draft.baseUrl.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate(draft)}
              >
                {saveMutation.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </SettingsSection>
      ) : null}
    </div>
  );
}
