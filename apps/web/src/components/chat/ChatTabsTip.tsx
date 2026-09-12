// FILE: ChatTabsTip.tsx
// Purpose: The one-time offer to turn on the chat tab strip.
// Layer: Chat UI
//
// Tabs are opt-in (`chatTabsEnabled`, default off) because the strip mirrors
// navigation: with it always on, every sidebar click, palette jump, and
// restored route opened another tab, so tabs accumulated without anyone
// asking for them. Opt-in fixes that but hides the feature entirely, which is
// what this row is for - it appears exactly where the strip would, so the
// offer is made in the place the thing itself would occupy.
//
// Dismissal is persisted (`chatTabsTipDismissed`), not session-scoped: a tip
// that returns every launch is nagging rather than discovery. Enabling tabs
// also dismisses it, so it never reappears after being acted on.

import { XIcon } from "lucide-react";
import { memo } from "react";

import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface ChatTabsTipProps {
  /** Turns tabs on and dismisses the tip in one settings write. */
  readonly onEnable: () => void;
  /** Dismisses without enabling; tabs stay off. */
  readonly onDismiss: () => void;
  /** Rendered next to the action when a keybinding is bound to `tab.new`. */
  readonly shortcutLabel?: string | undefined;
}

export const ChatTabsTip = memo(function ChatTabsTip({
  onEnable,
  onDismiss,
  shortcutLabel,
}: ChatTabsTipProps) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/60 px-3 text-[12.5px] text-muted-foreground">
      <span className="min-w-0 truncate">
        Keep several threads open at once — enable tabs for easier switching.
      </span>
      <Button variant="ghost" size="xs" className="h-6 px-2 text-[12.5px]" onClick={onEnable}>
        Enable tabs
        {shortcutLabel ? (
          <span className="ml-1.5 text-muted-foreground/70">{shortcutLabel}</span>
        ) : null}
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              aria-label="Dismiss tabs tip"
              onClick={onDismiss}
            />
          }
        >
          <XIcon />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Don't show this again</TooltipPopup>
      </Tooltip>
    </div>
  );
});
