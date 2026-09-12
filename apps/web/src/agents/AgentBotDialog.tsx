// FILE: AgentBotDialog.tsx
// Purpose: Create or edit one agent bot — identity, persona, home project,
//          model, and face.
// Layer: Agents UI

import { useAtomValue } from "@effect/atom-react";
import type { AgentBot, AgentBotDraft } from "@modesto/contracts";
import { avatarSpecForName } from "./avatar/agentAvatarRandom";
import { useEffect, useMemo, useState } from "react";

import { AgentAvatar } from "./AgentAvatar";
import { AGENT_STARTERS, applyAgentStarter } from "./agentStarters";
import { cn } from "~/lib/utils";
import { AvatarLab } from "./AvatarLab";
import { draftFromBot } from "./agentRoster";
import { formatProjectKey } from "./useDispatchAgentBot";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { deriveProviderInstanceEntries } from "~/providerInstances";
import { useProjects } from "~/state/entities";
import { primaryServerProvidersAtom } from "~/state/server";

function emptyDraft(): AgentBotDraft {
  return {
    name: "",
    tagline: "",
    persona: "",
    avatar: avatarSpecForName("agent"),
    model: null,
    homeProjectKey: null,
  };
}

export interface AgentBotDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Omit to create. Provide to edit in place. */
  readonly bot?: AgentBot | undefined;
  readonly onSubmit: (draft: AgentBotDraft) => void;
}

export function AgentBotDialog({ open, onOpenChange, bot, onSubmit }: AgentBotDialogProps) {
  const projects = useProjects();
  const providers = useAtomValue(primaryServerProvidersAtom);
  const instances = useMemo(() => deriveProviderInstanceEntries(providers), [providers]);

  const [draft, setDraft] = useState<AgentBotDraft>(() => (bot ? draftFromBot(bot) : emptyDraft()));
  const [section, setSection] = useState<"identity" | "appearance" | "setup">("identity");
  const [avatarCustomized, setAvatarCustomized] = useState(Boolean(bot));
  // Re-seed whenever the dialog opens: reopening "New agent" must not show the
  // half-filled character the user abandoned last time.
  useEffect(() => {
    if (open) {
      setDraft(bot ? draftFromBot(bot) : emptyDraft());
      setAvatarCustomized(Boolean(bot));
      setSection("identity");
    }
  }, [open, bot]);

  const canSubmit = draft.name.trim().length > 0;

  const submit = (): void => {
    if (!canSubmit) return;
    onSubmit(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-3xl overflow-hidden">
        <DialogHeader className="px-7 pt-7 pb-3 sm:px-8">
          <DialogTitle className="text-2xl">{bot ? `Edit ${bot.name}` : "New agent"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80">
            A familiar face for the work you do often. Make this agent your own.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="max-h-[62vh] overflow-y-auto px-7 pb-5 sm:px-8">
          <nav
            aria-label="Agent editor sections"
            className="mb-6 flex gap-1 border-b border-border"
          >
            {(
              [
                ["identity", "Identity"],
                ["appearance", "Character"],
                ["setup", "Workspace & model"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-current={section === id ? "page" : undefined}
                onClick={() => setSection(id)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  section === id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex flex-col gap-5">
            {section !== "appearance" ? (
              <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <AgentAvatar spec={draft.avatar} size={64} title="Character preview" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">
                    {draft.name.trim() || "Your next teammate"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {draft.tagline.trim() || "A little personality. A clear purpose."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSection("appearance")}
                >
                  Edit look
                </Button>
              </div>
            ) : null}
            {section === "identity" ? (
              <>
                {!bot ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Start with a role, or write your own below.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {AGENT_STARTERS.map((starter) => (
                        <button
                          key={starter.id}
                          type="button"
                          onClick={() =>
                            setDraft((current) =>
                              applyAgentStarter(current, starter, avatarCustomized),
                            )
                          }
                          className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <span className="block text-xs font-medium">{starter.name}</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {starter.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Name</span>
                    <Input
                      value={draft.name}
                      maxLength={60}
                      placeholder="Scout"
                      onChange={(event) => {
                        const name = event.currentTarget.value;
                        setDraft((current) => ({
                          ...current,
                          name,
                          avatar: !avatarCustomized
                            ? avatarSpecForName(name || "agent")
                            : current.avatar,
                        }));
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Tagline</span>
                    <Input
                      value={draft.tagline}
                      maxLength={120}
                      placeholder="Triages failing tests"
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, tagline: event.currentTarget.value }))
                      }
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Personality & instructions
                  </span>
                  <Textarea
                    value={draft.persona}
                    rows={5}
                    maxLength={8_000}
                    placeholder="You investigate failing tests. Start by reproducing the failure, then find the smallest change that fixes it. Never disable a test to make it pass."
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, persona: event.currentTarget.value }))
                    }
                  />
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    Describe how this agent should think, communicate, and approach its work. These
                    instructions are included when you prepare a task.
                  </span>
                </label>
              </>
            ) : null}

            {section === "setup" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Works in</span>
                    <select
                      value={draft.homeProjectKey ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          homeProjectKey: event.currentTarget.value || null,
                        }))
                      }
                      className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      <option value="">Current project</option>
                      {draft.homeProjectKey &&
                      !projects.some(
                        (project) =>
                          formatProjectKey(project.environmentId, project.id) ===
                          draft.homeProjectKey,
                      ) ? (
                        <option value={draft.homeProjectKey}>
                          Unavailable project — choose another
                        </option>
                      ) : null}
                      {projects.map((project) => (
                        <option
                          key={formatProjectKey(project.environmentId, project.id)}
                          value={formatProjectKey(project.environmentId, project.id)}
                        >
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Model</span>
                    <select
                      value={
                        draft.model
                          ? JSON.stringify([draft.model.providerId, draft.model.modelId])
                          : ""
                      }
                      onChange={(event) => {
                        const raw = event.currentTarget.value;
                        if (raw === "") {
                          setDraft((current) => ({ ...current, model: null }));
                          return;
                        }
                        const [providerId, modelId] = JSON.parse(raw) as [string, string];
                        setDraft((current) => ({
                          ...current,
                          model:
                            providerId && modelId ? { providerId, modelId, variant: null } : null,
                        }));
                      }}
                      className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      <option value="">Composer default</option>
                      {draft.model &&
                      !instances.some(
                        (instance) =>
                          instance.instanceId === draft.model?.providerId &&
                          instance.models.some((model) => model.slug === draft.model?.modelId),
                      ) ? (
                        <option
                          value={JSON.stringify([draft.model.providerId, draft.model.modelId])}
                        >
                          {draft.model.modelId} (unavailable)
                        </option>
                      ) : null}
                      {instances.map((instance) =>
                        instance.models.map((model) => (
                          <option
                            key={`${instance.instanceId}::${model.slug}`}
                            value={JSON.stringify([instance.instanceId, model.slug])}
                          >
                            {instance.displayName} · {model.name || model.slug}
                          </option>
                        )),
                      )}
                    </select>
                  </label>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tasks open in the composer for you to review and send. Your normal permission
                  settings still apply. Agent profiles are saved on this device.
                </p>
              </>
            ) : null}

            {section === "appearance" ? (
              <AvatarLab
                value={draft.avatar}
                onChange={(avatar) => {
                  setAvatarCustomized(true);
                  setDraft((current) => ({ ...current, avatar }));
                }}
              />
            ) : null}
          </div>
        </DialogPanel>

        <DialogFooter className="gap-2 px-7 pb-7 sm:px-8">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            {bot ? "Save agent" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
