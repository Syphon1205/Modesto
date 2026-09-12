// FILE: deviceChassis.ts
// Purpose: The device chassis geometry — one spec table and one outline builder
//          feeding both the flat SVG frame and the 3D stage.
// Layer: Device pane geometry primitive
// Exports: DEVICE_SPECS, deviceKindFor, screenGeometry, chassisMetrics,
//          chassisOutlines, chassisNubRects, outlineToSvgPath, RESOLUTION_SCALE,
//          NUB_ACTIONS
// Depends on: device contracts for the button names.
//
// Drawn rather than composited from vendor artwork: Apple's bezel images are
// licensed for marketing use, must be used unmodified, and explicitly may not
// be turned into buttons — which is exactly what the side nubs are. Marketplace
// 3D models of the same handsets are derivatives of the same protected
// industrial design, and cost megabytes apiece besides. Both renderers instead
// build their shapes from the numbers below, so a new device is a table entry
// rather than an asset pipeline.
//
// Outlines are emitted as an intermediate segment list rather than as SVG path
// strings, because a path string is a dead end for anything but an <svg>. The
// same list becomes a `d` attribute here and a THREE.Shape in DeviceStage3d,
// which is what keeps the flat frame and the 3D body provably the same object.

import type { DeviceFamily, DeviceHardwareButton } from "@modesto/contracts";

export type DeviceKind = "iPhone" | "pixel" | "galaxy" | "iPad";

export type Nub = {
  side: "left" | "right" | "top";
  /** Offset along the edge in device pixels. Negative on `top` measures from the right. */
  at: number;
  len: number;
  name: string;
};

type ChassisCorner = "squircle" | "round";

export type DeviceSpec = {
  pixelW: number;
  pixelH: number;
  screenRadius: number;
  corner: ChassisCorner;
  /** The three concentric band widths, outermost first. */
  frame: number;
  silver: number;
  grey: number;
  /** How far the side buttons protrude past the outer band. */
  nubProtrude: number;
  /**
   * Body depth as a fraction of chassis height, from the published dimensions
   * (e.g. iPhone 17 Pro Max is 8.75mm thick and 163.4mm tall). Only the 3D
   * stage reads it; the flat frame has no Z.
   */
  thicknessRatio: number;
  nubs: Nub[];
  metal: readonly [string, string, string, string];
  inner: string;
  nubFill: string;
  /** Rail and back-shell colours for the 3D body's two material groups. */
  railColor: number;
  backColor: number;
  /** How polished the rail reads. Titanium is brushed; aluminium is mirror-bright. */
  railRoughness: number;
};

export const DEVICE_SPECS: Record<DeviceKind, DeviceSpec> = {
  // iPhone 17 Pro Max: 6.9" Super Retina, dual-volume + action button, silver bands.
  iPhone: {
    pixelW: 1320,
    pixelH: 2868,
    screenRadius: 198,
    corner: "squircle",
    frame: 34,
    silver: 8,
    grey: 12,
    nubProtrude: 27,
    thicknessRatio: 0.0535,
    nubs: [
      { side: "left", at: 554, len: 112, name: "action" },
      { side: "left", at: 754, len: 210, name: "volumeUp" },
      { side: "left", at: 1014, len: 210, name: "volumeDown" },
      { side: "right", at: 889, len: 331, name: "power" },
    ],
    metal: ["#e8e8ec", "#bcbcc0", "#b4b4b8", "#e2e2e6"],
    inner: "#4a4a4e",
    nubFill: "#4a4a4e",
    railColor: 0xd8d8de,
    backColor: 0x2b2b30,
    railRoughness: 0.17,
  },
  // Pixel 10: graphite aluminum, circular corners, power + volume rocker on the right.
  pixel: {
    pixelW: 1080,
    pixelH: 2424,
    screenRadius: 72,
    corner: "round",
    frame: 18,
    silver: 5,
    grey: 7,
    nubProtrude: 16,
    thicknessRatio: 0.0563,
    nubs: [
      { side: "right", at: 420, len: 120, name: "power" },
      { side: "right", at: 620, len: 280, name: "volumeRocker" },
    ],
    metal: ["#6d6d72", "#3f3f44", "#2c2c30", "#5a5a60"],
    inner: "#1f1f22",
    nubFill: "#2a2a2e",
    railColor: 0x5c5c63,
    backColor: 0x1d1d21,
    railRoughness: 0.24,
  },
  // Galaxy S26 Ultra: squared titanium, tighter corners, volume up/down + power on the right.
  galaxy: {
    pixelW: 1440,
    pixelH: 3120,
    screenRadius: 36,
    corner: "round",
    frame: 20,
    silver: 4,
    grey: 8,
    nubProtrude: 14,
    thicknessRatio: 0.0504,
    nubs: [
      { side: "right", at: 640, len: 150, name: "volumeUp" },
      { side: "right", at: 810, len: 150, name: "volumeDown" },
      { side: "right", at: 1040, len: 190, name: "power" },
    ],
    metal: ["#9a958c", "#4e4b45", "#3a3833", "#6e6a63"],
    inner: "#2a2824",
    nubFill: "#3a3833",
    railColor: 0x8a857c,
    backColor: 0x26241f,
    // Brushed titanium, not polished aluminium: the highlight is a wide smear.
    railRoughness: 0.34,
  },
  iPad: {
    pixelW: 1668,
    pixelH: 2420,
    screenRadius: 58,
    corner: "squircle",
    frame: 64,
    silver: 12,
    grey: 16,
    nubProtrude: 20,
    thicknessRatio: 0.0204,
    nubs: [
      { side: "right", at: 202, len: 104, name: "volumeUp" },
      { side: "right", at: 328, len: 104, name: "volumeDown" },
      { side: "top", at: -148, len: 126, name: "power" },
    ],
    metal: ["#e8e8ec", "#bcbcc0", "#b4b4b8", "#e2e2e6"],
    inner: "#4a4a4e",
    nubFill: "#4a4a4e",
    railColor: 0xd8d8de,
    backColor: 0x2b2b30,
    railRoughness: 0.17,
  },
};

/** Screen pixels per device point, per kind. */
export const RESOLUTION_SCALE: Record<DeviceKind, number> = {
  iPhone: 3,
  pixel: 1,
  galaxy: 1,
  iPad: 2,
};

/**
 * Which chassis to draw a device in.
 *
 * `family` comes from the simulator's device type profile and is authoritative
 * wherever it exists. The name is the fallback for a backend that could not
 * read the profile, and it only holds for as long as every Apple tablet has
 * "iPad" in its name. Android names pick Pixel vs Galaxy so Samsung never
 * inherits Google's graphite body.
 */
export function deviceKindFor(device: {
  platform: string;
  name: string;
  family?: DeviceFamily | undefined;
}): DeviceKind {
  if (device.platform.startsWith("android")) {
    return /(galaxy|samsung)/iu.test(device.name) ? "galaxy" : "pixel";
  }
  if (device.family) return device.family === "tablet" ? "iPad" : "iPhone";
  return device.name.toLowerCase().includes("ipad") ? "iPad" : "iPhone";
}

// ── Outlines ─────────────────────────────────────────────────────────

export type ChassisPoint = { readonly x: number; readonly y: number };

/**
 * The one outline representation both renderers consume. Deliberately limited
 * to move/line/cubic/close: those four are the intersection of what SVG path
 * data and THREE.Shape both express natively, so neither emitter has to
 * approximate the other's primitives at draw time.
 */
export type ChassisSegment =
  | { readonly kind: "move"; readonly to: ChassisPoint }
  | { readonly kind: "line"; readonly to: ChassisPoint }
  | {
      readonly kind: "cubic";
      readonly c1: ChassisPoint;
      readonly c2: ChassisPoint;
      readonly to: ChassisPoint;
    }
  | { readonly kind: "close" };

export type ChassisOutline = readonly ChassisSegment[];

const point = (x: number, y: number): ChassisPoint => ({ x, y });

/**
 * Continuous ("squircle") rounded rectangle. Each corner is three cubic Béziers
 * rather than an arc — that curvature ramp is what makes it read as an Apple
 * device instead of a rounded rect. The magic numbers are fixed multiples of the
 * corner radius and are not derivable from anything simpler.
 */
export function squircleOutline(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): ChassisOutline {
  const r = Math.min(radius, Math.min(w, h) / 3.06);
  const c1 = 1.528665 * r;
  const c2 = 1.088311 * r;
  const c3 = 0.868407 * r;
  const c4 = 0.631494 * r;
  const c5 = 0.372375 * r;
  const c6 = 0.16906 * r;
  const c7 = 0.066987 * r;

  const right = x + w;
  const bottom = y + h;
  const cubic = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ): ChassisSegment => ({ kind: "cubic", c1: point(ax, ay), c2: point(bx, by), to: point(cx, cy) });

  return [
    { kind: "move", to: point(x + c1, y) },
    { kind: "line", to: point(right - c1, y) },
    cubic(right - c2, y, right - c3, y, right - c4, y + c7),
    cubic(right - c5, y + c6, right - c6, y + c5, right - c7, y + c4),
    cubic(right, y + c3, right, y + c2, right, y + c1),
    { kind: "line", to: point(right, bottom - c1) },
    cubic(right, bottom - c2, right, bottom - c3, right - c7, bottom - c4),
    cubic(right - c6, bottom - c5, right - c5, bottom - c6, right - c4, bottom - c7),
    cubic(right - c3, bottom, right - c2, bottom, right - c1, bottom),
    { kind: "line", to: point(x + c1, bottom) },
    cubic(x + c2, bottom, x + c3, bottom, x + c4, bottom - c7),
    cubic(x + c5, bottom - c6, x + c6, bottom - c5, x + c7, bottom - c4),
    cubic(x, bottom - c3, x, bottom - c2, x, bottom - c1),
    { kind: "line", to: point(x, y + c1) },
    cubic(x, y + c2, x, y + c3, x + c7, y + c4),
    cubic(x + c6, y + c5, x + c5, y + c6, x + c4, y + c7),
    cubic(x + c3, y, x + c2, y, x + c1, y),
    { kind: "close" },
  ];
}

/**
 * Circular-corner rounded rect. Pixel and Galaxy read as Android, not Apple.
 *
 * The quarter-circles are emitted as the standard cubic approximation rather
 * than as SVG arcs, so the outline stays inside the four-primitive vocabulary
 * above. The approximation error peaks at about 0.02% of the radius — under a
 * hundredth of a pixel at these sizes.
 */
const ARC_KAPPA = 0.5522847498307936;

export function roundRectOutline(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): ChassisOutline {
  const r = Math.min(radius, Math.min(w, h) / 2);
  const k = ARC_KAPPA * r;
  const right = x + w;
  const bottom = y + h;
  const cubic = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ): ChassisSegment => ({ kind: "cubic", c1: point(ax, ay), c2: point(bx, by), to: point(cx, cy) });

  return [
    { kind: "move", to: point(x + r, y) },
    { kind: "line", to: point(right - r, y) },
    cubic(right - r + k, y, right, y + r - k, right, y + r),
    { kind: "line", to: point(right, bottom - r) },
    cubic(right, bottom - r + k, right - r + k, bottom, right - r, bottom),
    { kind: "line", to: point(x + r, bottom) },
    cubic(x + r - k, bottom, x, bottom - r + k, x, bottom - r),
    { kind: "line", to: point(x, y + r) },
    cubic(x, y + r - k, x + r - k, y, x + r, y),
    { kind: "close" },
  ];
}

const round3 = (value: number) => +value.toFixed(3);

/** Serializes an outline as SVG path data. */
export function outlineToSvgPath(outline: ChassisOutline): string {
  let out = "";
  for (const segment of outline) {
    switch (segment.kind) {
      case "move":
        out += `M${round3(segment.to.x)} ${round3(segment.to.y)}`;
        break;
      case "line":
        out += `L${round3(segment.to.x)} ${round3(segment.to.y)}`;
        break;
      case "cubic":
        out +=
          `C${round3(segment.c1.x)} ${round3(segment.c1.y)}` +
          ` ${round3(segment.c2.x)} ${round3(segment.c2.y)}` +
          ` ${round3(segment.to.x)} ${round3(segment.to.y)}`;
        break;
      case "close":
        out += "Z";
        break;
    }
  }
  return out;
}

// ── Metrics ──────────────────────────────────────────────────────────

export function chassisMetrics(kind: DeviceKind, pixelW?: number, pixelH?: number) {
  const spec = DEVICE_SPECS[kind];
  const edge = spec.frame + spec.silver + spec.grey;
  const margin = edge + spec.nubProtrude;
  return {
    spec,
    edge,
    margin,
    W: (pixelW ?? spec.pixelW) + 2 * margin,
    H: (pixelH ?? spec.pixelH) + 2 * margin,
  };
}

/**
 * Where the live screen sits inside the frame box. Percentages, so the caller
 * can size the box however it likes and the screen follows.
 */
export function screenGeometry(kind: DeviceKind = "iPhone", pixelW?: number, pixelH?: number) {
  const { spec, margin, W, H } = chassisMetrics(kind, pixelW, pixelH);
  const w = pixelW ?? spec.pixelW;
  const h = pixelH ?? spec.pixelH;
  return {
    aspect: W / H,
    insetXPct: (100 * margin) / W,
    insetYPct: (100 * margin) / H,
    // Percentage radii on both axes, so the corners stay circular under any aspect.
    screenBorderRadius: `${(100 * spec.screenRadius) / w}% / ${(100 * spec.screenRadius) / h}%`,
  };
}

// ── Assembled chassis ────────────────────────────────────────────────

/** A hardware nub as a rectangle in chassis coordinates, for extrusion and hit-testing. */
export type NubRect = {
  readonly name: string;
  readonly side: Nub["side"];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ChassisGeometry = {
  readonly W: number;
  readonly H: number;
  /** The three concentric bands and the screen aperture they surround. */
  readonly outer: ChassisOutline;
  readonly grey: ChassisOutline;
  readonly black: ChassisOutline;
  readonly cutout: ChassisOutline;
  /** The live screen rectangle, inside the aperture. */
  readonly screen: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly radius: number;
  };
  readonly nubs: readonly NubRect[];
};

export function chassisOutlines(
  kind: DeviceKind,
  pixelW?: number,
  pixelH?: number,
): ChassisGeometry {
  const { spec, edge, margin, W, H } = chassisMetrics(kind, pixelW, pixelH);
  const outline = spec.corner === "squircle" ? squircleOutline : roundRectOutline;
  const p = spec.nubProtrude;

  const bandAt = (inset: number) =>
    outline(
      p + inset,
      p + inset,
      W - 2 * (p + inset),
      H - 2 * (p + inset),
      spec.screenRadius + (edge - inset),
    );

  const nubs = spec.nubs.map(({ side, at, len, name }): NubRect => {
    switch (side) {
      case "left":
        return { name, side, x: 0, y: at, width: p, height: len };
      case "right":
        return { name, side, x: W - p, y: at, width: p, height: len };
      case "top":
        // A negative `at` is measured from the right edge.
        return { name, side, x: at >= 0 ? at : W + at - len, y: 0, width: len, height: p };
    }
  });

  return {
    W,
    H,
    outer: bandAt(0),
    grey: bandAt(spec.silver),
    black: bandAt(spec.silver + spec.grey),
    cutout: bandAt(edge),
    screen: {
      x: margin,
      y: margin,
      width: W - 2 * margin,
      height: H - 2 * margin,
      radius: spec.screenRadius,
    },
    nubs,
  };
}

/**
 * Hit rectangles for the drawn nubs, as percentages of the frame box. The SVG
 * already draws the hardware; these are the invisible controls laid over it,
 * deep enough (the full chassis margin) that a few pixels of protruding metal
 * are not the only thing to click.
 */
export function chassisNubHitRects(kind: DeviceKind, pixelW?: number, pixelH?: number) {
  const { spec, margin, W, H } = chassisMetrics(kind, pixelW, pixelH);
  return spec.nubs.map(({ side, at, len, name }) => {
    const depth = { x: (100 * margin) / W, y: (100 * margin) / H };
    const style =
      side === "top"
        ? {
            top: 0,
            height: `${depth.y}%`,
            left: `${(100 * (at >= 0 ? at : W + at - len)) / W}%`,
            width: `${(100 * len) / W}%`,
          }
        : {
            [side]: 0,
            width: `${depth.x}%`,
            top: `${(100 * at) / H}%`,
            height: `${(100 * len) / H}%`,
          };
    return { name, side, style };
  });
}

/**
 * Every nub the frame draws, and what pressing it does.
 *
 * `button` is what the press sends. A nub with no `button` is drawn metal with
 * a tooltip: it explains why there is nothing to press rather than offering a
 * control that would refuse, which is the state the pane must never ship. The
 * action button (the ring/silent switch's replacement) is the only such nub;
 * it maps to nothing the helper can inject.
 *
 * Apple puts volume up and down on two separate buttons. Pixel uses a single
 * volume rocker. Galaxy S26 Ultra keeps discrete volume up/down plus power,
 * all on the right rail.
 */
export const NUB_ACTIONS: Record<
  string,
  { readonly label: string; readonly button?: DeviceHardwareButton; readonly hint?: string }
> = {
  volumeUp: { label: "Volume up", button: "volume-up" },
  volumeDown: { label: "Volume down", button: "volume-down" },
  volumeRocker: { label: "Volume", button: "volume-up" },
  power: { label: "Lock", button: "lock" },
};
