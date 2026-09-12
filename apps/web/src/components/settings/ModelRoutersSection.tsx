// FILE: ModelRoutersSection.tsx
// Purpose: Settings > Providers > "Custom endpoints" - lets a user define
// custom or self-hosted OpenAI-compatible Codex backends (vLLM, LM Studio,
// OpenRouter, Portkey, LiteLLM, etc), each becoming a selectable entry in
// the model picker. Three drivers consume these, each through its own native
// mechanism: Codex (`-c model_providers.<id>.*` launch args, see
// CodexAdapter.ts) and OpenCode/Kilo (the `provider` block of
// OPENCODE_CONFIG_CONTENT, see customModelEndpointsOpenCode.ts). No other
// driver here has an equivalent, so endpoints genuinely do not apply to them.

import type {
  CustomModelEndpointConfig,
  CustomModelEndpointWireApi,
  EnvironmentId,
} from "@modesto/contracts";
import { useState } from "react";

import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@modesto/client-runtime/state/runtime";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsRow, SettingsSection } from "./settingsLayout";

interface EndpointDraft {
  readonly id: string | null;
  readonly label: string;
  readonly baseUrl: string;
  readonly wireApi: CustomModelEndpointWireApi;
  readonly modelsText: string;
  readonly apiKey: string;
}

const EMPTY_DRAFT: EndpointDraft = {
  id: null,
  label: "",
  baseUrl: "",
  wireApi: "chat",
  modelsText: "",
  apiKey: "",
};

function draftFromEndpoint(endpoint: CustomModelEndpointConfig): EndpointDraft {
  return {
    id: endpoint.id,
    label: endpoint.label,
    baseUrl: endpoint.baseUrl,
    wireApi: endpoint.wireApi,
    modelsText: endpoint.models.join(", "),
    apiKey: "",
  };
}

function parseModelsText(value: string): ReadonlyArray<string> {
  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ];
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
  const setCustomModelEndpoint = useAtomCommand(serverEnvironment.setCustomModelEndpoint, {
    reportFailure: false,
  });
  const deleteCustomModelEndpoint = useAtomCommand(serverEnvironment.deleteCustomModelEndpoint, {
    reportFailure: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const saveDraft = async () => {
    if (!draft) return;
    setIsSaving(true);
    const result = await setCustomModelEndpoint({
      environmentId,
      input: {
        ...(draft.id ? { id: draft.id } : {}),
        label: draft.label.trim(),
        baseUrl: draft.baseUrl.trim(),
        wireApi: draft.wireApi,
        models: parseModelsText(draft.modelsText),
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
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
    setDraft(null);
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

  return (
    <SettingsSection
      title="Custom endpoints"
      headerAction={
        !readOnly && !draft ? (
          <Button type="button" size="xs" variant="outline" onClick={() => setDraft(EMPTY_DRAFT)}>
            Add endpoint
          </Button>
        ) : null
      }
    >
      {endpoints.length === 0 && !draft ? (
        <SettingsRow
          title="No custom endpoints yet"
          description="Add a self-hosted OpenAI-compatible server (vLLM, LM Studio) or a router (OpenRouter, Portkey, LiteLLM) to use its models from Codex, OpenCode, and Kilo."
        />
      ) : (
        endpoints.map((endpoint) => (
          <SettingsRow
            key={endpoint.id}
            title={endpoint.label}
            description={`${endpoint.baseUrl} · ${endpoint.wireApi === "responses" ? "Responses API" : "Chat Completions"}${endpoint.models.length > 0 ? ` · ${endpoint.models.join(", ")}` : ""}`}
            control={
              !readOnly ? (
                <>
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
        <SettingsRow title={draft.id ? "Edit endpoint" : "New endpoint"}>
          <div className="space-y-3 pt-2 pb-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                Label
                <Input
                  size="sm"
                  value={draft.label}
                  onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                  placeholder="OpenRouter"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Base URL
                <Input
                  size="sm"
                  value={draft.baseUrl}
                  onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                  placeholder="https://openrouter.ai/api/v1"
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                Models
                <Input
                  size="sm"
                  value={draft.modelsText}
                  onChange={(event) => setDraft({ ...draft, modelsText: event.target.value })}
                  placeholder="meta-llama/Llama-3.3-70B-Instruct"
                  spellCheck={false}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                API key
                <Input
                  type="password"
                  size="sm"
                  value={draft.apiKey}
                  onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                  placeholder={draft.id ? "Leave blank to keep the saved key" : "Paste API key"}
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {(["chat", "responses"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="xs"
                    variant={draft.wireApi === option ? "secondary" : "outline"}
                    onClick={() => setDraft({ ...draft, wireApi: option })}
                  >
                    {option === "chat" ? "Chat Completions" : "Responses"}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="xs" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  disabled={!draft.label.trim() || !draft.baseUrl.trim() || isSaving}
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
