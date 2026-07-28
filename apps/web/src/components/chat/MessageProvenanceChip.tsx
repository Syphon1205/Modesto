// FILE: MessageProvenanceChip.tsx
// Purpose: Minimal provenance/source chip for transcript messages.
// Layer: Chat presentation
// Exports: MessageProvenanceChip

import { memo } from "react";
import type { ContextProvenance, OrchestrationMessageSource } from "@modesto/contracts";
import { cn } from "~/lib/utils";

function resolveProvenanceChipLabel(input: {
  readonly source?: OrchestrationMessageSource;
  readonly provenance?: ContextProvenance | null;
}): string | null {
  if (input.provenance?.label?.trim()) {
    return input.provenance.label.trim();
  }
  if (input.source === "handoff-import") {
    return "Handoff import";
  }
  if (input.source === "fork-import") {
    return "Fork import";
  }
  if (input.provenance) {
    switch (input.provenance.sourceKind) {
      case "repository-file":
        return input.provenance.path ?? "Repo file";
      case "working-tree":
        return "Working tree";
      case "git-history":
        return "Git history";
      case "imported-conversation":
        return "Imported conversation";
      case "modesto-summary":
        return "Modesto summary";
      case "acp-session":
        return "ACP session";
      case "user-instruction":
        return "User instruction";
      default:
        return "Context";
    }
  }
  return null;
}

export const MessageProvenanceChip = memo(function MessageProvenanceChip({
  source,
  provenance,
  className,
}: {
  source?: OrchestrationMessageSource | undefined;
  provenance?: ContextProvenance | null | undefined;
  className?: string;
}) {
  const label = resolveProvenanceChipLabel({
    ...(source !== undefined ? { source } : {}),
    ...(provenance !== undefined ? { provenance } : {}),
  });
  if (!label) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border border-border/60 bg-muted/35 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
});
