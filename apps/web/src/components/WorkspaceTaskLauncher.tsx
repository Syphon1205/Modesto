import { useState } from "react";
import type { ModelSelection } from "@modesto/contracts";

import { Button } from "~/components/ui/button";
import { type LucideIcon } from "~/lib/icons";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useCoworkThreadStore } from "~/coworkThreadStore";
import { useHandleNewChat } from "~/hooks/useHandleNewChat";
import { AutomationModelPicker, defaultModelSelection } from "~/routes/-automations.shared";

export interface WorkspaceQuickStart {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly prompt: string;
}

interface WorkspaceTaskLauncherProps {
  readonly kind: "research";
  readonly eyebrowIcon: LucideIcon;
  readonly eyebrowLabel: string;
  readonly heading: string;
  readonly description: string;
  readonly placeholder: string;
  readonly startLabel: string;
  readonly quickStarts: readonly WorkspaceQuickStart[];
  readonly tone?: "violet" | "blue";
}

/** Shared "hand off a task" composer used by both the Teams and Research landings —
 * lets the user pick a model up front (same picker the Kanban task composer and
 * Automations use), then seeds a fresh chat draft with that model and the typed
 * or quick-started prompt. No permission/runtime-mode control here on purpose:
 * cowork-style tasks stay in the default approval-required mode. */
export function WorkspaceTaskLauncher({
  kind,
  eyebrowIcon: EyebrowIcon,
  eyebrowLabel,
  heading,
  description,
  placeholder,
  startLabel,
  quickStarts,
  tone = "violet",
}: WorkspaceTaskLauncherProps) {
  const [prompt, setPrompt] = useState("");
  const [starting, setStarting] = useState(false);
  const [modelSelection, setModelSelection] = useState<ModelSelection>(defaultModelSelection);
  const { handleNewChat } = useHandleNewChat();

  const startTask = async (task = prompt) => {
    const normalized = task.trim();
    if (starting) return;
    setStarting(true);
    try {
      const result = await handleNewChat({
        fresh: true,
        surface: kind,
        onThreadReady: (threadId) =>
          useCoworkThreadStore.getState().markCoworkThread(threadId, kind),
      });
      if (result.ok && result.threadId) {
        useComposerDraftStore
          .getState()
          .setModelSelectionAndSticky(result.threadId, modelSelection);
        if (normalized) {
          useComposerDraftStore.getState().setPrompt(result.threadId, normalized);
        }
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-12">
      <div className="relative overflow-hidden rounded-[28px] border border-border/55 bg-card/30 px-5 py-6 shadow-[0_18px_60px_-45px_color-mix(in_srgb,var(--color-foreground)_32%,transparent)] sm:px-8 sm:py-8">
        <div
          className={`pointer-events-none absolute -right-24 -top-28 size-72 rounded-full blur-3xl ${
            tone === "blue" ? "bg-blue-500/10" : "bg-violet-500/10"
          }`}
        />
        <div className="relative">
          <div
            className={`mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
              tone === "blue" ? "text-blue-400" : "text-violet-400"
            }`}
          >
            <span className="flex size-7 items-center justify-center rounded-lg border border-current/20 bg-current/[0.07]">
              <EyebrowIcon className="size-3.5" />
            </span>
            {eyebrowLabel}
          </div>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-[2.15rem]">
            {heading}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>

          <div className="mt-7 rounded-2xl border border-border/70 bg-background/65 p-3 shadow-sm backdrop-blur-sm focus-within:border-foreground/20 focus-within:shadow-md">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void startTask();
                }
              }}
              placeholder={placeholder}
              className="min-h-28 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 outline-none placeholder:text-muted-foreground/45"
            />
            <div className="flex items-center justify-between gap-2 border-t border-border/55 px-1 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <AutomationModelPicker
                  value={modelSelection}
                  projectCwd={null}
                  onChange={setModelSelection}
                />
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  ⌘↵ to start
                </span>
              </div>
              <Button
                size="sm"
                disabled={starting || !prompt.trim()}
                onClick={() => void startTask()}
              >
                {starting ? "Starting…" : startLabel}
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {quickStarts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setPrompt(item.prompt)}
                className="group flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left text-xs font-medium text-muted-foreground transition-all hover:border-border/60 hover:bg-background/50 hover:text-foreground"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] transition-colors group-hover:bg-foreground/[0.08]">
                  <item.icon className="size-3.5" />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
