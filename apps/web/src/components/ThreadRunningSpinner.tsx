// FILE: ThreadRunningSpinner.tsx
// Purpose: Shared inline running/pulse spinner for sidebar thread status slots.
// Layer: Sidebar UI primitive
// Exports: ThreadRunningSpinner

import { FlickerLoadingIcon } from "~/components/ui/FlickerLoadingIcon";
import { TINY_SPINNER_GRIDS } from "~/lib/flickerGrids";
import { cn } from "~/lib/utils";

export function ThreadRunningSpinner({ className }: { className?: string }) {
  return (
    <FlickerLoadingIcon
      grids={TINY_SPINNER_GRIDS}
      variant="5x5"
      size={12}
      title="Running"
      className={cn("text-muted-foreground/55", className)}
    />
  );
}
