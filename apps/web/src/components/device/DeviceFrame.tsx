// FILE: DeviceFrame.tsx
// Purpose: Flat SVG device chassis that frames every device-pane state, with working hardware buttons.
// Layer: Device pane presentation primitive
// Exports: DeviceScreen, DeviceFrame, DeviceSilhouette, and the chassis geometry re-exports
// Depends on: deviceChassis for every number and outline it draws.
//
// The shapes live in `deviceChassis.ts`, shared with the 3D stage — see that
// file for why the chassis is drawn from a spec table rather than composited
// from vendor artwork. This file is only the flat renderer: it turns those
// outlines into concentric SVG bands and lays the pressable nub targets over
// them.
//
// The chassis is also the pane's container rather than a decoration around the
// video: setup checklists, boot spinners, and the live canvas all render on the
// screen, so the pane reads as one object instead of a rectangle with chrome
// stacked above and below it.

import type { DeviceHardwareButton } from "@modesto/contracts";
import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  chassisNubHitRects,
  chassisOutlines,
  DEVICE_SPECS,
  NUB_ACTIONS,
  outlineToSvgPath,
  screenGeometry,
  type ChassisOutline,
  type DeviceKind,
  type Nub,
  type NubRect,
} from "./deviceChassis";

export {
  deviceKindFor,
  NUB_ACTIONS,
  RESOLUTION_SCALE,
  screenGeometry,
  type DeviceKind,
} from "./deviceChassis";

const SHADOW: CSSProperties = {
  filter: "drop-shadow(0 2px 6px rgb(0 0 0 / 0.2)) drop-shadow(0 12px 32px rgb(0 0 0 / 0.25))",
};

/**
 * A nub as SVG: a filled block flush with the rail, plus the rounded outboard
 * edge that reads as the button's crown.
 */
function nubPaths(rect: NubRect): { fill: string; edge: string } {
  const { x, y, width: w, height: h } = rect;
  const right = x + w;
  const bottom = y + h;
  switch (rect.side) {
    case "left":
      return {
        fill: `M${x} ${y}h${w}v${h}H${x}z`,
        edge: `M${right} ${y}H${x + 6}Q${x} ${y} ${x} ${y + 6}V${bottom - 6}Q${x} ${bottom} ${x + 6} ${bottom}H${right}`,
      };
    case "right":
      return {
        fill: `M${x} ${y}H${right}v${h}H${x}z`,
        edge: `M${x} ${y}H${right - 6}Q${right} ${y} ${right} ${y + 6}V${bottom - 6}Q${right} ${bottom} ${right - 6} ${bottom}H${x}`,
      };
    case "top":
      return {
        fill: `M${x} ${y}v${h}h${w}V${y}z`,
        edge: `M${x} ${bottom}V${y + 6}Q${x} ${y} ${x + 6} ${y}H${right - 6}Q${right} ${y} ${right} ${y + 6}V${bottom}`,
      };
  }
}

function framePaths(kind: DeviceKind, pixelW?: number, pixelH?: number) {
  const geometry = chassisOutlines(kind, pixelW, pixelH);
  const path = (outline: ChassisOutline) => outlineToSvgPath(outline);
  const nubs = geometry.nubs.map(nubPaths);
  return {
    W: geometry.W,
    H: geometry.H,
    outer: path(geometry.outer),
    grey: path(geometry.grey),
    black: path(geometry.black),
    cutout: path(geometry.cutout),
    nubFill: nubs.map((shape) => shape.fill).join(""),
    nubEdge: nubs.map((shape) => shape.edge).join(""),
  };
}

type LayerProps = {
  kind?: DeviceKind;
  pixelWidth?: number | undefined;
  pixelHeight?: number | undefined;
  className?: string;
  style?: CSSProperties;
};

export const DeviceFrame = memo(function DeviceFrame({
  kind = "iPhone",
  pixelWidth,
  pixelHeight,
  className,
  style,
}: LayerProps) {
  const gradientId = useId();
  const spec = DEVICE_SPECS[kind];
  const { W, H, outer, grey, black, cutout, nubFill, nubEdge } = useMemo(
    () => framePaths(kind, pixelWidth, pixelHeight),
    [kind, pixelWidth, pixelHeight],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={style}
      aria-hidden
      focusable={false}
    >
      <defs>
        {/* The tight 45/55 stop pair is the specular line down the band. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={spec.metal[0]} />
          <stop offset="45%" stopColor={spec.metal[1]} />
          <stop offset="55%" stopColor={spec.metal[2]} />
          <stop offset="100%" stopColor={spec.metal[3]} />
        </linearGradient>
      </defs>
      <path d={`${outer} ${cutout}`} fill={`url(#${gradientId})`} fillRule="evenodd" />
      <path d={`${grey} ${cutout}`} fill={spec.inner} fillRule="evenodd" />
      <path d={`${black} ${cutout}`} fill="#000" fillRule="evenodd" />
      <path d={cutout} fill="none" stroke="#2a2a2c" strokeWidth={3} />
      <path
        d={outer}
        fill="none"
        stroke="#000"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <path d={nubFill} fill={spec.nubFill} />
      <path
        d={nubEdge}
        fill="none"
        stroke="#000"
        strokeWidth={1.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

/** Solid black body behind the screen. Carries the drop shadow. */
export const DeviceSilhouette = memo(function DeviceSilhouette({
  kind = "iPhone",
  pixelWidth,
  pixelHeight,
  className,
  style,
}: LayerProps) {
  const { W, H, outer, nubFill } = useMemo(
    () => framePaths(kind, pixelWidth, pixelHeight),
    [kind, pixelWidth, pixelHeight],
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={style}
      aria-hidden
      focusable={false}
    >
      <path d={`${outer} ${nubFill}`} fill="#000" />
    </svg>
  );
});

/** Direction a pressed nub travels: always into the chassis. */
const NUB_PRESS_IN: Record<Nub["side"], string> = {
  left: "active:translate-x-[1.5px]",
  right: "active:-translate-x-[1.5px]",
  top: "active:translate-y-[1.5px]",
};

export const DeviceScreen = memo(function DeviceScreen({
  children,
  kind = "iPhone",
  pixelWidth,
  pixelHeight,
  className,
  buttonsDisabled,
  landscape = false,
  onPressButton,
}: {
  children: ReactNode;
  kind?: DeviceKind;
  pixelWidth?: number | undefined;
  pixelHeight?: number | undefined;
  className?: string;
  buttonsDisabled?: boolean;
  /**
   * Turn the whole device a quarter turn. The guest keeps rendering portrait —
   * CoreSimulator has no orientation API — so this rotates the assembled
   * device, buttons and all, rather than re-deriving a landscape chassis.
   */
  landscape?: boolean;
  onPressButton?: ((button: DeviceHardwareButton) => void) | undefined;
}) {
  const geo = useMemo(
    () => screenGeometry(kind, pixelWidth, pixelHeight),
    [kind, pixelWidth, pixelHeight],
  );
  const nubs = useMemo(
    () => chassisNubHitRects(kind, pixelWidth, pixelHeight),
    [kind, pixelWidth, pixelHeight],
  );
  const screenStyle = useMemo<CSSProperties>(
    () => ({
      left: `${geo.insetXPct}%`,
      top: `${geo.insetYPct}%`,
      width: `${100 - 2 * geo.insetXPct}%`,
      height: `${100 - 2 * geo.insetYPct}%`,
      borderRadius: geo.screenBorderRadius,
    }),
    [geo],
  );

  return (
    <div
      className={cn(
        // No overflow clip: the chassis shadow reaches ~32px past the device,
        // and clipping it left a hard horizontal cut where the control rail
        // began. Padding keeps the device off the pane edges, and the sizing
        // below already stops the frame itself from escaping the box.
        "flex h-full min-h-0 items-center justify-center p-6 [container-type:size]",
        className,
      )}
    >
      <div
        className="relative"
        style={{
          // Turned, the device's height runs across the pane, so the fit is
          // measured against the transposed axis; without this the rotated
          // device shrinks to whatever its untumbled height allowed.
          height: landscape
            ? `min(100cqw, calc(100cqh / ${geo.aspect}))`
            : `min(100cqh, calc(100cqw / ${geo.aspect}))`,
          aspectRatio: geo.aspect,
          ...(landscape ? { transform: "rotate(90deg)" } : {}),
        }}
      >
        <DeviceSilhouette
          kind={kind}
          pixelWidth={pixelWidth}
          pixelHeight={pixelHeight}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          style={SHADOW}
        />
        <div className="absolute overflow-hidden bg-black" style={screenStyle}>
          {children}
        </div>
        <DeviceFrame
          kind={kind}
          pixelWidth={pixelWidth}
          pixelHeight={pixelHeight}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        {/*
          The frame draws the hardware; this lays the controls over it.
          Simulator.app's side buttons are clickable and so are the ones backed
          by a real press, which is why each carries an accessible name and a
          focus ring even though its face is the SVG's. A nub with no button is
          rendered as a plain hover target instead: it explains itself rather
          than inviting a click that the backend would only refuse.
        */}
        {nubs.map(({ name, side, style }) => {
          const action = NUB_ACTIONS[name];
          if (!action) return null;
          const press = action.button;
          const interactive = press !== undefined && onPressButton !== undefined;
          if (!interactive && !action.hint) return null;
          return (
            <Tooltip key={name}>
              <TooltipTrigger
                render={
                  interactive ? (
                    <button
                      type="button"
                      aria-label={action.label}
                      disabled={buttonsDisabled}
                      onClick={() => onPressButton?.(press)}
                      className={cn(
                        "absolute cursor-pointer rounded-full outline-none",
                        "transition-transform duration-220 motion-reduce:transition-none",
                        NUB_PRESS_IN[side],
                        "focus-visible:ring-2 focus-visible:ring-ring/80",
                        "disabled:pointer-events-none",
                      )}
                      style={style}
                    />
                  ) : (
                    // Not a button: it has nothing to activate, so it takes no
                    // tab stop and offers no press affordance — only the
                    // tooltip that says why.
                    <span
                      aria-label={action.label}
                      className="absolute cursor-default rounded-full"
                      style={style}
                    />
                  )
                }
              />
              <TooltipPopup side={side === "top" ? "top" : side}>
                {action.hint ? `${action.label} — ${action.hint}` : action.label}
              </TooltipPopup>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
});
