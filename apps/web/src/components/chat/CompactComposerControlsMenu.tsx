import { ProviderInteractionMode, RuntimeMode } from "@modesto/contracts";
import { memo, type ReactNode } from "react";
import { EllipsisIcon, LockIcon, LockOpenIcon, PenLineIcon, SparklesIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";

// Same green-to-red risk ladder as the full runtime-mode picker in
// ChatComposer.tsx (how much the mode does without asking).
const RUNTIME_MODE_TONE: Record<RuntimeMode, string> = {
  "approval-required": "text-emerald-500 dark:text-emerald-300",
  "auto-accept-edits": "text-sky-500 dark:text-sky-300",
  auto: "text-amber-500 dark:text-amber-300",
  "full-access": "text-red-500 dark:text-red-400",
};

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  interactionMode: ProviderInteractionMode;
  runtimeMode: RuntimeMode;
  showInteractionModeToggle: boolean;
  traitsMenuContent?: ReactNode;
  onToggleInteractionMode: () => void;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 px-2 text-muted-foreground/70 hover:text-foreground/80"
            aria-label="More composer controls"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </MenuTrigger>
      <MenuPopup align="start">
        {props.traitsMenuContent ? (
          <>
            {props.traitsMenuContent}
            <MenuDivider />
          </>
        ) : null}
        {props.showInteractionModeToggle ? (
          <>
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
            <MenuRadioGroup
              value={props.interactionMode}
              onValueChange={(value) => {
                if (!value || value === props.interactionMode) return;
                props.onToggleInteractionMode();
              }}
            >
              <MenuRadioItem value="default">Chat</MenuRadioItem>
              <MenuRadioItem value="plan">Plan</MenuRadioItem>
            </MenuRadioGroup>
            <MenuDivider />
          </>
        ) : null}
        <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Access</div>
        <MenuRadioGroup
          value={props.runtimeMode}
          onValueChange={(value) => {
            if (!value || value === props.runtimeMode) return;
            props.onRuntimeModeChange(value as RuntimeMode);
          }}
        >
          <MenuRadioItem value="approval-required">
            <LockIcon className={`size-3.5 shrink-0 ${RUNTIME_MODE_TONE["approval-required"]}`} />
            Supervised
          </MenuRadioItem>
          <MenuRadioItem value="auto-accept-edits">
            <PenLineIcon
              className={`size-3.5 shrink-0 ${RUNTIME_MODE_TONE["auto-accept-edits"]}`}
            />
            Auto-accept edits
          </MenuRadioItem>
          <MenuRadioItem value="auto">
            <SparklesIcon className={`size-3.5 shrink-0 ${RUNTIME_MODE_TONE.auto}`} />
            Auto
          </MenuRadioItem>
          <MenuRadioItem value="full-access">
            <LockOpenIcon className={`size-3.5 shrink-0 ${RUNTIME_MODE_TONE["full-access"]}`} />
            Full access
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
});
