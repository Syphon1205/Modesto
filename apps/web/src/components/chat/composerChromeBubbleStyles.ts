// FILE: composerChromeBubbleStyles.ts
// Purpose: Shared Cursor-style pill/bubble chrome for the row above the composer.
// Layer: Chat composer styling
// Exports: trigger class tokens for Changes / Working / Plan / task / git bubbles

import { COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME } from "./composerPickerStyles";

/** Compact bordered pill used for status + action bubbles above the composer. */
export const COMPOSER_CHROME_BUBBLE_CLASS_NAME = [
  "inline-flex h-7 max-w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-full",
  "border border-[color:var(--color-border-light)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)]",
  "px-2.5 transition-colors",
  "hover:bg-[var(--color-background-button-secondary-hover)]",
  "disabled:cursor-default disabled:opacity-55",
  COMPOSER_PICKER_TRIGGER_TEXT_CLASS_NAME,
].join(" ");

/** Active / pressed state for toggle bubbles when a chrome control needs it. */
export const COMPOSER_CHROME_BUBBLE_ACTIVE_CLASS_NAME =
  "border-[color:color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-[var(--color-text-foreground)]";

export const COMPOSER_CHROME_BUBBLE_ICON_CLASS_NAME = "size-3.5 shrink-0 opacity-70";

export const COMPOSER_CHROME_BUBBLES_ROW_CLASS_NAME =
  "flex flex-wrap items-center gap-1.5 px-0.5 pb-2";
