// FILE: ComposerAttachButton.tsx
// Purpose: Composer paperclip control next to the microphone. Opens a file
//          picker for images, PDFs, spreadsheets, design sources, and other
//          documents. The accept list is derived from the send-turn contracts
//          so Figma/Framer/Adobe files stay pickable and persistable.
// Layer: Chat composer presentation

import { memo, useRef } from "react";
import { PaperclipIcon } from "lucide-react";
import { providerSendTurnComposerAcceptAttribute } from "@modesto/contracts";

import { cn } from "~/lib/utils";

const COMPOSER_ATTACHMENT_ACCEPT = providerSendTurnComposerAcceptAttribute();

export const ComposerAttachButton = memo(function ComposerAttachButton({
  disabled,
  onPickFiles,
}: {
  readonly disabled?: boolean;
  readonly onPickFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = "Attach files";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={COMPOSER_ATTACHMENT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) {
            onPickFiles(files);
          }
        }}
      />
      <button
        type="button"
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary-label transition-all duration-150 enabled:cursor-pointer hover:bg-sidebar-row-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30 sm:h-8 sm:w-8",
        )}
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        <PaperclipIcon className="size-4" aria-hidden="true" />
      </button>
    </>
  );
});
