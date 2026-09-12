// FILE: AutomationEditorPage.tsx
// Purpose: Dedicated create tab for a new automation (Cursor-style).
// Layer: Automations UI

import { useAtomValue } from "@effect/atom-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { deriveProviderInstanceEntries } from "~/providerInstances";
import { automationCreate } from "~/state/automations";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { primaryServerProvidersAtom } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";

import {
  DEFAULT_SCHEDULE_FORM,
  localTimezone,
  toSchedule,
  WEEKDAY_LABELS,
  type ScheduleFormValue,
} from "./automationSchedule";
import { AUTOMATION_TEMPLATES } from "./automationTemplates";

export function AutomationEditorPage({ templateId }: { readonly templateId?: string }) {
  const navigate = useNavigate();
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const createCommand = useAtomCommand(automationCreate);
  const providers = useAtomValue(primaryServerProvidersAtom);

  const template = useMemo(
    () => AUTOMATION_TEMPLATES.find((entry) => entry.id === templateId) ?? null,
    [templateId],
  );

  const [name, setName] = useState(template?.name ?? "");
  const [instructions, setInstructions] = useState(template?.instructions ?? "");
  const [schedule, setSchedule] = useState<ScheduleFormValue>(
    template?.schedule ?? DEFAULT_SCHEDULE_FORM,
  );
  const [modelIndex, setModelIndex] = useState(0);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timezone = useMemo(() => localTimezone(), []);

  const modelOptions = useMemo(
    () =>
      deriveProviderInstanceEntries(providers ?? []).flatMap((entry) =>
        entry.models.map((model) => ({ instanceId: entry.instanceId, model: model.slug })),
      ),
    [providers],
  );
  const chosenModel = modelOptions[modelIndex] ?? modelOptions[0];
  const canSubmit = name.trim().length > 0 && instructions.trim().length > 0 && !!chosenModel;

  const closeEditor = useCallback(() => {
    void navigate({ to: "/automations" });
  }, [navigate]);

  const handleCreate = useCallback(async () => {
    if (environmentId === null || !chosenModel || !canSubmit) return;
    const built = toSchedule(schedule, timezone, Date.now());
    if (built === null) {
      setScheduleError(
        schedule.kind === "once"
          ? "Pick a time in the future — a one-off in the past would never run."
          : schedule.kind === "weekly"
            ? "Pick at least one day and a valid time."
            : "Enter a valid time, like 09:00.",
      );
      return;
    }
    setScheduleError(null);
    setPending(true);
    try {
      const result = await createCommand({
        environmentId,
        input: {
          name: name.trim(),
          instructions: instructions.trim(),
          schedule: built,
          model: { providerId: chosenModel.instanceId, modelId: chosenModel.model },
        },
      });
      if (result._tag === "Success") {
        void navigate({ to: "/automations" });
      }
    } finally {
      setPending(false);
    }
  }, [
    canSubmit,
    chosenModel,
    createCommand,
    environmentId,
    instructions,
    name,
    navigate,
    schedule,
    timezone,
  ]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <Button type="button" size="xs" variant="ghost" onClick={closeEditor} aria-label="Back">
          <ArrowLeftIcon className="size-3.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">New automation</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Trigger on a schedule · Action runs an agent in a managed workspace
          </p>
        </div>
        <Button type="button" size="xs" variant="ghost" onClick={closeEditor} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          size="xs"
          disabled={!canSubmit || pending}
          onClick={() => void handleCreate()}
        >
          {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Create
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-8">
          <p className="text-[12px] text-muted-foreground">
            <Link to="/automations" className="hover:text-foreground">
              Automations
            </Link>
            <span className="mx-1.5 text-border">/</span>
            <span className="text-foreground">New</span>
            {template ? (
              <>
                <span className="mx-1.5 text-border">/</span>
                <span className="text-foreground">{template.name}</span>
              </>
            ) : null}
          </p>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Name, e.g. Morning digest"
              aria-label="Automation name"
              autoFocus
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Instructions</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.currentTarget.value)}
              placeholder="What should it do? This is the message the agent receives."
              aria-label="Instructions"
              rows={12}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
          </label>

          <div className="space-y-2">
            <span className="text-[12px] font-medium text-muted-foreground">Schedule</span>
            <div className="flex flex-wrap items-center gap-2">
              {(["daily", "weekly", "once"] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  size="xs"
                  variant={schedule.kind === kind ? "outline" : "ghost"}
                  onClick={() => setSchedule((current) => ({ ...current, kind }))}
                >
                  {kind === "once" ? "Once" : kind === "daily" ? "Daily" : "Weekly"}
                </Button>
              ))}

              {schedule.kind === "once" ? (
                <Input
                  type="datetime-local"
                  value={schedule.at}
                  onChange={(event) => {
                    const at = event.currentTarget.value;
                    setSchedule((current) => ({ ...current, at }));
                  }}
                  aria-label="Run at"
                  className="w-56"
                />
              ) : (
                <Input
                  type="time"
                  value={schedule.time}
                  onChange={(event) => {
                    const time = event.currentTarget.value;
                    setSchedule((current) => ({ ...current, time }));
                  }}
                  aria-label="Time of day"
                  className="w-32"
                />
              )}
            </div>

            {schedule.kind === "weekly" ? (
              <div className="flex flex-wrap gap-1">
                {WEEKDAY_LABELS.map((label, day) => {
                  const selected = schedule.daysOfWeek.includes(day);
                  return (
                    <Button
                      key={label}
                      type="button"
                      size="xs"
                      variant={selected ? "outline" : "ghost"}
                      onClick={() =>
                        setSchedule((current) => ({
                          ...current,
                          daysOfWeek: selected
                            ? current.daysOfWeek.filter((value) => value !== day)
                            : [...current.daysOfWeek, day],
                        }))
                      }
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            <p className="text-[11.5px] text-muted-foreground">Times are in {timezone}.</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Model</span>
            {modelOptions.length > 0 ? (
              <select
                value={modelIndex}
                onChange={(event) => setModelIndex(Number(event.currentTarget.value))}
                aria-label="Model"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              >
                {modelOptions.map((option, index) => (
                  <option key={`${option.instanceId}:${option.model}`} value={index}>
                    {option.instanceId} · {option.model}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                No provider is ready yet. Enable one in Settings → Providers first.
              </p>
            )}
          </label>

          {scheduleError ? (
            <p className="text-[12px] text-destructive-foreground">{scheduleError}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
