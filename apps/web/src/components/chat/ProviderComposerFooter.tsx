import type { ReactNode } from "react";

import type { ProviderLayout } from "~/providerLayouts";

interface ProviderComposerFooterProps {
  readonly layout: ProviderLayout;
  readonly attach: ReactNode;
  readonly voice: ReactNode;
  readonly model: ReactNode;
  readonly traits: ReactNode;
  /** Runtime (permissions) and interaction-mode controls. */
  readonly mode: ReactNode;
  readonly badges: ReactNode;
  /** Context meter plus the send / stop control. */
  readonly primary: ReactNode;
}

/**
 * Arranges the composer's existing controls the way each desktop app does.
 *
 * - Claude Code: permissions, attach and voice on the left; model, effort
 *   and the context ring on the right. The row sits under the prompt box
 *   (see the `claude` rules in providerLayouts.css) and send moves into it.
 * - Codex: attach and permissions on the left; model, reasoning, voice and
 *   send on the right, inside the prompt box.
 * - Cursor: attach and the model on the left; voice and send on the right.
 */
export function ProviderComposerFooter(props: ProviderComposerFooterProps) {
  const left =
    props.layout === "claude" ? (
      <>
        {props.mode}
        {props.attach}
        {props.voice}
      </>
    ) : props.layout === "codex" ? (
      <>
        {props.attach}
        {props.mode}
      </>
    ) : (
      <>
        {props.attach}
        {props.model}
        {props.traits}
      </>
    );
  const right =
    props.layout === "claude" ? (
      <>
        {props.badges}
        {props.model}
        {props.traits}
        {props.primary}
      </>
    ) : props.layout === "codex" ? (
      <>
        {props.badges}
        {props.model}
        {props.traits}
        {props.voice}
        {props.primary}
      </>
    ) : (
      <>
        {props.badges}
        {props.voice}
        {props.primary}
      </>
    );

  return (
    <>
      <div
        data-chat-composer-actions="left"
        className="-m-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {left}
      </div>
      <div
        data-chat-composer-actions="right"
        className="flex shrink-0 flex-nowrap items-center justify-end gap-0.5"
      >
        {right}
      </div>
    </>
  );
}
