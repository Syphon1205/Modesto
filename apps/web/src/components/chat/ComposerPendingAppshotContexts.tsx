import { Camera, X } from "lucide-react";

import {
  COMPOSER_INLINE_CHIP_CLASS_NAME,
  COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME,
} from "../composerInlineChip";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";
import { type AppshotContextDraft, formatAppshotContextLabel } from "~/lib/appshotContext";

interface ComposerPendingAppshotContextsProps {
  contexts: ReadonlyArray<AppshotContextDraft>;
  onRemove: (contextId: string) => void;
  className?: string;
}

interface ComposerPendingAppshotContextChipProps {
  context: AppshotContextDraft;
  onRemove: (contextId: string) => void;
}

function buildTooltipContent(context: AppshotContextDraft): string {
  const lines: string[] = [formatAppshotContextLabel(context)];
  if (context.accessibilityText.trim().length > 0) {
    lines.push("");
    lines.push(context.accessibilityText.trim().slice(0, 600));
  }
  return lines.join("\n");
}

export function ComposerPendingAppshotContextChip({
  context,
  onRemove,
}: ComposerPendingAppshotContextChipProps) {
  const label = formatAppshotContextLabel(context);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={cn(COMPOSER_INLINE_CHIP_CLASS_NAME, "pr-1")}>
            <Camera className={cn(COMPOSER_INLINE_CHIP_ICON_CLASS_NAME, "size-3.5")} />
            <span className={COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME}>{label}</span>
            <button
              type="button"
              aria-label={`Remove ${label}`}
              className={COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemove(context.id);
              }}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        }
      />
      <TooltipPopup side="top" className="max-w-96 whitespace-pre-wrap leading-tight">
        {buildTooltipContent(context)}
      </TooltipPopup>
    </Tooltip>
  );
}

export function ComposerPendingAppshotContexts(props: ComposerPendingAppshotContextsProps) {
  if (props.contexts.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", props.className)}>
      {props.contexts.map((context) => (
        <ComposerPendingAppshotContextChip
          key={context.id}
          context={context}
          onRemove={props.onRemove}
        />
      ))}
    </div>
  );
}
