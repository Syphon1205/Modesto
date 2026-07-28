// FILE: EffortSlider.tsx
// Purpose: Stepped effort selector shared by every effort-capable composer model.

import {
  type CSSProperties,
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { InfoIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { MenuGroup } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface EffortSliderOption {
  value: string;
  label: string;
  isDefault?: boolean;
  description?: string | null;
}

const EFFORT_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
const RAINBOW_EFFORTS = new Set(["ultrathink", "ultracode"]);
const EFFORT_ACCENTS = ["#8fa6c9", "#7fbec4", "#83b99a", "#c9aa72", "#b99ae8"] as const;

export const EFFORT_SLIDER_PICKER_WIDTH_CLASS_NAME = "!w-[20rem] !min-w-[20rem] !max-w-[92vw]";

function isRainbowEffort(value: string | null | undefined): boolean {
  return typeof value === "string" && RAINBOW_EFFORTS.has(value);
}

function clampIndex(value: number, options: ReadonlyArray<EffortSliderOption>): number {
  return Math.max(0, Math.min(options.length - 1, Math.round(value)));
}

function stopRatio(index: number, count: number): number {
  if (count <= 1) return 0.5;
  return index / (count - 1);
}

export const EffortSlider = memo(function EffortSlider(props: {
  label: string;
  value: string;
  defaultValue: string | null;
  options: ReadonlyArray<EffortSliderOption>;
  disabled?: boolean;
  /** Prompt-injected Ultrathink: lock the track on Ultrathink with rainbow fill. */
  rainbow?: boolean;
  note?: string | null;
  onValueCommit: (value: string) => void;
}) {
  const lockedIndex = props.rainbow
    ? props.options.findIndex((option) => option.value === "ultrathink")
    : -1;
  const selectedIndex = Math.max(
    0,
    props.options.findIndex((option) => option.value === props.value),
  );
  const [previewIndex, setPreviewIndex] = useState(selectedIndex);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) setPreviewIndex(selectedIndex);
  }, [dragging, selectedIndex]);

  const activeIndex = clampIndex(previewIndex, props.options);
  const displayIndex = lockedIndex >= 0 ? lockedIndex : activeIndex;
  const activeOption = props.options[displayIndex] ?? props.options[0];
  const rainbow = Boolean(props.rainbow || isRainbowEffort(activeOption?.value));
  const progressRatio = stopRatio(displayIndex, props.options.length);
  const accentIndex = Math.min(
    EFFORT_ACCENTS.length - 1,
    Math.round(progressRatio * (EFFORT_ACCENTS.length - 1)),
  );
  const accent = EFFORT_ACCENTS[accentIndex] ?? EFFORT_ACCENTS[0];
  const helpText =
    props.note ??
    activeOption?.description ??
    (rainbow
      ? "Maximum depth for the hardest problems."
      : "Adjust how much reasoning the model spends.");

  const style = useMemo(
    () =>
      ({
        "--effort-progress-ratio": String(progressRatio),
        "--effort-accent": accent,
      }) as CSSProperties,
    [accent, progressRatio],
  );

  const commitIndex = useCallback(
    (rawIndex: number) => {
      if (props.disabled) return;
      const option = props.options[clampIndex(rawIndex, props.options)];
      if (option) props.onValueCommit(option.value);
    },
    [props.disabled, props.onValueCommit, props.options],
  );

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (EFFORT_KEYS.has(event.key)) event.stopPropagation();
  }, []);

  const handleKeyUp = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!EFFORT_KEYS.has(event.key)) return;
      event.stopPropagation();
      commitIndex(Number(event.currentTarget.value));
    },
    [commitIndex],
  );

  if (!activeOption) return null;

  return (
    <MenuGroup>
      <div
        className={cn(
          "effort-slider mx-1.5 my-1 rounded-lg border border-[color:color-mix(in_srgb,var(--foreground)_9%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-3 py-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-400/40",
          props.disabled && !rainbow && "opacity-55",
        )}
        style={style}
        data-effort-index={displayIndex}
        data-effort-count={props.options.length}
        data-rainbow={rainbow ? "true" : "false"}
        data-dragging={dragging ? "true" : "false"}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{props.label}</span>
            <span
              className={cn(
                "truncate text-xs font-medium text-foreground/85",
                rainbow && "ultrathink-word font-semibold",
              )}
            >
              {activeOption.label}
            </span>
            {activeOption.value === props.defaultValue && !rainbow ? (
              <span className="rounded-full bg-foreground/6 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Default
              </span>
            ) : null}
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                  aria-label="Effort help"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                />
              }
            >
              <InfoIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="top" variant="picker" className="max-w-64 whitespace-normal">
              {helpText}
            </TooltipPopup>
          </Tooltip>
        </div>

        {activeOption.description || props.note ? (
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
            {props.note ?? activeOption.description}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between text-[10px] font-medium text-muted-foreground/75">
          <span>Faster</span>
          <span>Smarter</span>
        </div>

        <div className="relative mt-1.5 h-8">
          <div className="effort-slider-track absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" />
          <div
            aria-hidden="true"
            className="effort-slider-fill pointer-events-none absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full"
            style={{
              width: `calc(0.7rem + (100% - 1.4rem) * var(--effort-progress-ratio))`,
            }}
          />

          {props.options.map((option, index) => {
            const ratio = stopRatio(index, props.options.length);
            const ultra = isRainbowEffort(option.value);
            const passed = index <= displayIndex;
            return (
              <span
                key={option.value}
                aria-hidden="true"
                className="effort-slider-stop pointer-events-none absolute top-1/2 z-[1] size-1 rounded-full"
                data-ultra={ultra ? "true" : "false"}
                data-passed={passed ? "true" : "false"}
                data-active={index === displayIndex ? "true" : "false"}
                style={{ left: `calc(0.7rem + (100% - 1.4rem) * ${ratio})` }}
              />
            );
          })}

          <div
            aria-hidden="true"
            className="effort-slider-thumb pointer-events-none absolute top-1/2 z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `calc(0.7rem + (100% - 1.4rem) * var(--effort-progress-ratio))`,
            }}
          />

          <input
            type="range"
            min={0}
            max={Math.max(0, props.options.length - 1)}
            step={1}
            value={displayIndex}
            disabled={props.disabled}
            aria-label={props.label}
            aria-valuetext={activeOption.label}
            className="absolute inset-0 z-20 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
            onChange={(event) => setPreviewIndex(Number(event.currentTarget.value))}
            onPointerDown={() => setDragging(true)}
            onPointerUp={(event) => {
              setDragging(false);
              commitIndex(Number(event.currentTarget.value));
            }}
            onPointerCancel={() => {
              setDragging(false);
              setPreviewIndex(selectedIndex);
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={(event) => {
              if (Number(event.currentTarget.value) !== selectedIndex) {
                commitIndex(Number(event.currentTarget.value));
              }
            }}
          />
        </div>

        <div className="sr-only" aria-hidden="true">
          {props.options.map((option) => option.label).join(", ")}
        </div>
      </div>
    </MenuGroup>
  );
});
