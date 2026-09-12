// FILE: SpeakingWaveform.tsx
// Purpose: Lightweight Cursor-style highs/lows CSS bars for TTS speaking state.
//          Not an AnalyserNode — pure CSS animation driven by speaking boolean.
// Layer: Ambient / chat UI primitive

import { cn } from "~/lib/utils";

const BAR_HEIGHTS = [0.35, 0.85, 0.55, 1, 0.45, 0.75, 0.4] as const;
const BAR_DURATIONS = [0.72, 0.96, 0.8, 1.08, 0.88, 0.92, 0.76] as const;

export function SpeakingWaveform(props: {
  readonly active?: boolean;
  readonly className?: string;
  readonly barClassName?: string;
  readonly "aria-label"?: string;
}) {
  const { active = true, className, barClassName, "aria-label": ariaLabel = "Speaking" } = props;

  return (
    <span
      role="status"
      aria-label={active ? ariaLabel : undefined}
      aria-hidden={active ? undefined : true}
      className={cn("inline-flex h-3.5 items-end gap-0.5", !active && "opacity-40", className)}
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className={cn(
            "w-0.5 origin-bottom rounded-full bg-current",
            active ? "animate-speaking-bar motion-reduce:animate-none" : null,
            barClassName,
          )}
          style={{
            height: `${Math.round(height * 100)}%`,
            animationDuration: `${BAR_DURATIONS[index]}s`,
            animationDelay: `${index * 0.05}s`,
          }}
        />
      ))}
    </span>
  );
}
