import type { ThemeCardPreviewColors } from "./ThemePreviewCircles";

/** A palette preview uses that palette's colors rather than the active app theme. */
export function PalettePreview({ colors }: { colors: ThemeCardPreviewColors }) {
  return (
    <span
      aria-hidden
      className="relative block h-28 overflow-hidden border-b border-border/40"
      style={{ background: colors.canvas }}
    >
      <span className="absolute inset-y-0 left-0 w-[32%]" style={{ background: colors.sidebar }}>
        <span className="absolute left-2 top-2 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1 rounded-full bg-gray-400/50" />
          ))}
        </span>
        {[28, 40, 52, 70, 82, 96].map((top, i) => (
          <span
            key={top}
            className="absolute left-2 h-[3px] rounded-full"
            style={{ top, width: `${i % 2 ? 36 : 52}%`, background: colors.messageSurface }}
          />
        ))}
      </span>
      <span
        className="absolute bottom-0 left-[32%] right-0 top-2 rounded-tl-sm"
        style={{ background: colors.surface }}
      >
        <span className="absolute inset-x-2 top-1 flex gap-1">
          <span className="h-[3px] w-3 rounded-full" style={{ background: colors.accent }} />
          <span className="h-[3px] w-7 rounded-full bg-gray-400/40" />
          <span
            className="ml-auto h-[3px] w-4 rounded-full"
            style={{ background: colors.messageAction }}
          />
        </span>
        {[21, 32, 43, 62, 73, 88].map((top, i) => (
          <span
            key={top}
            className="absolute left-2 h-[3px] rounded-full"
            style={{
              top,
              width: `${[65, 82, 48, 70, 53, 76][i]}%`,
              background: i === 3 ? "#e98590" : i === 4 ? "#7cbd93" : colors.messageSurface,
            }}
          />
        ))}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex h-px">
        {["#e98590", "#d7ba7d", "#7cbd93", colors.accent, "#b095d6"].map((color, i) => (
          <span key={i} className="flex-1" style={{ background: color }} />
        ))}
      </span>
    </span>
  );
}
