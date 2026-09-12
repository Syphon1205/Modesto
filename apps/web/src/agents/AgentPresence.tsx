// FILE: AgentPresence.tsx
// Purpose: A bot's avatar plus its live state — the glow that says "this one is
//          working" and the dot that says what it needs.
// Layer: Agents UI
//
// The state lives *on* the avatar rather than in a separate status column,
// which is the thing that makes a roster scan as a crew rather than a table.
// The glow is the bot's own body colour, so an active bot reads as itself
// lighting up instead of as a generic alert. Borrowed, with thanks, from
// Rakazo's `BotAvatar` (Apache-2.0) — see THIRD_PARTY_NOTICES.md.

import type { AgentBot, AgentBotActivity } from "@modesto/contracts";

import { AgentAvatar } from "./AgentAvatar";
import { cn } from "~/lib/utils";

export const ACTIVITY_LABELS: Record<AgentBotActivity, string> = {
  idle: "Idle",
  working: "Working",
  waiting: "Needs you",
  done: "Done",
  failed: "Failed",
};

export const ACTIVITY_DOT_CLASS: Record<AgentBotActivity, string> = {
  idle: "bg-muted-foreground/40",
  working: "bg-info",
  waiting: "bg-warning",
  done: "bg-success",
  failed: "bg-destructive",
};

export function AgentPresence({
  bot,
  activity,
  size = 44,
  className,
}: {
  readonly bot: AgentBot;
  readonly activity: AgentBotActivity;
  readonly size?: number;
  readonly className?: string;
}) {
  // Only in-flight work glows. A finished or failed bot is reported by its
  // dot; making every non-idle state glow turns the roster into a christmas
  // tree and destroys the one signal that matters — who is busy right now.
  const glowing = activity === "working";

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        // Inline rather than a Tailwind class: the colour is per-bot data, so
        // there is no class to author for it.
        filter: glowing
          ? `drop-shadow(0 0 ${Math.round(size * 0.22)}px ${bot.avatar.bodyColor})`
          : undefined,
      }}
    >
      <AgentAvatar spec={bot.avatar} size={size} activity={activity} title={`${bot.name} avatar`} />
      {activity === "idle" ? null : (
        <span
          aria-hidden
          className={cn(
            "absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
            ACTIVITY_DOT_CLASS[activity],
            activity === "waiting" && "animate-pulse motion-reduce:animate-none",
          )}
        />
      )}
    </span>
  );
}
