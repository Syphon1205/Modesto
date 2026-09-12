import { describe, expect, it } from "vite-plus/test";

import {
  CONNECTIONS_HERO_LOGO_IDS,
  HERO_VISIBLE_SLOTS,
  heroCarouselOffset,
  heroCarouselSlotDepthIndex,
  heroCarouselSlotOpacity,
  heroCarouselSlotTransform,
} from "./ConnectionsHeroStage.logic";

describe("heroCarouselOffset", () => {
  it("keeps the active logo in the center slot", () => {
    expect(heroCarouselOffset(2, 2, 12)).toBe(0);
  });

  it("places neighbours on the left and right", () => {
    expect(heroCarouselOffset(1, 2, 12)).toBe(-1);
    expect(heroCarouselOffset(3, 2, 12)).toBe(1);
  });

  it("wraps the ring so the last logo sits left of the first", () => {
    const last = CONNECTIONS_HERO_LOGO_IDS.length - 1;
    expect(heroCarouselOffset(last, 0, CONNECTIONS_HERO_LOGO_IDS.length)).toBe(-1);
    expect(heroCarouselOffset(0, last, CONNECTIONS_HERO_LOGO_IDS.length)).toBe(1);
  });
});

describe("heroCarouselSlotTransform", () => {
  it("gives the center, left, and right logos distinct 3d poses", () => {
    const center = heroCarouselSlotTransform(0);
    const left = heroCarouselSlotTransform(-1);
    const right = heroCarouselSlotTransform(1);
    expect(center).toContain("rotateY(0deg)");
    expect(left).toContain("rotateY(38deg)");
    expect(right).toContain("rotateY(-38deg)");
    expect(new Set([center, left, right]).size).toBe(3);
  });

  it("mirrors the two sides so the arc is symmetric", () => {
    expect(heroCarouselSlotTransform(-1)).toBe(
      "translate3d(-5.65rem, 0rem, -3.2rem) rotateY(38deg)",
    );
    expect(heroCarouselSlotTransform(1)).toBe(
      "translate3d(5.65rem, 0rem, -3.2rem) rotateY(-38deg)",
    );
    expect(heroCarouselSlotTransform(-2)).toBe(
      "translate3d(-9.1rem, 0rem, -9.5rem) rotateY(52deg)",
    );
    expect(heroCarouselSlotTransform(2)).toBe("translate3d(9.1rem, 0rem, -9.5rem) rotateY(-52deg)");
  });

  it("does not tilt tiles - the stage owns the single shared rotateX", () => {
    for (const offset of [-2, -1, 0, 1, 2]) {
      expect(heroCarouselSlotTransform(offset)).not.toContain("rotateX");
      expect(heroCarouselSlotTransform(offset)).not.toContain("scale");
    }
  });

  it("clamps slots past the visible band onto the outermost pose", () => {
    expect(heroCarouselSlotTransform(5)).toBe(heroCarouselSlotTransform(HERO_VISIBLE_SLOTS));
    expect(heroCarouselSlotTransform(-5)).toBe(heroCarouselSlotTransform(-HERO_VISIBLE_SLOTS));
  });
});

describe("heroCarouselSlotOpacity", () => {
  it("fades tiles back with depth and hides everything past the band", () => {
    expect(heroCarouselSlotOpacity(0)).toBe(1);
    expect(heroCarouselSlotOpacity(1)).toBeGreaterThan(heroCarouselSlotOpacity(2));
    expect(heroCarouselSlotOpacity(HERO_VISIBLE_SLOTS + 1)).toBe(0);
  });

  it("treats both sides the same", () => {
    expect(heroCarouselSlotOpacity(-1)).toBe(heroCarouselSlotOpacity(1));
    expect(heroCarouselSlotOpacity(-2)).toBe(heroCarouselSlotOpacity(2));
  });
});

describe("heroCarouselSlotDepthIndex", () => {
  it("paints nearer tiles over further ones", () => {
    expect(heroCarouselSlotDepthIndex(0)).toBeGreaterThan(heroCarouselSlotDepthIndex(1));
    expect(heroCarouselSlotDepthIndex(1)).toBeGreaterThan(heroCarouselSlotDepthIndex(2));
    expect(heroCarouselSlotDepthIndex(-1)).toBe(heroCarouselSlotDepthIndex(1));
  });
});
