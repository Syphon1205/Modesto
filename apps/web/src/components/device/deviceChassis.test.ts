import { describe, expect, it } from "vitest";

import {
  chassisMetrics,
  chassisNubHitRects,
  chassisOutlines,
  DEVICE_SPECS,
  deviceKindFor,
  outlineToSvgPath,
  roundRectOutline,
  screenGeometry,
  squircleOutline,
} from "./deviceChassis";

describe("deviceKindFor", () => {
  it("prefers the reported family over the device name", () => {
    expect(
      deviceKindFor({ platform: "ios-simulator", name: "iPhone 17 Pro Max", family: "tablet" }),
    ).toBe("iPad");
    expect(deviceKindFor({ platform: "ios-simulator", name: "iPad Pro", family: "phone" })).toBe(
      "iPhone",
    );
  });

  it("falls back to the name when no family is reported", () => {
    expect(deviceKindFor({ platform: "ios-simulator", name: "iPad Air 13-inch" })).toBe("iPad");
    expect(deviceKindFor({ platform: "ios-simulator", name: "iPhone 17" })).toBe("iPhone");
  });

  it("separates Samsung from Google on Android, ignoring family", () => {
    expect(
      deviceKindFor({ platform: "android-emulator", name: "Galaxy S26 Ultra", family: "phone" }),
    ).toBe("galaxy");
    expect(deviceKindFor({ platform: "android-emulator", name: "Pixel 10" })).toBe("pixel");
    // A Samsung tablet is still a Galaxy body; family only routes Apple devices.
    expect(
      deviceKindFor({ platform: "android-emulator", name: "Galaxy Tab", family: "tablet" }),
    ).toBe("galaxy");
  });
});

describe("outlineToSvgPath", () => {
  it("emits only the four primitives both renderers share", () => {
    const path = outlineToSvgPath(chassisOutlines("iPhone").outer);
    expect(path).toMatch(/^M/u);
    expect(path.endsWith("Z")).toBe(true);
    // Arcs and quadratics would break the THREE.Shape emitter, which has no
    // mapping for them.
    expect(path).not.toMatch(/[AQTSaqts]/u);
  });

  it("rounds coordinates so paths stay stable across runs", () => {
    const path = outlineToSvgPath(squircleOutline(0, 0, 100, 200, 30));
    for (const number of path.match(/-?\d+\.?\d*/gu) ?? []) {
      const decimals = number.split(".")[1] ?? "";
      expect(decimals.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("roundRectOutline", () => {
  it("closes back onto its starting point", () => {
    const outline = roundRectOutline(0, 0, 80, 160, 20);
    const first = outline[0];
    const last = outline.at(-2);
    expect(first?.kind).toBe("move");
    expect(last?.kind).toBe("cubic");
    if (first?.kind !== "move" || last?.kind !== "cubic") throw new Error("unexpected outline");
    expect(last.to.x).toBeCloseTo(first.to.x, 6);
    expect(last.to.y).toBeCloseTo(first.to.y, 6);
    expect(outline.at(-1)?.kind).toBe("close");
  });

  it("approximates each corner arc to well under a pixel", () => {
    // The corner cubics replaced true SVG arcs so one outline could feed both
    // the SVG and the 3D shape. This pins that swap as visually lossless.
    const radius = 72;
    const outline = roundRectOutline(0, 0, 400, 800, radius);
    const corner = outline[2];
    if (corner?.kind !== "cubic") throw new Error("expected a corner cubic");
    const start = { x: 400 - radius, y: 0 };
    const centre = { x: 400 - radius, y: radius };
    // Midpoint of a cubic is the average of its control polygon at t = 0.5.
    const mid = {
      x: (start.x + 3 * corner.c1.x + 3 * corner.c2.x + corner.to.x) / 8,
      y: (start.y + 3 * corner.c1.y + 3 * corner.c2.y + corner.to.y) / 8,
    };
    const distance = Math.hypot(mid.x - centre.x, mid.y - centre.y);
    expect(Math.abs(distance - radius)).toBeLessThan(radius * 0.0005);
  });

  it("never lets the radius exceed half the shorter side", () => {
    const outline = roundRectOutline(0, 0, 40, 40, 500);
    for (const segment of outline) {
      if (segment.kind === "close") continue;
      expect(segment.to.x).toBeGreaterThanOrEqual(-0.001);
      expect(segment.to.x).toBeLessThanOrEqual(40.001);
      expect(segment.to.y).toBeGreaterThanOrEqual(-0.001);
      expect(segment.to.y).toBeLessThanOrEqual(40.001);
    }
  });
});

describe("chassisOutlines", () => {
  it("sizes the box from the device's own pixels plus the chassis margin", () => {
    const { W, H, margin } = { ...chassisOutlines("pixel"), ...chassisMetrics("pixel") };
    const spec = DEVICE_SPECS.pixel;
    expect(W).toBe(spec.pixelW + 2 * margin);
    expect(H).toBe(spec.pixelH + 2 * margin);
  });

  it("follows a streamed resolution rather than the spec's nominal one", () => {
    const geometry = chassisOutlines("iPhone", 1179, 2556);
    const { margin } = chassisMetrics("iPhone", 1179, 2556);
    expect(geometry.screen.width).toBe(1179);
    expect(geometry.screen.height).toBe(2556);
    expect(geometry.screen.x).toBe(margin);
  });

  it("places nubs on the rail they belong to", () => {
    const geometry = chassisOutlines("iPhone");
    const spec = DEVICE_SPECS.iPhone;
    for (const nub of geometry.nubs) {
      if (nub.side === "left") expect(nub.x).toBe(0);
      if (nub.side === "right") expect(nub.x + nub.width).toBe(geometry.W);
      if (nub.side === "top") expect(nub.y).toBe(0);
      expect(Math.min(nub.width, nub.height)).toBe(spec.nubProtrude);
    }
  });

  it("measures a negative top offset from the right edge", () => {
    const geometry = chassisOutlines("iPad");
    const power = geometry.nubs.find((nub) => nub.name === "power");
    expect(power?.side).toBe("top");
    // The iPad's power button sits 148px in from the right, 126px long.
    expect(power?.x).toBe(geometry.W - 148 - 126);
  });
});

describe("screenGeometry", () => {
  it("insets the screen by the full chassis margin on both axes", () => {
    const geometry = screenGeometry("galaxy");
    const { margin, W, H } = chassisMetrics("galaxy");
    expect(geometry.insetXPct).toBeCloseTo((100 * margin) / W, 6);
    expect(geometry.insetYPct).toBeCloseTo((100 * margin) / H, 6);
    expect(geometry.aspect).toBeCloseTo(W / H, 6);
  });

  it("keeps corner radii circular under any aspect by splitting the two axes", () => {
    expect(screenGeometry("iPhone").screenBorderRadius).toContain("/");
  });
});

describe("chassisNubHitRects", () => {
  it("gives every drawn nub a target the full depth of the margin", () => {
    const rects = chassisNubHitRects("iPhone");
    expect(rects).toHaveLength(DEVICE_SPECS.iPhone.nubs.length);
    const { margin, W } = chassisMetrics("iPhone");
    const side = rects.find((rect) => rect.side === "left");
    expect(side?.style.width).toBe(`${(100 * margin) / W}%`);
  });
});
