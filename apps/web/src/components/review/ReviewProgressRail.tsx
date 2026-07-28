import { cn } from "~/lib/utils";

export type ReviewProgressStage =
  | "preparing_context"
  | "analyzing_changes"
  | "checking_issues"
  | "review_complete";

const REVIEW_STEPS: ReadonlyArray<{
  readonly stage: ReviewProgressStage;
  readonly label: string;
}> = [
  { stage: "preparing_context", label: "Context" },
  { stage: "analyzing_changes", label: "Analyze" },
  { stage: "checking_issues", label: "Check" },
  { stage: "review_complete", label: "Complete" },
];

export function ReviewProgressRail({
  stage,
  message,
}: {
  readonly stage: ReviewProgressStage;
  readonly message: string;
}) {
  const activeIndex = REVIEW_STEPS.findIndex((step) => step.stage === stage);

  return (
    <div
      className="flex min-h-8 shrink-0 items-center gap-3 border-t border-border/45 px-3"
      aria-label={`Review progress: ${message}`}
    >
      <ol className="flex min-w-0 flex-1 items-center" aria-hidden="true">
        {REVIEW_STEPS.map((step, index) => {
          const complete = index < activeIndex || stage === "review_complete";
          const active = index === activeIndex && stage !== "review_complete";
          return (
            <li key={step.stage} className="flex min-w-0 flex-1 items-center last:flex-none">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full bg-border",
                  complete && "bg-[var(--color-text-accent)]",
                  active &&
                    "bg-[var(--color-text-accent)] ring-2 ring-[var(--color-text-accent)]/20",
                )}
              />
              <span
                className={cn(
                  "ml-1.5 truncate text-[10px] text-muted-foreground",
                  (complete || active) && "text-foreground",
                )}
              >
                {step.label}
              </span>
              {index < REVIEW_STEPS.length - 1 ? (
                <span
                  className={cn(
                    "mx-2 h-px min-w-3 flex-1 bg-border/70",
                    index < activeIndex && "bg-[var(--color-text-accent)]/55",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <span className="max-w-[40%] truncate text-[10px] text-muted-foreground">{message}</span>
    </div>
  );
}
