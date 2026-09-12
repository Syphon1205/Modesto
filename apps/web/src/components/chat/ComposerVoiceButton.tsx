// FILE: ComposerVoiceButton.tsx
// Purpose: The composer mic control - press to start system dictation, press
//          again to stop and insert the transcript into the prompt.
// Layer: Chat composer presentation

import { memo } from "react";
import { MicIcon, SquareIcon } from "lucide-react";

import { cn } from "~/lib/utils";

export const ComposerVoiceButton = memo(function ComposerVoiceButton({
  disabled,
  isRecording,
  durationLabel,
  onClick,
}: {
  readonly disabled?: boolean;
  readonly isRecording: boolean;
  /** Elapsed dictation time, e.g. "0:07"; shown only while listening. */
  readonly durationLabel: string;
  readonly onClick: () => void;
}) {
  const label = isRecording ? `Stop dictation (${durationLabel})` : "Dictate with system speech";

  return (
    <button
      // Never "submit": this button lives inside the composer form, and a
      // default-type button would send the message instead of recording.
      type="button"
      className={cn(
        "relative flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full transition-all duration-150 enabled:cursor-pointer disabled:pointer-events-none disabled:opacity-30 sm:h-8",
        isRecording
          ? "w-auto bg-error/15 px-2.5 text-error hover:bg-error/20"
          : "w-9 text-secondary-label hover:bg-sidebar-row-hover hover:text-foreground sm:w-8",
      )}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={isRecording}
      onClick={onClick}
    >
      {isRecording ? (
        <>
          <SquareIcon className="size-3 fill-current" aria-hidden="true" />
          <span className="text-[11px] font-medium tabular-nums">{durationLabel}</span>
        </>
      ) : (
        <MicIcon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
});
