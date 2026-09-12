import type { ConversationMode } from "~/composerDraftStore";

import { Toggle, ToggleGroup } from "../ui/toggle-group";

export function ComposerConversationModeToggle(props: {
  readonly value: ConversationMode;
  readonly onChange: (mode: ConversationMode) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Conversation mode"
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
