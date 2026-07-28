// FILE: HandoffReturnBanner.tsx
// Purpose: Surfaces a return summary on the source thread after a handoff comes back.
// Layer: Chat status presentation
// Exports: HandoffReturnBanner

import { memo } from "react";
import { PROVIDER_DISPLAY_NAMES } from "@modesto/contracts";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  EXPANDED_NOTIFICATION_SURFACE_CLASS_NAME,
  NOTIFICATION_ICON_CLASS_NAME,
} from "../ui/notificationSurface";
import { GitBranchIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { ChatColumnBannerFrame } from "./ChatColumnBannerFrame";
import { ProviderIcon } from "../ProviderIcon";
import type { Thread } from "../../types";

export const HandoffReturnBanner = memo(function HandoffReturnBanner({
  thread,
}: {
  thread: Thread | null | undefined;
  busy?: boolean;
  onOpenReturnDialog?: () => void;
}) {
  if (!thread?.handoffReturn) {
    return null;
  }

  const providerLabel = PROVIDER_DISPLAY_NAMES[thread.handoffReturn.fromProvider];
  return (
    <ChatColumnBannerFrame>
      <Alert className={cn(EXPANDED_NOTIFICATION_SURFACE_CLASS_NAME)} variant="info">
        <GitBranchIcon className={NOTIFICATION_ICON_CLASS_NAME} />
        <AlertTitle className="font-normal text-[var(--notification-fg)]">
          <span className="inline-flex items-center gap-1.5">
            <ProviderIcon provider={thread.handoffReturn.fromProvider} className="size-3.5" />
            <span>Returned from {providerLabel}</span>
          </span>
        </AlertTitle>
        <AlertDescription className="whitespace-pre-wrap text-[var(--notification-fg)]/72">
          {thread.handoffReturn.summary}
        </AlertDescription>
      </Alert>
    </ChatColumnBannerFrame>
  );
});
