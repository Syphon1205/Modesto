import type { AutomationSummary, EnvironmentId } from "@modesto/contracts";
import { CheckIcon, CopyIcon, Loader2Icon, TrashIcon, WebhookIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { webhookCreate, webhookDelete, webhookList, webhookSetEnabled } from "~/state/webhooks";

export function WebhookPanel({
  environmentId,
  automations,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly automations: readonly AutomationSummary[];
}) {
  const list = useEnvironmentQuery(
    environmentId === null ? null : webhookList({ environmentId, input: {} }),
  );
  const createCommand = useAtomCommand(webhookCreate);
  const setEnabledCommand = useAtomCommand(webhookSetEnabled);
  const deleteCommand = useAtomCommand(webhookDelete);
  const [automationId, setAutomationId] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<{
    readonly path: string;
    readonly secret: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const activeAutomations = useMemo(
    () => automations.filter((automation) => automation.state === "active"),
    [automations],
  );
  const selectedAutomationId = automationId || activeAutomations[0]?.id || "";

  const copy = useCallback(async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1_500);
  }, []);

  const create = useCallback(async () => {
    if (!environmentId || !selectedAutomationId || !name.trim() || pending) return;
    setPending("create");
    try {
      const result = await createCommand({
        environmentId,
        input: { automationId: selectedAutomationId, name: name.trim() },
      });
      if (result._tag === "Success") {
        setCreatedSecret({ path: result.value.webhook.path, secret: result.value.secret });
        setName("");
      }
    } finally {
      setPending(null);
    }
  }, [createCommand, environmentId, name, pending, selectedAutomationId]);

  const webhooks = list.data?.webhooks ?? [];
  const webhookUrl = (path: string) => {
    try {
      return resolvePrimaryEnvironmentHttpUrl(path);
    } catch {
      return window.location.protocol === "http:" || window.location.protocol === "https:"
        ? `${window.location.origin}${path}`
        : path;
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card/20 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2">
          <WebhookIcon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Webhook triggers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start an automation from GitHub, CI, monitoring, or any service that can send a signed
            HTTP request.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedAutomationId}
          onChange={(event) => setAutomationId(event.currentTarget.value)}
          disabled={activeAutomations.length === 0 || pending !== null}
          aria-label="Automation"
        >
          {activeAutomations.length === 0 ? (
            <option value="">Create an automation first</option>
          ) : null}
          {activeAutomations.map((automation) => (
            <option key={automation.id} value={automation.id}>
              {automation.name}
            </option>
          ))}
        </select>
        <Input
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="GitHub push"
          aria-label="Webhook name"
          disabled={pending !== null}
        />
        <Button
          onClick={() => void create()}
          disabled={!selectedAutomationId || !name.trim() || pending !== null}
        >
          {pending === "create" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Create webhook
        </Button>
      </div>

      {createdSecret ? (
        <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <p className="text-xs font-medium text-warning-foreground">
            Save this signing secret now. It will not be shown again.
          </p>
          {[
            ["URL", webhookUrl(createdSecret.path)],
            ["Secret", createdSecret.secret],
          ].map(([label, value]) => (
            <div key={label} className="flex min-w-0 items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">{label}</span>
              <code className="min-w-0 flex-1 truncate rounded bg-background/80 px-2 py-1 text-xs">
                {value}
              </code>
              <Button variant="ghost" size="icon-sm" onClick={() => void copy(label!, value!)}>
                {copied === label ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Sign the exact request body with HMAC-SHA256 and send it as{" "}
            <code>x-modesto-signature: sha256=&lt;hex digest&gt;</code>. Use{" "}
            <code>x-modesto-delivery</code> for retry deduplication.
          </p>
        </div>
      ) : null}

      {webhooks.length > 0 ? (
        <div className="divide-y divide-border/60 rounded-xl border border-border/60">
          {webhooks.map((webhook) => {
            const automation = automations.find(
              (candidate) => candidate.id === webhook.automationId,
            );
            return (
              <div key={webhook.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                <Switch
                  checked={webhook.enabled}
                  disabled={pending !== null}
                  onCheckedChange={(enabled) => {
                    if (!environmentId) return;
                    setPending(webhook.id);
                    void setEnabledCommand({
                      environmentId,
                      input: { webhookId: webhook.id, enabled },
                    }).finally(() => setPending(null));
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{webhook.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {automation?.name ?? "Missing automation"}
                    {webhook.lastDeliveryStatus
                      ? ` · last delivery ${webhook.lastDeliveryStatus}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  disabled={pending !== null}
                  aria-label={`Delete ${webhook.name}`}
                  onClick={() => {
                    if (!environmentId) return;
                    setPending(webhook.id);
                    void deleteCommand({
                      environmentId,
                      input: { webhookId: webhook.id },
                    }).finally(() => setPending(null));
                  }}
                >
                  {pending === webhook.id ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <TrashIcon className="size-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
