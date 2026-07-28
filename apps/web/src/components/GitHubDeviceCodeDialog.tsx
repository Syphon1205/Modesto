import { CheckIcon, GitHubIcon } from "~/lib/icons";
import { copyTextToClipboard } from "~/hooks/useCopyToClipboard";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";

export function GitHubDeviceCodeDialog(props: {
  readonly open: boolean;
  readonly userCode: string | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup className="max-w-sm gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="items-center border-b border-border/60 px-6 pb-4 pt-6 text-center">
          <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
            <GitHubIcon className="size-5" />
          </span>
          <DialogTitle>Sign in to GitHub</DialogTitle>
          <DialogDescription>
            Your browser is ready. Enter this one-time code to connect Modesto.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="px-6 py-5">
          {props.userCode ? (
            <button
              type="button"
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-muted/45 px-4 py-4 transition-colors hover:bg-muted/70"
              onClick={() => void copyTextToClipboard(props.userCode ?? "")}
              aria-label={`Copy GitHub device code ${props.userCode}`}
            >
              <code className="text-xl font-semibold tracking-[0.22em] text-foreground">
                {props.userCode}
              </code>
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                Copy
              </span>
            </button>
          ) : (
            <div className="rounded-xl border border-border bg-muted/45 px-4 py-4 text-center text-sm text-muted-foreground">
              Continue in the GitHub window that just opened.
            </div>
          )}
          {props.userCode ? (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <CheckIcon className="size-3.5 text-success" />
              The code was copied to your clipboard
            </p>
          ) : null}
        </DialogPanel>
        <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
          <Button className="w-full" onClick={() => props.onOpenChange(false)}>
            I&rsquo;ve entered the code
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
