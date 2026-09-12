import { expect, it } from "@effect/vitest";
import { Tool } from "effect/unstable/ai";

import { SimulatorToolkit } from "./tools.ts";

it("exports bounded object schemas for every iOS Simulator tool", () => {
  expect(Object.keys(SimulatorToolkit.tools)).toEqual([
    "simulator_list",
    "simulator_boot",
    "simulator_launch",
    "simulator_open_url",
    "simulator_describe_ui",
    "simulator_tap",
    "simulator_type",
    "simulator_swipe",
    "simulator_screenshot",
  ]);
  for (const tool of Object.values(SimulatorToolkit.tools)) {
    const schema = Tool.getJsonSchema(tool) as { readonly type?: unknown };
    expect(schema.type, `${tool.name} should expose an object input`).toBe("object");
    expect(tool.description?.length ?? 0).toBeGreaterThan(40);
  }
});
