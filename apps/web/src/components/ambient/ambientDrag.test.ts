import { describe, expect, it } from "@effect/vitest";

import { exceedsDragThreshold } from "./ambientDrag.ts";

describe("exceedsDragThreshold", () => {
  it("treats sub-pixel jitter as a click, not a drag", () => {
    expect(exceedsDragThreshold(0, 0)).toBe(false);
    expect(exceedsDragThreshold(2, 1)).toBe(false);
  });

  it("treats real movement as a drag", () => {
    expect(exceedsDragThreshold(10, 0)).toBe(true);
    expect(exceedsDragThreshold(0, -10)).toBe(true);
    // 3-4-5 triangle: distance 5, over the default 4px threshold.
    expect(exceedsDragThreshold(3, 4)).toBe(true);
  });

  it("honors a custom threshold", () => {
    expect(exceedsDragThreshold(5, 0, 10)).toBe(false);
    expect(exceedsDragThreshold(11, 0, 10)).toBe(true);
  });
});
