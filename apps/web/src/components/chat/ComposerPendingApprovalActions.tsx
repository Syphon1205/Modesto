import { type ApprovalRequestId, type ProviderApprovalDecision } from "@modesto/contracts";
import { memo } from "react";
import { Button } from "../ui/button";

interface ComposerPendingApprovalActionsProps {
  requestId: ApprovalRequestId;
  isResponding: boolean;
  allowApproval?: boolean;
  onRespondToApproval: (
    requestId: ApprovalRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<unknown>;
}

const APPROVAL_ACTION_CLASS_NAME = "h-7 rounded-md px-2.5 text-xs font-medium";

export const ComposerPendingApprovalActions = memo(function ComposerPendingApprovalActions({
  requestId,
  isResponding,
  allowApproval = true,
  onRespondToApproval,
}: ComposerPendingApprovalActionsProps) {
  return (
    <>
      <Button
        size="xs"
        variant="ghost-muted"
        className={APPROVAL_ACTION_CLASS_NAME}
        disabled={isResponding}
        onClick={() => void onRespondToApproval(requestId, "cancel")}
      >
        Cancel
      </Button>
      <Button
        size="xs"
        variant="ghost-muted"
        className={`${APPROVAL_ACTION_CLASS_NAME} text-destructive-foreground hover:bg-destructive/8 [:hover,[data-pressed]]:text-destructive-foreground`}
        disabled={isResponding}
        onClick={() => void onRespondToApproval(requestId, "decline")}
      >
        Decline
      </Button>
      {allowApproval ? (
        <>
          <Button
            size="xs"
            variant="outline"
            className={APPROVAL_ACTION_CLASS_NAME}
            disabled={isResponding}
            onClick={() => void onRespondToApproval(requestId, "acceptForSession")}
          >
            Always allow this session
          </Button>
          <Button
            size="xs"
            variant="default"
            className={`${APPROVAL_ACTION_CLASS_NAME} min-w-20`}
            disabled={isResponding}
            onClick={() => void onRespondToApproval(requestId, "accept")}
          >
            Approve
          </Button>
        </>
      ) : null}
    </>
  );
});
