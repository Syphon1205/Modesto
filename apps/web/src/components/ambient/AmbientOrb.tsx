// FILE: AmbientOrb.tsx
// Purpose: The floating presence bubble — a soft watercolor wash, not a glass
//          chip. Reuses the brand's own background technique (see
//          apps/marketing/public/announcements/*.svg's "wash1/wash2/wash3"
//          filters: feTurbulence -> feDisplacementMap -> feGaussianBlur over
//          layered ink-and-color ellipses) at UI scale, instead of a ring +
//          shadow + backdrop-blur badge. Status still reads by color, but the
//          color arrives as a soft painted blob, not a hard outline.
//
//          Two wash layers, not one — the same two tone colors in different
//          arrangements, one slowly crossfading over the other while both
//          independently drift (see the `drift-1`/`drift-2`/`ambient-wash-
//          cross-fade` keyframes in index.css). A single static wash plus a
//          uniform pulse read as a picture that occasionally twitches; this
//          is meant to look painted and alive the way real watercolor
//          shifts under changing light, not like a notification badge.
//
//          Purely visual/status — no voice, no microphone, no speaking state.
// Layer: Ambient UI
//
// "Most pressing" is not decided here — `buildAmbientBubbles` already returns
// bubbles sorted by phase priority (waiting-on-you first, then running, then
// terminal states), so the dominant bubble is just `bubbles[0]`.

import type { AgentAwarenessPhase } from "@modesto/shared/agentAwareness";
import type { AgentBotActivity } from "@modesto/contracts";
import { AgentAvatar } from "~/agents/AgentAvatar";
import { useId, useState } from "react";

import { cn } from "~/lib/utils";

import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import {
  ambientBubbleToneForPhase,
  type AmbientBubble,
  type AmbientBubbleTone,
} from "./ambientBubbles.ts";

/**
 * Two tints per tone, painted as overlapping washes — this is what makes the
 * orb read as painted rather than flat-filled. Picked from (or alongside)
 * the brand's own wash palette: active/success are the brand's green,
 * waiting is the brand's gold, danger and stale are new tints in the same
 * muted, desaturated family rather than a stock alert red/gray.
 */
const TONE_WASH: Record<AmbientBubbleTone, { readonly a: string; readonly b: string }> = {
  active: { a: "#5aa679", b: "#6cb083" },
  waiting: { a: "#e0b25e", b: "#eec488" },
  success: { a: "#7cbf94", b: "#9ad1ac" },
  danger: { a: "#c9603f", b: "#b3523a" },
  stale: { a: "#6b7168", b: "#52564f" },
  neutral: { a: "#7a7f76", b: "#5f6359" },
};

/** Ink ground the washes sit on, matching the brand canvas. */
const WASH_INK = "#0d0e0c";

/** Pulse only for states you'd actually want to notice from across the room. */
function ambientOrbPulses(tone: AmbientBubbleTone): boolean {
  return tone === "active" || tone === "waiting" || tone === "danger";
}

/**
 * Static filter defs, mounted once alongside the orb rather than per-instance
 * — the turbulence pattern itself never changes (only which two colors ride
 * on top of it, and each layer's own transform/opacity, do), so one pair of
 * shared `<filter>`s covers every tone and every mounted orb. `position:
 * absolute` + zero size keeps it out of layout without `display: none`,
 * which some browsers refuse to compute filter regions for.
 */
function AmbientWashDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="ambient-orb-wash-1" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.09 0.12"
            numOctaves={3}
            seed={7}
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale={13}
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur stdDeviation={3.2} />
        </filter>
        <filter id="ambient-orb-wash-2" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.1 0.08"
            numOctaves={3}
            seed={19}
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale={15}
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur stdDeviation={3} />
        </filter>
      </defs>
    </svg>
  );
}

function AmbientOrbWash({ tone }: { readonly tone: AmbientBubbleTone }) {
  const wash = TONE_WASH[tone];
  return (
    <svg viewBox="0 0 64 64" className="absolute inset-0 size-full" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={WASH_INK} />
      {/* Look 1: the base wash, always visible. Three ellipses cover the full
          circle with generous overlap — two alone left visible dark
          crescents at the rim. Its own slow rotate/scale drift keeps it from
          reading as a fixed picture even between crossfades. */}
      <g
        className="animate-ambient-wash-drift-1 motion-reduce:animate-none"
        style={{ transformOrigin: "32px 32px" }}
      >
        <ellipse
          cx="28"
          cy="30"
          rx="30"
          ry="27"
          fill={wash.a}
          opacity="0.85"
          filter="url(#ambient-orb-wash-1)"
        />
        <ellipse
          cx="40"
          cy="38"
          rx="27"
          ry="25"
          fill={wash.b}
          opacity="0.65"
          filter="url(#ambient-orb-wash-1)"
        />
        <ellipse
          cx="30"
          cy="22"
          rx="18"
          ry="15"
          fill={wash.a}
          opacity="0.5"
          filter="url(#ambient-orb-wash-1)"
        />
      </g>
      {/* Look 2: the same two colors, a different brushstroke arrangement,
          crossfading over Look 1 on its own (longer, offset) period, plus a
          different drift rate — the asynchrony between the two is what makes
          the motion read as organic rather than a loop you can predict. */}
      <g
        className="animate-ambient-wash-drift-2-cross-fade motion-reduce:animate-none"
        style={{ transformOrigin: "32px 32px" }}
      >
        <ellipse
          cx="38"
          cy="26"
          rx="26"
          ry="24"
          fill={wash.b}
          opacity="0.8"
          filter="url(#ambient-orb-wash-2)"
        />
        <ellipse
          cx="24"
          cy="40"
          rx="24"
          ry="22"
          fill={wash.a}
          opacity="0.6"
          filter="url(#ambient-orb-wash-2)"
        />
      </g>
    </svg>
  );
}

/**
 * Awareness phase → bot activity, so the overlay plays the same animation the
 * roster does for the same state. The orb works in thread phases and the
 * roster in rolled-up activity; funnelling both through `AgentBotActivity`
 * keeps a bot from looking busy in one place and asleep in the other.
 */
function ambientOrbActivityForPhase(phase: AgentAwarenessPhase): AgentBotActivity {
  switch (phase) {
    case "starting":
    case "running":
      return "working";
    case "waiting_for_approval":
    case "waiting_for_input":
      return "waiting";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    case "stale":
    default:
      return "idle";
  }
}

export function AmbientOrb({
  bubbles,
  onSelect,
  onPointerDownCapture,
  onClickCapture,
  className,
}: {
  readonly bubbles: ReadonlyArray<AmbientBubble>;
  readonly onSelect: (bubble: AmbientBubble) => void;
  /**
   * Capture-phase handlers the layer uses to tell a drag from a click — the
   * orb is both the drag handle and the click target now that the separate
   * "⋯" handle is gone. Purely forwarded; this component has no drag logic
   * of its own.
   */
  readonly onPointerDownCapture?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  readonly onClickCapture?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (bubbles.length === 0) return null;

  const dominant = bubbles[0]!;
  const tone = ambientBubbleToneForPhase(dominant.phase);
  const hasMore = bubbles.length > 1;

  const handleClick = () => {
    if (!hasMore) {
      onSelect(dominant);
      return;
    }
    setOpen((current) => !current);
  };

  return (
    <>
      <AmbientWashDefs />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              onPointerDownCapture={onPointerDownCapture}
              onClickCapture={onClickCapture}
              onClick={handleClick}
              className={cn(
                "group relative flex size-14 cursor-pointer items-center justify-center rounded-full",
                // No ring, no backdrop-blur, no boxy shadow — the wash itself
                // is the whole visual; a soft color-matched glow stands in
                // for a hard outline.
                "transition-transform duration-150 ease-out",
                "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                "active:cursor-grabbing",
                ambientOrbPulses(tone) && "animate-ambient-orb-pulse motion-reduce:animate-none",
                className,
              )}
              style={{
                boxShadow: `0 4px 24px -6px ${TONE_WASH[tone].a}66, 0 1px 3px rgba(0,0,0,0.3)`,
              }}
              title={hasMore ? `${bubbles.length} active — ${dominant.title}` : dominant.title}
              aria-label={
                hasMore
                  ? `${bubbles.length} active agents. Most recent: ${dominant.title}, ${dominant.subtitle}.`
                  : `${dominant.title}: ${dominant.subtitle}`
              }
              aria-haspopup={hasMore ? "listbox" : undefined}
              aria-expanded={hasMore ? open : undefined}
              aria-controls={hasMore ? listId : undefined}
            >
              {/* overflow-hidden lives on this inner wrapper, not the button
                  itself — the count badge sits just outside the circle and
                  would get clipped if the button clipped its own overflow. */}
              <span className="absolute inset-0 overflow-hidden rounded-full">
                <AmbientOrbWash tone={tone} />
              </span>
              {/* When the dominant thread belongs to an agent bot, its face
                  sits on the wash: the whole point of giving agents a look is
                  recognising which one needs you without reading a label. */}
              {dominant.avatar ? (
                <AgentAvatar
                  spec={dominant.avatar}
                  size={36}
                  activity={ambientOrbActivityForPhase(dominant.phase)}
                  className="pointer-events-none relative"
                />
              ) : null}
              {hasMore ? (
                <span
                  aria-hidden="true"
                  className="absolute -end-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-black/70 px-1 font-mono text-[10px] font-medium text-white/90 shadow-sm backdrop-blur-sm"
                >
                  {bubbles.length}
                </span>
              ) : null}
            </button>
          }
        />
        {hasMore ? (
          <PopoverPopup side="top" align="end" sideOffset={8} className="w-72 p-1">
            <ul
              id={listId}
              role="listbox"
              aria-label="Active agents"
              className="flex flex-col gap-0.5"
            >
              {bubbles.map((bubble) => {
                const bubbleTone = ambientBubbleToneForPhase(bubble.phase);
                return (
                  <li key={bubble.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-sidebar-row-hover"
                      onClick={() => {
                        setOpen(false);
                        onSelect(bubble);
                      }}
                    >
                      {bubble.avatar ? (
                        <AgentAvatar
                          spec={bubble.avatar}
                          size={18}
                          activity={ambientOrbActivityForPhase(bubble.phase)}
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          bubble.avatar && "hidden",
                          ambientOrbPulses(bubbleTone) &&
                            "animate-pulse motion-reduce:animate-none",
                        )}
                        style={{ backgroundColor: TONE_WASH[bubbleTone].a }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {bubble.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {bubble.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverPopup>
        ) : null}
      </Popover>
    </>
  );
}
