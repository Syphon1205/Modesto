import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ProcessRunner from "../../../processRunner.ts";

export const SimulatorUdid = Schema.String.check(Schema.isTrimmed())
  .check(Schema.isNonEmpty())
  .check(Schema.isMaxLength(128));

const SimulatorTargetInput = Schema.Struct({
  udid: Schema.optional(
    SimulatorUdid.annotate({
      description: "Simulator UDID. Omit to target the currently booted iOS Simulator.",
    }),
  ),
});

export const IosSimulatorDevice = Schema.Struct({
  udid: SimulatorUdid,
  name: Schema.String,
  runtime: Schema.String,
  state: Schema.Literals(["Booted", "Shutdown", "Other"]),
});
export type IosSimulatorDevice = typeof IosSimulatorDevice.Type;

export const IosSimulatorStatus = Schema.Struct({
  available: Schema.Boolean,
  interactionDriver: Schema.Literals(["axe", "lifecycle-only"]),
  interactionInstallHint: Schema.NullOr(Schema.String),
  devices: Schema.Array(IosSimulatorDevice),
}).annotate({
  description:
    "Available iOS Simulators and whether accessibility-driven interaction is installed.",
});
export type IosSimulatorStatus = typeof IosSimulatorStatus.Type;

export const IosSimulatorActionResult = Schema.Struct({
  udid: SimulatorUdid,
  message: Schema.String,
}).annotate({ description: "The iOS Simulator action completed successfully." });
export type IosSimulatorActionResult = typeof IosSimulatorActionResult.Type;

export const IosSimulatorUiDescription = Schema.Struct({
  udid: SimulatorUdid,
  accessibilityTree: Schema.String,
}).annotate({ description: "A bounded accessibility description of the current Simulator UI." });
export type IosSimulatorUiDescription = typeof IosSimulatorUiDescription.Type;

export const IosSimulatorScreenshot = Schema.Struct({
  udid: SimulatorUdid,
  mimeType: Schema.Literal("image/png"),
  data: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
}).annotate({ description: "A PNG screenshot captured directly from iOS Simulator." });
export type IosSimulatorScreenshot = typeof IosSimulatorScreenshot.Type;

export class IosSimulatorToolError extends Schema.TaggedErrorClass<IosSimulatorToolError>()(
  "IosSimulatorToolError",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

const dependencies: [
  typeof McpInvocationContext.McpInvocationContext,
  typeof ProcessRunner.ProcessRunner,
] = [McpInvocationContext.McpInvocationContext, ProcessRunner.ProcessRunner];

const simulatorTool = <T extends Tool.Any>(tool: T): T =>
  tool.annotate(Tool.OpenWorld, false).annotate(Tool.Destructive, false) as T;

const readonlySimulatorTool = <T extends Tool.Any>(tool: T): T =>
  simulatorTool(tool).annotate(Tool.Readonly, true).annotate(Tool.Idempotent, true) as T;

export const SimulatorListTool = readonlySimulatorTool(
  Tool.make("simulator_list", {
    description:
      "List locally available iOS Simulators, their boot state, and whether the optional AXe accessibility interaction driver is installed.",
    parameters: Schema.Struct({
      includeShutdown: Schema.optional(
        Schema.Boolean.annotate({
          description: "Include available devices that are not currently booted. Defaults to true.",
        }),
      ),
    }),
    success: IosSimulatorStatus,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "List iOS Simulators"),
);

export const SimulatorBootTool = simulatorTool(
  Tool.make("simulator_boot", {
    description:
      "Boot one iOS Simulator by UDID and wait until it is ready. This reuses an already booted device instead of rebuilding an app.",
    parameters: Schema.Struct({
      udid: SimulatorUdid.annotate({ description: "Exact Simulator UDID from simulator_list." }),
      reveal: Schema.optional(
        Schema.Boolean.annotate({
          description: "Open Simulator.app after booting. Defaults to true.",
        }),
      ),
    }),
    success: IosSimulatorActionResult,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Boot iOS Simulator"),
);

export const SimulatorLaunchTool = simulatorTool(
  Tool.make("simulator_launch", {
    description: "Launch an already installed iOS app in a booted Simulator without rebuilding it.",
    parameters: Schema.Struct({
      ...SimulatorTargetInput.fields,
      bundleId: Schema.String.check(Schema.isTrimmed())
        .check(Schema.isNonEmpty())
        .check(Schema.isMaxLength(255))
        .annotate({ description: "Installed application bundle identifier to launch." }),
    }),
    success: IosSimulatorActionResult,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Launch iOS app"),
);

export const SimulatorOpenUrlTool = simulatorTool(
  Tool.make("simulator_open_url", {
    description: "Open an http, https, or application deep-link URL in a booted iOS Simulator.",
    parameters: Schema.Struct({
      ...SimulatorTargetInput.fields,
      url: Schema.String.check(Schema.isTrimmed())
        .check(Schema.isNonEmpty())
        .check(Schema.isMaxLength(2_048))
        .annotate({ description: "URL or app deep link to open in the Simulator." }),
    }),
    success: IosSimulatorActionResult,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Open URL in iOS Simulator"),
);

export const SimulatorDescribeUiTool = readonlySimulatorTool(
  Tool.make("simulator_describe_ui", {
    description:
      "Inspect the current iOS Simulator accessibility tree with AXe before interacting. Returns an installation hint when AXe is unavailable.",
    parameters: SimulatorTargetInput,
    success: IosSimulatorUiDescription,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Inspect iOS Simulator"),
);

export const SimulatorTapTool = simulatorTool(
  Tool.make("simulator_tap", {
    description:
      "Tap one iOS Simulator target with AXe, preferably by accessibility label or identifier and only by coordinates as a fallback.",
    parameters: Schema.Struct({
      ...SimulatorTargetInput.fields,
      label: Schema.optional(
        Schema.String.check(Schema.isTrimmed()).check(Schema.isNonEmpty()).annotate({
          description: "Accessibility label to tap.",
        }),
      ),
      id: Schema.optional(
        Schema.String.check(Schema.isTrimmed()).check(Schema.isNonEmpty()).annotate({
          description: "Accessibility identifier to tap.",
        }),
      ),
      x: Schema.optional(
        Schema.Finite.annotate({ description: "Fallback device-point x coordinate." }),
      ),
      y: Schema.optional(
        Schema.Finite.annotate({ description: "Fallback device-point y coordinate." }),
      ),
    }).check(
      Schema.makeFilter((input) => {
        const coordinatePair = input.x !== undefined && input.y !== undefined;
        const choices =
          Number(input.label !== undefined) +
          Number(input.id !== undefined) +
          Number(coordinatePair);
        if ((input.x === undefined) !== (input.y === undefined)) return "Provide x and y together.";
        return choices === 1 || "Provide exactly one of label, id, or an x/y coordinate pair.";
      }),
    ),
    success: IosSimulatorActionResult,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Tap iOS Simulator"),
);

export const SimulatorTypeTool = simulatorTool(
  Tool.make("simulator_type", {
    description:
      "Type text into the focused iOS Simulator control with AXe. Inspect and tap the field first when focus is uncertain.",
    parameters: Schema.Struct({
      ...SimulatorTargetInput.fields,
      text: Schema.String.check(Schema.isMaxLength(8_000)).annotate({
        description: "Text to type into the focused Simulator control.",
      }),
    }),
    success: IosSimulatorActionResult,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Type in iOS Simulator"),
);

export const SimulatorSwipeTool = simulatorTool(
  Tool.make("simulator_swipe", {
    description: "Swipe between two device-point coordinates in the booted iOS Simulator with AXe.",
    parameters: Schema.Struct({
      ...SimulatorTargetInput.fields,
      startX: Schema.Finite.annotate({ description: "Swipe starting x coordinate." }),
      startY: Schema.Finite.annotate({ description: "Swipe starting y coordinate." }),
      endX: Schema.Finite.annotate({ description: "Swipe ending x coordinate." }),
      endY: Schema.Finite.annotate({ description: "Swipe ending y coordinate." }),
    }),
    success: IosSimulatorActionResult,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Swipe iOS Simulator"),
);

export const SimulatorScreenshotTool = readonlySimulatorTool(
  Tool.make("simulator_screenshot", {
    description:
      "Capture the current booted iOS Simulator screen as a PNG image for visual inspection without rebuilding the app.",
    parameters: SimulatorTargetInput,
    success: IosSimulatorScreenshot,
    failure: IosSimulatorToolError,
    dependencies,
  }).annotate(Tool.Title, "Capture iOS Simulator"),
);

export const SimulatorToolkit = Toolkit.make(
  SimulatorListTool,
  SimulatorBootTool,
  SimulatorLaunchTool,
  SimulatorOpenUrlTool,
  SimulatorDescribeUiTool,
  SimulatorTapTool,
  SimulatorTypeTool,
  SimulatorSwipeTool,
  SimulatorScreenshotTool,
);

export const SimulatorStandardToolkit = Toolkit.make(
  SimulatorListTool,
  SimulatorBootTool,
  SimulatorLaunchTool,
  SimulatorOpenUrlTool,
  SimulatorDescribeUiTool,
  SimulatorTapTool,
  SimulatorTypeTool,
  SimulatorSwipeTool,
);

export const SimulatorScreenshotToolkit = Toolkit.make(SimulatorScreenshotTool);
