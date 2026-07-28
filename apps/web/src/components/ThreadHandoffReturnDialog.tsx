import { useEffect, useMemo, useRef } from "react";
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
import { ChangesIcon, LoaderIcon } from "~/lib/icons";
import type { ThreadHandoffReturnDraft } from "../lib/threadHandoff";

interface ThreadHandoffReturnDialogProps {
  open: boolean;
  draft: ThreadHandoffReturnDraft | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: ThreadHandoffReturnDraft) => void;
  onConfirm: () => Promise<void> | void;
}

export function ThreadHandoffReturnDialog({
  open,
  draft,
  busy = false,
  onOpenChange,
  onDraftChange,
  onConfirm,
}: ThreadHandoffReturnDialogProps) {
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      summaryRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const canSubmit =
    !busy && draft !== null && draft.summary.trim().length > 0 && !draft.repoSnapshotLoading;

  const repoPreview = useMemo(() => {
    if (!draft?.repoSnapshot) {
      return null;
    }
    const snapshot = draft.repoSnapshot;
    return {
      branch: snapshot.branch ?? "Detached",
      dirty: snapshot.hasWorkingTreeChanges,
      changedCount: snapshot.changedFiles.length,
    };
  }, [draft?.repoSnapshot]);

  const handleSubmit = () => {
    if (canSubmit) {
      void onConfirm();
    }
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
          <DialogTitle>Return to source thread</DialogTitle>
          <DialogDescription>
            Send a return summary and fresh repo snapshot back to the original thread.
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
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">Return summary</span>
                <Textarea
                  ref={summaryRef}
                  value={draft.summary}
                  disabled={busy}
                  rows={6}
                  onChange={(event) => onDraftChange({ ...draft, summary: event.target.value })}
                  placeholder="What changed while working in the handoff thread?"
                />
              </label>
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
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="text-foreground">{repoPreview.branch}</span>
                    {" · "}
                    {repoPreview.dirty ? "Dirty working tree" : "Clean working tree"}
                    {repoPreview.changedCount > 0
                      ? ` · ${repoPreview.changedCount} changed file${repoPreview.changedCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
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
            {busy ? "Returning..." : "Return to source"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
