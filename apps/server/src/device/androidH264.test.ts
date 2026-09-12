import { describe, expect, it } from "@effect/vitest";

import { AndroidH264Assembler, splitAnnexBNals } from "./androidH264.ts";

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

const start = new Uint8Array([0, 0, 0, 1]);
const sps = concat(start, new Uint8Array([0x67, 0x42, 0xc0, 0x1e]));
const pps = concat(start, new Uint8Array([0x68, 0xce, 0x38, 0x80]));
const idr = concat(start, new Uint8Array([0x65, 0x88, 0x80, 0x01]));
const delta = concat(start, new Uint8Array([0x41, 0x9a, 0x00, 0x02]));
const next = concat(start, new Uint8Array([0x01]));

describe("splitAnnexBNals", () => {
  it("keeps an incomplete trailing NAL in rest", () => {
    const split = splitAnnexBNals(concat(sps, pps));
    expect(split.nals).toHaveLength(1);
    expect([...split.nals[0]!]).toEqual([...sps]);
    expect([...split.rest]).toEqual([...pps]);
  });
});

describe("AndroidH264Assembler", () => {
  it("emits SPS/PPS as codecConfig then an IDR as a keyframe", () => {
    const assembler = new AndroidH264Assembler();
    const units = assembler.push(concat(sps, pps, idr, next));
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ codecConfig: true, keyframe: false });
    expect([...units[0]!.data]).toEqual([...concat(sps, pps)]);
    expect(units[1]).toMatchObject({ codecConfig: false, keyframe: true });
    expect([...units[1]!.data]).toEqual([...idr]);
  });

  it("tags non-IDR slices as delta frames", () => {
    const assembler = new AndroidH264Assembler();
    const units = assembler.push(concat(sps, pps, idr, delta, next));
    expect(
      units.map((unit) => ({ codecConfig: unit.codecConfig, keyframe: unit.keyframe })),
    ).toEqual([
      { codecConfig: true, keyframe: false },
      { codecConfig: false, keyframe: true },
      { codecConfig: false, keyframe: false },
    ]);
  });
});
