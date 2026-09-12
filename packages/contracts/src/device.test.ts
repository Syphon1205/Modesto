import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { DeviceUiNode } from "./device.ts";

// RPC must encode recursive UI trees without requiring additional runtime services.
const encodeNode = Schema.encodeSync(DeviceUiNode);
const decodeNode = Schema.decodeUnknownSync(DeviceUiNode);

const child: DeviceUiNode = {
  role: "Button",
  subrole: null,
  label: "Continue",
  value: null,
  frame: { x: 10, y: 20, width: 100, height: 44 },
  activationPoint: { x: 60, y: 42 },
  children: [],
};

describe("device UI node codec", () => {
  it("round-trips nested accessibility trees without services", () => {
    const root: DeviceUiNode = {
      ...child,
      role: "Window",
      label: null,
      activationPoint: null,
      children: [child],
    };
    const encoded = JSON.parse(JSON.stringify(encodeNode(root)));
    expect(decodeNode(encoded)).toEqual(root);
  });

  it("rejects invalid geometry inside nested nodes", () => {
    expect(() =>
      decodeNode({ ...child, children: [{ ...child, frame: { ...child.frame, width: -1 } }] }),
    ).toThrow();
  });
});
