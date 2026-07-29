// FILE: ThreadErrorBanner.tsx
// Purpose: Shows dismissible thread-level runtime errors above the transcript.
// Layer: Chat status presentation
// Exports: ThreadErrorBanner

import { memo } from "react";
import { Alert, AlertAction, AlertDescription } from "../ui/alert";
import { IconButton } from "../ui/icon-button";
import { CircleAlertIcon, XIcon } from "~/lib/icons";
import { ChatColumnBannerFrame } from "./ChatColumnBannerFrame";
import { Button } from "../ui/button";

const PROVIDER_ERROR_PATTERN =
  /^Provider adapter (?:request failed|process error) \(([^)]+)\)(?: for [^:]+)?:\s*(.+)$/i;
const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  codex: "Codex",
  claudeAgent: "Claude",
  cursor: "Cursor",
  poolside: "Poolside",
  opencode: "OpenCode",
  gemini: "Gemini",
  grok: "Grok",
  droid: "Droid",
  kilo: "Kilo",
  pi: "Pi",
};

export function formatThreadErrorMessage(error: string): string {
  const match = PROVIDER_ERROR_PATTERN.exec(error.trim());
  if (!match) return error;
  const provider = PROVIDER_LABELS[match[1] ?? ""] ?? match[1] ?? "Provider";
  return `${provider} could not continue: ${match[2] ?? "The provider session failed."}`;
}

export const ThreadErrorBanner = memo(function ThreadErrorBanner({
  error,
  onDismiss,
  onRecover,
}: {
  error: string | null;
  onDismiss?: () => void;
  onRecover?: () => void;
}) {
  if (!error) return null;
  const message = formatThreadErrorMessage(error);
  return (
    <ChatColumnBannerFrame>
      <Alert variant="error">
        <CircleAlertIcon />
        <AlertDescription className="line-clamp-3" title={message}>
          {message}
        </AlertDescription>
        {(onRecover || onDismiss) && (
          <AlertAction>
            {onRecover ? (
              <Button type="button" size="sm" variant="outline" onClick={onRecover}>
                Recover session
              </Button>
            ) : null}
            {onDismiss ? (
              <IconButton
                label="Dismiss error"
                className="size-6 text-destructive/60 hover:text-destructive sm:size-6"
                onClick={onDismiss}
              >
                <XIcon className="size-3.5" />
              </IconButton>
            ) : null}
          </AlertAction>
        )}
      </Alert>
    </ChatColumnBannerFrame>
  );
});
