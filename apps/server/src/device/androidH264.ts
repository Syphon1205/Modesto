/**
 * Split Annex-B H.264 from `adb exec-out screenrecord --output-format=h264`.
 *
 * WebCodecs wants a codec-config blob (SPS/PPS) before any sample, then
 * keyframes vs deltas. Screenrecord emits start-code delimited NALs; this
 * folds parameter sets into one config frame and tags IDR as a keyframe.
 *
 * @module device/androidH264
 */

export interface AndroidH264Unit {
  readonly keyframe: boolean;
  readonly codecConfig: boolean;
  readonly data: Uint8Array;
}

const NAL_SPS = 7;
const NAL_PPS = 8;
const NAL_IDR = 5;

function startCodeLength(bytes: Uint8Array, offset: number): number {
  if (
    offset + 3 < bytes.byteLength &&
    bytes[offset] === 0 &&
    bytes[offset + 1] === 0 &&
    bytes[offset + 2] === 1
  ) {
    return 3;
  }
  if (
    offset + 4 < bytes.byteLength &&
    bytes[offset] === 0 &&
    bytes[offset + 1] === 0 &&
    bytes[offset + 2] === 0 &&
    bytes[offset + 3] === 1
  ) {
    return 4;
  }
  return 0;
}

function nextStartCode(bytes: Uint8Array, from: number): number {
  for (let index = from; index < bytes.byteLength - 2; index += 1) {
    if (startCodeLength(bytes, index) > 0) return index;
  }
  return -1;
}

function nalType(nal: Uint8Array): number {
  const prefix = startCodeLength(nal, 0);
  const header = nal[prefix];
  return header === undefined ? 0 : header & 0x1f;
}

/**
 * Pull complete NALs out of a rolling buffer. Incomplete trailing bytes stay
 * in `rest` until the next chunk arrives.
 */
export function splitAnnexBNals(buffer: Uint8Array): {
  readonly nals: readonly Uint8Array[];
  readonly rest: Uint8Array;
} {
  const first = nextStartCode(buffer, 0);
  if (first < 0) return { nals: [], rest: buffer };

  const nals: Uint8Array[] = [];
  let cursor = first;
  while (cursor < buffer.byteLength) {
    const prefix = startCodeLength(buffer, cursor);
    if (prefix === 0) break;
    const next = nextStartCode(buffer, cursor + prefix);
    if (next < 0) {
      return { nals, rest: buffer.subarray(cursor) };
    }
    nals.push(buffer.subarray(cursor, next));
    cursor = next;
  }
  return { nals, rest: new Uint8Array(0) };
}

export class AndroidH264Assembler {
  private remainder: Uint8Array = new Uint8Array(0);
  private pendingConfig: Uint8Array[] = [];

  push(chunk: Uint8Array): AndroidH264Unit[] {
    const combined = new Uint8Array(this.remainder.byteLength + chunk.byteLength);
    combined.set(this.remainder, 0);
    combined.set(chunk, this.remainder.byteLength);
    const split = splitAnnexBNals(combined);
    this.remainder = split.rest;

    const units: AndroidH264Unit[] = [];
    for (const nal of split.nals) {
      const type = nalType(nal);
      if (type === NAL_SPS || type === NAL_PPS) {
        this.pendingConfig.push(nal);
        continue;
      }
      if (this.pendingConfig.length > 0) {
        const total = this.pendingConfig.reduce((sum, part) => sum + part.byteLength, 0);
        const data = new Uint8Array(total);
        let offset = 0;
        for (const part of this.pendingConfig) {
          data.set(part, offset);
          offset += part.byteLength;
        }
        units.push({ keyframe: false, codecConfig: true, data });
        this.pendingConfig = [];
      }
      units.push({
        keyframe: type === NAL_IDR,
        codecConfig: false,
        data: nal,
      });
    }
    return units;
  }
}
