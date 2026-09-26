import type { ProviderInteractionMode, RuntimeMode } from "@modesto/contracts";
import { useState } from "react";
import { ShieldAlertIcon } from "lucide-react";
import { ComposerControl } from "./ComposerControl";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";

/** Copilot's interaction menu, backed by the provider's real execution modes. */
export function CopilotModeMenu({
  interactionMode,
  runtimeMode,
  supportsPlan,
  onInteractionModeChange,
  onRuntimeModeChange,
}: {
  interactionMode: ProviderInteractionMode;
  runtimeMode: RuntimeMode;
  supportsPlan: boolean;
  onInteractionModeChange: (mode: ProviderInteractionMode) => void;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const [confirmAutopilot, setConfirmAutopilot] = useState(false);
  const mode =
    interactionMode === "plan"
      ? "plan"
      : runtimeMode === "full-access"
        ? "autopilot"
        : "interactive";
  const label = mode === "plan" ? "Plan" : mode === "autopilot" ? "Autopilot" : "Interactive";
  const applyMode = (value: string) => {
    onInteractionModeChange(value === "plan" ? "plan" : "default");
    if (value !== "plan") {
      onRuntimeModeChange(value === "autopilot" ? "full-access" : "approval-required");
    }
  };
  return (
    <>
      <Menu>
        <MenuTrigger render={<ComposerControl aria-label={`Mode: ${label}`} />}>
          {label}
        </MenuTrigger>
        <MenuPopup align="start" side="top" className="w-72">
          <div className="px-3 py-2 text-xs text-muted-foreground">Mode</div>
          <MenuRadioGroup
            value={mode}
            onValueChange={(value) => {
              if (value === "autopilot" && mode !== "autopilot") {
                setConfirmAutopilot(true);
                return;
              }
              applyMode(value);
            }}
          >
            <MenuRadioItem value="interactive" closeOnClick>
              <span>
                Interactive
                <span className="block text-xs text-muted-foreground">
                  Step-by-step collaboration
                </span>
              </span>
            </MenuRadioItem>
            <MenuRadioItem value="plan" disabled={!supportsPlan} closeOnClick>
              <span>
                Plan
                <span className="block text-xs text-muted-foreground">
                  Plan first, execute when ready
                </span>
              </span>
            </MenuRadioItem>
            <MenuRadioItem value="autopilot" closeOnClick>
              <span>
                Autopilot
                <span className="block text-xs text-muted-foreground">
                  Allow commands and edits without prompts
                </span>
              </span>
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      <AlertDialog open={confirmAutopilot} onOpenChange={setConfirmAutopilot}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-warning/10 text-warning-foreground">
              <ShieldAlertIcon className="size-4" />
            </div>
            <AlertDialogTitle>Turn on Autopilot?</AlertDialogTitle>
            <AlertDialogDescription>
              Autopilot lets the agent run commands and edit files without asking first. Review the
              selected project and environment before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button
              onClick={() => {
                setConfirmAutopilot(false);
                applyMode("autopilot");
              }}
            >
              Enable Autopilot
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
