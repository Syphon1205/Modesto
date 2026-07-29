import { memo, type ReactNode } from "react";
import { EllipsisIcon, ListTodoIcon } from "~/lib/icons";
import { Button } from "../ui/button";
import { ComposerPickerMenuPopup } from "./ComposerPickerMenuPopup";
import { Menu, MenuItem, MenuSeparator as MenuDivider, MenuTrigger } from "../ui/menu";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  activePlan: boolean;
  planSidebarOpen: boolean;
  traitsMenuContent?: ReactNode;
  onTogglePlanSidebar: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="chrome"
            className="shrink-0 px-2"
            aria-label="More composer controls"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </MenuTrigger>
      <ComposerPickerMenuPopup align="start">
        {props.traitsMenuContent}
        {props.activePlan ? (
          <>
            {props.traitsMenuContent ? <MenuDivider /> : null}
            <MenuItem onClick={props.onTogglePlanSidebar}>
              <ListTodoIcon className="size-4 shrink-0" />
              {props.planSidebarOpen ? "Hide plan sidebar" : "Show plan sidebar"}
            </MenuItem>
          </>
        ) : null}
      </ComposerPickerMenuPopup>
    </Menu>
  );
});
