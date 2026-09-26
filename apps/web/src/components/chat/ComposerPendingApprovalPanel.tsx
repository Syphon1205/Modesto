import { memo } from "react";
import { type PendingApproval } from "../../session-logic";
import { cn } from "~/lib/utils";
import { ShieldAlertIcon } from "lucide-react";

interface ComposerPendingApprovalPanelProps {
  approval: PendingApproval;
  pendingCount: number;
  className?: string;
}

export const ComposerPendingApprovalPanel = memo(function ComposerPendingApprovalPanel({
  approval,
  pendingCount,
  className,
}: ComposerPendingApprovalPanelProps) {
  const fallbackLabel =
    approval.requestKind === "command"
      ? "Command approval"
      : approval.requestKind === "file-read"
        ? "File read approval"
        : "File change approval";
  const detailAriaLabel =
    approval.requestKind === "command"
      ? "Command"
      : approval.requestKind === "file-read"
        ? "File to read"
        : "File change";

  return (
    <div
      aria-label={fallbackLabel}
      className={cn("flex min-w-0 flex-1 items-start gap-3", className)}
      role="group"
    >
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning-foreground ring-1 ring-warning/15">
        <ShieldAlertIcon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {fallbackLabel}
          </span>
          {pendingCount > 1 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground tabular-nums">
              1 of {pendingCount}
            </span>
          ) : null}
        </div>
        <code
          aria-label={detailAriaLabel}
          className="block max-h-24 min-w-0 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-foreground/90 [scrollbar-width:thin] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 [&::-webkit-scrollbar]:h-1.5"
          data-approval-detail="complete"
          tabIndex={0}
        >
          {approval.detail || fallbackLabel}
        </code>
      </div>
    </div>
  );
});
