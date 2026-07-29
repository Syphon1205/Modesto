import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  langGraphSnapshotQueryOptions,
  useInvokeLangGraph,
  useTestLangGraphConnection,
  useUpdateLangGraphConfig,
} from "../../lib/langGraphReactQuery";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const EXAMPLE_INPUT = JSON.stringify(
  {
    messages: [
      {
        role: "user",
        content: "Reply with a short confirmation that Modesto reached this LangGraph assistant.",
      },
    ],
  },
  null,
  2,
);

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : error ? String(error) : null;
}

export function LangGraphSection() {
  const query = useQuery(langGraphSnapshotQueryOptions());
  const update = useUpdateLangGraphConfig();
  const test = useTestLangGraphConnection();
  const invoke = useInvokeLangGraph();
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [inputMode, setInputMode] = useState<"message" | "json">("message");
  const [prompt, setPrompt] = useState(
    "Reply with a short confirmation that Modesto reached this LangGraph assistant.",
  );
  const [inputJson, setInputJson] = useState(EXAMPLE_INPUT);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setDeploymentUrl(query.data.config.deploymentUrl ?? "");
    setAssistantId(query.data.config.assistantId ?? "");
    setEnabled(query.data.config.enabled);
  }, [query.data]);

  if (query.isLoading || !query.data) {
    return (
      <section className="rounded-lg border border-border/70 px-4 py-6 text-sm text-muted-foreground">
        Loading LangGraph…
      </section>
    );
  }

  const { config, status } = query.data;
  const connectionPatch = () => ({
    deploymentUrl: deploymentUrl.trim() || null,
    assistantId: assistantId.trim() || null,
    enabled,
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  });
  const save = () => {
    update.mutate(connectionPatch());
    setApiKey("");
  };
  const saveAndTest = () => {
    update.mutate(connectionPatch(), {
      onSuccess: () => {
        setApiKey("");
        test.mutate();
      },
    });
  };
  const run = () => {
    try {
      const input =
        inputMode === "message"
          ? { messages: [{ role: "user", content: prompt.trim() }] }
          : (JSON.parse(inputJson) as unknown);
      if (inputMode === "message" && !prompt.trim()) {
        setInputError("Enter a message for the assistant.");
        return;
      }
      setInputError(null);
      invoke.mutate({
        ...(assistantId.trim() ? { assistantId: assistantId.trim() } : {}),
        input,
      });
    } catch {
      setInputError("Input must be valid JSON.");
    }
  };
  const requestError =
    errorMessage(update.error) ?? errorMessage(test.error) ?? errorMessage(invoke.error);

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="flex items-start justify-between gap-4 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">LangGraph</h2>
            <span
              className={cn(
                "size-2 rounded-full",
                status.state === "connected"
                  ? "bg-emerald-500"
                  : status.state === "error"
                    ? "bg-destructive"
                    : "bg-muted-foreground/50",
              )}
            />
            <span className="text-xs capitalize text-muted-foreground">{status.state}</span>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Connect a LangGraph Agent Server, discover its assistants, and invoke a graph directly
            from Modesto. API keys stay in Modesto’s permission-protected secret store.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!deploymentUrl.trim() || test.isPending || update.isPending}
          onClick={saveAndTest}
        >
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
      </div>

      <div className="grid gap-4 border-t border-border/70 px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Deployment URL
            <input
              value={deploymentUrl}
              onChange={(event) => setDeploymentUrl(event.target.value)}
              placeholder="https://your-deployment.us.langgraph.app"
              className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground outline-none focus:border-ring"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            API key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={config.hasApiKey ? "Saved · blank keeps current key" : "Optional locally"}
              className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs text-foreground outline-none focus:border-ring"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-end"
            disabled={update.isPending}
            onClick={save}
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        {config.hasApiKey ? (
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>A LangGraph API key is securely saved on this device.</span>
            <button
              type="button"
              className="text-foreground underline-offset-4 hover:underline"
              disabled={update.isPending}
              onClick={() => update.mutate({ apiKey: null })}
            >
              Clear saved key
            </button>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Default assistant
            <select
              value={assistantId}
              onChange={(event) => setAssistantId(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring"
            >
              <option value="">Select an assistant</option>
              {status.assistants.map((assistant) => (
                <option key={assistant.assistantId} value={assistant.assistantId}>
                  {assistant.name || assistant.graphId} · {assistant.graphId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1 text-xs text-foreground">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enable graph runs
          </label>
        </div>

        <div className="grid gap-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Run an assistant</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Send a message and inspect the graph’s final result.
              </div>
            </div>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Input format
              <select
                value={inputMode}
                onChange={(event) => setInputMode(event.target.value as "message" | "json")}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring"
              >
                <option value="message">Chat message</option>
                <option value="json">Custom JSON</option>
              </select>
            </label>
          </div>
          {inputMode === "message" ? (
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-24 resize-y rounded-md border border-input bg-transparent p-2.5 text-sm text-foreground outline-none focus:border-ring"
            />
          ) : (
            <textarea
              value={inputJson}
              onChange={(event) => setInputJson(event.target.value)}
              spellCheck={false}
              className="min-h-32 resize-y rounded-md border border-input bg-transparent p-2.5 font-mono text-xs text-foreground outline-none focus:border-ring"
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {status.message ?? "Save a deployment and test the connection."}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={!config.enabled || !assistantId || invoke.isPending}
              onClick={run}
            >
              {invoke.isPending ? "Running…" : "Run graph"}
            </Button>
          </div>
          {inputError || requestError ? (
            <p className="text-xs text-destructive">{inputError ?? requestError}</p>
          ) : null}
          {invoke.data ? (
            <pre className="max-h-72 overflow-auto rounded-md bg-[var(--color-background-elevated-secondary)] p-3 text-xs text-foreground">
              {JSON.stringify(invoke.data.output, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </section>
  );
}
