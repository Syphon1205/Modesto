// FILE: ComposerInteractionModeControl.tsx
// Purpose: Cursor/Codex-style Agent | Plan mode picker for the composer footer.
// Layer: Chat composer UI
// Exports: ComposerInteractionModeControl

import { type ProviderInteractionMode } from "@modesto/contracts";
import { memo } from "react";

import { BotIcon, ChevronDownIcon, ListChecksIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuShortcut,
  MenuTrigger,
} from "../ui/menu";
import { COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME } from "./composerPickerStyles";
import { ComposerPickerMenuPopup } from "./ComposerPickerMenuPopup";

const MODE_LABEL: Record<ProviderInteractionMode, string> = {
  default: "Agent",
  plan: "Plan",
};

export const ComposerInteractionModeControl = memo(function ComposerInteractionModeControl(props: {
  interactionMode: ProviderInteractionMode;
  onInteractionModeChange: (mode: ProviderInteractionMode) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const label = MODE_LABEL[props.interactionMode];
  const isPlan = props.interactionMode === "plan";

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="chrome"
            disabled={props.disabled}
            className={cn(
              "min-w-0 shrink-0 justify-start gap-1.5 whitespace-nowrap px-2 sm:px-2.5 [&_svg]:mx-0",
              COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME,
              isPlan && "text-[var(--color-text-foreground)]",
            )}
            type="button"
            aria-label={`Mode: ${label}`}
            title={
              isPlan
                ? "Plan — explore and propose a plan (no repo edits)"
                : "Agent — implement with full tool access"
            }
            data-testid="composer-interaction-mode"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {isPlan ? (
            <ListChecksIcon className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
          ) : (
            <BotIcon className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
          )}
          {props.compact ? (
            <span className="sr-only">{label}</span>
          ) : (
            <span
              className={cn(
                "sr-only truncate sm:not-sr-only",
                isPlan ? "text-[var(--color-text-foreground)]" : undefined,
              )}
            >
              {label}
            </span>
          )}
          <ChevronDownIcon aria-hidden="true" className="ms-0.5 size-3 shrink-0 opacity-60" />
        </span>
      </MenuTrigger>
      <ComposerPickerMenuPopup align="start" className="min-w-56">
        <MenuGroup>
          <MenuGroupLabel>Mode</MenuGroupLabel>
          <MenuRadioGroup
            value={props.interactionMode}
            onValueChange={(value) => {
              if (value !== "default" && value !== "plan") return;
              if (value === props.interactionMode) return;
              props.onInteractionModeChange(value);
            }}
          >
            <MenuRadioItem
              value="default"
              preserveChildLayout
              trailing={<MenuShortcut>⇧⇥</MenuShortcut>}
              className="py-2"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <BotIcon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  <span>Agent</span>
                </span>
                <span className="pl-[1.375rem] text-[11px] font-normal text-muted-foreground">
                  Build and edit with full tools
                </span>
              </span>
            </MenuRadioItem>
            <MenuRadioItem
              value="plan"
              preserveChildLayout
              trailing={<MenuShortcut>⇧⇥</MenuShortcut>}
              className="py-2"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <ListChecksIcon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  <span>Plan</span>
                </span>
                <span className="pl-[1.375rem] text-[11px] font-normal text-muted-foreground">
                  Design the approach before coding
                </span>
              </span>
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>
      </ComposerPickerMenuPopup>
    </Menu>
  );
});
