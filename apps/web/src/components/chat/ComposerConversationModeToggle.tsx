import { MessageCircleIcon, FolderIcon, ChevronDownIcon } from "lucide-react";
import { useInterfaceStyle } from "~/hooks/useSettings";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import type { ConversationMode } from "~/composerDraftStore";

import { Toggle, ToggleGroup } from "../ui/toggle-group";

export function ComposerConversationModeToggle(props: {
  readonly value: ConversationMode;
  readonly onChange: (mode: ConversationMode) => void;
}) {
  const interfaceStyle = useInterfaceStyle();
  if (interfaceStyle === "github") {
    return (
      <Menu>
        <MenuTrigger
          className="flex h-7 items-center gap-2 rounded px-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Conversation mode"
        >
          {props.value === "chat" ? (
            <MessageCircleIcon className="size-3.5" />
          ) : (
            <FolderIcon className="size-3.5" />
          )}
          {props.value === "chat" ? "Chat" : "Work in a project"}
          <ChevronDownIcon className="size-3 opacity-60" />
        </MenuTrigger>
        <MenuPopup align="start">
          <MenuRadioGroup
            value={props.value}
            onValueChange={(value) => {
              if (value === "chat" || value === "code") props.onChange(value);
            }}
          >
            <MenuRadioItem value="chat" closeOnClick>
              <MessageCircleIcon />
              Chat
            </MenuRadioItem>
            <MenuRadioItem value="code" closeOnClick>
              <FolderIcon />
              Work in a project
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    );
  }
  return (
    <ToggleGroup
      aria-label="Conversation mode"
      data-conversation-mode-toggle=""
      className="rounded-full bg-muted/55 p-[3px]"
      variant="segmented"
      value={[props.value]}
      onValueChange={(next) => {
        const value = next[0];
        if (value === "chat" || value === "code") {
          props.onChange(value);
        }
      }}
    >
      <Toggle className="rounded-full px-3.5 font-medium" value="chat">
        Chat
      </Toggle>
      <Toggle className="rounded-full px-3.5 font-medium" value="code">
        Work
      </Toggle>
    </ToggleGroup>
  );
}
