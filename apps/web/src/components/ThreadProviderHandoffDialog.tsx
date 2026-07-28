import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderComposerCapabilities,
  type ThreadHandoffStep,
} from "@modesto/contracts";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { cn } from "~/lib/utils";
import { ChangesIcon, LoaderIcon } from "~/lib/icons";
import { ProviderIcon } from "./ProviderIcon";
import {
  buildHandoffSeamPresentation,
  type ThreadHandoffDraft,
} from "../lib/threadHandoff";
import {
  providerComposerCapabilitiesQueryOptions,
  supportsSkillDiscovery,
  supportsThreadCompaction,
  supportsThreadImport,
} from "../lib/providerDiscoveryReactQuery";

interface ThreadProviderHandoffDialogProps {
  open: boolean;
  draft: ThreadHandoffDraft | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: ThreadHandoffDraft) => void;
  onConfirm: () => Promise<void> | void;
}

function formatStepStatus(status: ThreadHandoffStep["status"]): string {
  switch (status) {
    case "doing":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
    default:
      return "Todo";
  }
}

function formatCapabilityHints(
  capabilities: ProviderComposerCapabilities | undefined,
): ReadonlyArray<string> {
  const hints: string[] = [];
  if (supportsSkillDiscovery(capabilities)) hints.push("skills");
  if (supportsThreadCompaction(capabilities)) hints.push("compaction");
  if (supportsThreadImport(capabilities)) hints.push("thread import");
  return hints;
}

export function ThreadProviderHandoffDialog({
  open,
  draft,
  busy = false,
  onOpenChange,
  onDraftChange,
  onConfirm,
}: ThreadProviderHandoffDialogProps) {
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const targetProvider = draft?.targetProvider ?? null;
  const capabilitiesQuery = useQuery({
    ...providerComposerCapabilitiesQueryOptions(targetProvider ?? "codex"),
    enabled: open && targetProvider !== null,
  });
  const capabilityHints = formatCapabilityHints(capabilitiesQuery.data);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      summaryRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const sourceProvider = draft?.sourceThread.modelSelection.provider ?? null;
  const sourceLabel = sourceProvider ? PROVIDER_DISPLAY_NAMES[sourceProvider] : null;
  const targetLabel = draft ? PROVIDER_DISPLAY_NAMES[draft.targetProvider] : null;
  const canSubmit =
    !busy &&
    draft !== null &&
    draft.summary.trim().length > 0 &&
    draft.objective.trim().length > 0 &&
    !draft.repoSnapshotLoading;

  const seamPreview = useMemo(() => {
    if (!draft || !sourceProvider) return null;
    return buildHandoffSeamPresentation({
      handoff: {
        sourceProvider,
        summary: draft.summary,
        objective: draft.objective,
        unfinishedSteps: draft.unfinishedSteps,
        repoSnapshot: draft.repoSnapshot,
      },
      targetProvider: draft.targetProvider,
    });
  }, [draft, sourceProvider]);

  const repoPreview = useMemo(() => {
    if (!draft?.repoSnapshot) {
      return null;
    }
    const snapshot = draft.repoSnapshot;
    const changedCount = snapshot.changedFiles.length;
    return {
      branch: snapshot.branch ?? "Detached",
      dirty: snapshot.hasWorkingTreeChanges,
      changedCount,
      files: snapshot.changedFiles.slice(0, 6),
      hiddenCount: Math.max(0, changedCount - 6),
    };
  }, [draft?.repoSnapshot]);

  const handleSubmit = () => {
    if (canSubmit) {
      void onConfirm();
    }
  };

  const updateStepText = (stepId: string, text: string) => {
    if (!draft) return;
    onDraftChange({
      ...draft,
      unfinishedSteps: draft.unfinishedSteps.map((step) =>
        step.id === stepId ? { ...step, text } : step,
      ),
    });
  };

  const removeStep = (stepId: string) => {
    if (!draft) return;
    onDraftChange({
      ...draft,
      unfinishedSteps: draft.unfinishedSteps.filter((step) => step.id !== stepId),
    });
  };

  const addStep = () => {
    if (!draft) return;
    const nextIndex = draft.unfinishedSteps.length;
    onDraftChange({
      ...draft,
      unfinishedSteps: [
        ...draft.unfinishedSteps,
        {
          id: `custom:${Date.now()}:${nextIndex}`,
          text: "",
          status: "todo",
        },
      ],
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            {draft && sourceProvider ? (
              <>
                <ProviderIcon provider={sourceProvider} className="size-4" />
                <span className="text-muted-foreground">→</span>
                <ProviderIcon provider={draft.targetProvider} className="size-4" />
              </>
            ) : null}
            <span>Hand off to {targetLabel ?? "provider"}</span>
          </DialogTitle>
          <DialogDescription>
            Declare a handoff seam for {targetLabel ?? "the next provider"}: what landed, what is
            incomplete, and what to do next. Imported chat is context only — the note and live repo
            win when they disagree.
            {capabilityHints.length > 0 ? (
              <>
                {" "}
                {targetLabel} supports {capabilityHints.join(", ")}.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {draft ? (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              {seamPreview ? (
                <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <span>
                      {sourceLabel} → {targetLabel}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs leading-snug text-muted-foreground">
                    {seamPreview.doneLines.map((line) => (
                      <p key={`done:${line}`}>{line}</p>
                    ))}
                    {seamPreview.incompleteLines.map((line) => (
                      <p key={`incomplete:${line}`}>Incomplete: {line}</p>
                    ))}
                    {seamPreview.nextLines.map((line) => (
                      <p key={`next:${line}`}>Next: {line}</p>
                    ))}
                    {seamPreview.repoLine ? (
                      <p className="font-mono text-[11px]">{seamPreview.repoLine}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">What landed</span>
                <Textarea
                  ref={summaryRef}
                  value={draft.summary}
                  disabled={busy}
                  rows={4}
                  onChange={(event) => onDraftChange({ ...draft, summary: event.target.value })}
                  placeholder="Implemented authentication callback handling."
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">Next step</span>
                <Textarea
                  value={draft.objective}
                  disabled={busy}
                  rows={3}
                  onChange={(event) => onDraftChange({ ...draft, objective: event.target.value })}
                  placeholder="Add refresh retry handling and run auth integration tests."
                />
              </label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">Still incomplete</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={busy}
                    onClick={addStep}
                  >
                    Add
                  </Button>
                </div>
                {draft.unfinishedSteps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No open plan or pin steps detected.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {draft.unfinishedSteps.map((step) => (
                      <div key={step.id} className="flex items-start gap-2">
                        <span className="mt-2 shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {formatStepStatus(step.status)}
                        </span>
                        <Input
                          value={step.text}
                          disabled={busy}
                          onChange={(event) => updateStepText(step.id, event.target.value)}
                          placeholder="Token refresh logic is incomplete."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={busy}
                          onClick={() => removeStep(step.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  {draft.repoSnapshotLoading ? (
                    <LoaderIcon className="size-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <ChangesIcon className="size-3.5 text-muted-foreground" />
                  )}
                  <span>Repository state</span>
                </div>
                {draft.repoSnapshotLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">Capturing git status…</p>
                ) : repoPreview ? (
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground">{repoPreview.branch}</span>
                      {" · "}
                      {repoPreview.dirty ? "Dirty working tree" : "Clean working tree"}
                      {repoPreview.changedCount > 0
                        ? ` · ${repoPreview.changedCount} changed file${repoPreview.changedCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                    {repoPreview.files.length > 0 ? (
                      <ul className="grid gap-1 font-mono text-[11px]">
                        {repoPreview.files.map((file) => (
                          <li key={file.path} className="truncate">
                            {file.path}{" "}
                            <span className="text-muted-foreground/70">
                              +{file.insertions}/-{file.deletions}
                            </span>
                          </li>
                        ))}
                        {repoPreview.hiddenCount > 0 ? (
                          <li className="text-muted-foreground/70">
                            +{repoPreview.hiddenCount} more
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                    {draft.diffAckStatus === "pending" ? (
                      <p className={cn("text-warning/90")}>
                        The destination thread will ask {targetLabel} to review the live diff before
                        continuing.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Git snapshot unavailable for this workspace.
                  </p>
                )}
              </div>
            </form>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? "Handing off…" : "Create handoff seam"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
