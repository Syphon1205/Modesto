import type { ReviewFinding } from "@modesto/contracts";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { FINDING_GROUP_CLASS, type FindingGroup } from "./reviewPresentation";

export interface GroupedReviewFindings {
  readonly group: FindingGroup;
  readonly findings: ReadonlyArray<ReviewFinding>;
}

export function ReviewFindingGroups({
  groups,
  summary,
  selectedFindingId,
  onApplyFix,
  onAsk,
  onDismiss,
  onOpen,
}: {
  readonly groups: ReadonlyArray<GroupedReviewFindings>;
  readonly summary: string | null;
  readonly selectedFindingId: string | null;
  readonly onApplyFix: (finding: ReviewFinding) => void;
  readonly onAsk: (finding: ReviewFinding) => void;
  readonly onDismiss: (finding: ReviewFinding) => void;
  readonly onOpen: (finding: ReviewFinding) => void;
}) {
  return (
    <div className="space-y-4 p-3">
      {summary ? <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p> : null}
      {groups.map(({ group, findings }) => (
        <section key={group} aria-label={`${group} findings`}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className={cn("text-[11px] font-semibold", FINDING_GROUP_CLASS[group])}>
              {group}
            </span>
            <span className="text-[10px] text-muted-foreground">{findings.length}</span>
          </div>
          <div className="space-y-1.5">
            {findings.map((finding) => {
              const location = finding.startLine
                ? `${finding.file}:${finding.startLine}`
                : finding.file;
              return (
                <article
                  key={finding.id}
                  className={cn(
                    "group relative overflow-hidden rounded-md bg-muted/25 px-3 py-2.5 hover:bg-muted/45",
                    selectedFindingId === finding.id &&
                      "bg-muted/45 ring-1 ring-[var(--color-border-accent)]",
                  )}
                  onClick={() => onOpen(finding)}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 opacity-75",
                      group === "Critical" && "bg-red-500",
                      group === "Warning" && "bg-orange-500",
                      group === "Suggestion" && "bg-amber-500",
                      group === "Informational" && "bg-blue-500",
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h4 className="min-w-0 text-xs font-semibold text-foreground">
                      {finding.title}
                    </h4>
                    <button
                      type="button"
                      className="max-w-[45%] shrink-0 truncate text-[10px] text-muted-foreground hover:text-foreground"
                      title={location}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(finding);
                      }}
                    >
                      {location}
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {finding.explanation}
                  </p>
                  {finding.suggestedFix ? (
                    <div className="mt-2 overflow-hidden rounded border border-border/45 bg-background/55">
                      <div className="border-b border-border/40 px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        Suggested fix
                      </div>
                      <pre className="max-h-32 overflow-auto p-2 text-[11px] leading-relaxed text-foreground">
                        <code>{finding.suggestedFix}</code>
                      </pre>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      size="xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onApplyFix(finding);
                      }}
                    >
                      Apply Fix
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(finding);
                      }}
                    >
                      Open Location
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDismiss(finding);
                      }}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAsk(finding);
                      }}
                    >
                      Ask Modesto
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
