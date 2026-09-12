// FILE: AgentAvatar.tsx
// Purpose: Draw one agent bot's animated face at any size.
// Layer: Agents UI
//
// The drawing is the Bible Strong avatar engine's (AGPL-3.0, see
// THIRD_PARTY_NOTICES.md). This component only decides which definition and
// which animation, and memoises hard enough that the engine is cheap to use
// in a dense roster.

import type { AgentAvatarSpec, AgentBotActivity } from "@modesto/contracts";
import { Avatar } from "@bible-strong/avatar-react";
import "@bible-strong/avatar-react/styles.css";
import { memo, useMemo } from "react";

import { animationForActivity, composeAgentAvatarDefinition } from "./avatar/agentAvatarDefinition";
import { cn } from "~/lib/utils";

/**
 * Module-level, never inline.
 *
 * The engine keys its "start this animation" effect on `onError` among other
 * things, so a fresh closure each render re-enters that effect, resets
 * playback to a new timeline anchored at `now`, sets state, and re-renders —
 * a loop that pins every avatar at its first frame. Live test: avatars
 * rendered correctly and never moved.
 */
function reportAvatarError(error: unknown): void {
  console.warn("Avatar runtime rejected a target.", error);
}

export interface AgentAvatarProps {
  readonly spec: AgentAvatarSpec;
  /** Rendered pixel size. The drawing is resolution-independent. */
  readonly size?: number;
  /** What the bot is doing; picks the animation. Ignored when `animation` is set. */
  readonly activity?: AgentBotActivity;
  /** An explicit animation from the library, for the lab's preview strip. */
  readonly animation?: string;
  /** Accessible name. Omit for decorative use beside a visible bot name. */
  readonly title?: string;
  readonly className?: string;
}

function AgentAvatarImpl({
  spec,
  size = 40,
  activity = "idle",
  animation,
  title,
  className,
}: AgentAvatarProps) {
  // Memoised on the spec so the engine sees one stable object identity: it
  // validates a definition once per identity, and a fresh 23KB document each
  // render would re-run full JSON-schema validation on every frame.
  const definition = useMemo(() => composeAgentAvatarDefinition(spec), [spec]);
  const target = animation ?? animationForActivity(activity);

  return (
    <Avatar
      definition={definition}
      animation={target}
      autoplay
      size={size}
      className={cn("shrink-0", className)}
      {...(title === undefined ? {} : { ariaLabel: title })}
      // A bad animation key must not take the roster down with it: the engine
      // keeps rendering the last good frame, and a warning is the right
      // severity for "this bot's activity has no timeline".
      onError={reportAvatarError}
    />
  );
}

/**
 * Memoised: a roster re-renders on every thread event, and each avatar that
 * re-renders re-enters the engine's playback effects even when nothing about
 * that bot changed.
 */
export const AgentAvatar = memo(AgentAvatarImpl);
