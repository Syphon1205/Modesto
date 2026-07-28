// FILE: ComposerMultiAgentControl.tsx
// Purpose: Opens the Codex/Cursor-style @agent(task) picker from the composer footer.
// Layer: Chat composer UI
// Exports: ComposerMultiAgentControl

import { memo } from "react";

import { UsersIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME } from "./composerPickerStyles";

export const ComposerMultiAgentControl = memo(function ComposerMultiAgentControl(props: {
  active?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="chrome"
      className={cn(
        "min-w-0 shrink-0 justify-start gap-1.5 whitespace-nowrap px-2 sm:px-2.5 [&_svg]:mx-0",
        COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME,
        props.active && "text-[var(--color-text-foreground)]",
      )}
      type="button"
      disabled={props.disabled}
      onClick={props.onOpen}
      aria-label="Agents"
      aria-pressed={props.active || undefined}
      title="Add @agent(task) — delegate like Codex / Cursor"
      data-testid="composer-multi-agent"
    >
      <UsersIcon className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
      {props.compact ? (
        <span className="sr-only">Agents</span>
      ) : (
        <span className="sr-only sm:not-sr-only">Agents</span>
      )}
    </Button>
  );
});
