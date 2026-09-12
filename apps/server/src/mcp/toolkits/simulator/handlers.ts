import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as Effect from "effect/Effect";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ProcessRunner from "../../../processRunner.ts";
import {
  IosSimulatorToolError,
  SimulatorScreenshotToolkit,
  SimulatorStandardToolkit,
  SimulatorToolkit,
  type IosSimulatorActionResult,
  type IosSimulatorDevice,
  type IosSimulatorScreenshot,
  type IosSimulatorStatus,
  type IosSimulatorUiDescription,
} from "./tools.ts";

const AXE_INSTALL_HINT = "Install AXe with: brew install cameroncooke/axe/axe";

const toolError = (operation: string, message: string) =>
  new IosSimulatorToolError({ operation, message });

const runCommand = Effect.fn("IosSimulator.runCommand")(function* (
  operation: string,
  command: string,
  args: ReadonlyArray<string>,
  timeout = "30 seconds",
) {
  yield* McpInvocationContext.requireMcpCapability("preview").pipe(
    Effect.mapError((cause) => toolError(operation, cause.message)),
  );
  const runner = yield* ProcessRunner.ProcessRunner;
  const result = yield* runner
    .run({
      command,
      args,
      timeout,
      maxOutputBytes: 4 * 1024 * 1024,
      outputMode: "truncate",
    })
    .pipe(Effect.mapError((cause) => toolError(operation, cause.message)));
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `Process exited ${result.code}`;
    return yield* toolError(operation, detail.slice(0, 4_000));
  }
  return result.stdout.trim();
});

interface SimctlDeviceRecord {
  readonly udid?: unknown;
  readonly name?: unknown;
  readonly state?: unknown;
  readonly isAvailable?: unknown;
}

const runtimeLabel = (identifier: string): string => {
  const match = identifier.match(/\.iOS-([\d-]+)$/);
  return match ? `iOS ${match[1]?.replaceAll("-", ".")}` : identifier;
};

export const decodeSimulatorDevices = (text: string): ReadonlyArray<IosSimulatorDevice> => {
  const parsed = JSON.parse(text) as { readonly devices?: unknown };
  if (typeof parsed.devices !== "object" || parsed.devices === null) return [];
  const devices: IosSimulatorDevice[] = [];
  for (const [runtime, entries] of Object.entries(parsed.devices)) {
    if (!runtime.includes(".iOS-") || !Array.isArray(entries)) continue;
    for (const candidate of entries as SimctlDeviceRecord[]) {
      if (
        candidate.isAvailable === false ||
        typeof candidate.udid !== "string" ||
        typeof candidate.name !== "string"
      ) {
        continue;
      }
      devices.push({
        udid: candidate.udid,
        name: candidate.name,
        runtime: runtimeLabel(runtime),
        state:
          candidate.state === "Booted"
            ? "Booted"
            : candidate.state === "Shutdown"
              ? "Shutdown"
              : "Other",
      });
    }
  }
  return devices;
};

const listDevices = Effect.fn("IosSimulator.listDevices")(function* () {
  const output = yield* runCommand(
    "list",
    "xcrun",
    ["simctl", "list", "devices", "available", "--json"],
    "15 seconds",
  );
  try {
    return decodeSimulatorDevices(output);
  } catch {
    return yield* toolError("list", "Simulator returned an unreadable device list.");
  }
});

const axeAvailable = Effect.fn("IosSimulator.axeAvailable")(function* () {
  const runner = yield* ProcessRunner.ProcessRunner;
  const result = yield* runner
    .run({ command: "/usr/bin/which", args: ["axe"], timeout: "5 seconds" })
    .pipe(Effect.catch(() => Effect.succeed(null)));
  return result?.code === 0;
});

const requireAxe = Effect.fn("IosSimulator.requireAxe")(function* (operation: string) {
  if (!(yield* axeAvailable())) return yield* toolError(operation, AXE_INSTALL_HINT);
});

const resolveUdid = Effect.fn("IosSimulator.resolveUdid")(function* (
  operation: string,
  requested: string | undefined,
) {
  if (requested) return requested;
  const booted = (yield* listDevices()).find((device) => device.state === "Booted");
  if (!booted) {
    return yield* toolError(
      operation,
      "No iOS Simulator is booted. Call simulator_list, then simulator_boot with a device UDID.",
    );
  }
  return booted.udid;
});

const actionResult = (udid: string, message: string): IosSimulatorActionResult => ({
  udid,
  message,
});

const list = Effect.fn("IosSimulator.list")(function* (input?: {
  readonly includeShutdown?: boolean | undefined;
}): Effect.fn.Return<
  IosSimulatorStatus,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  const devices = (yield* listDevices()).filter(
    (device) => input?.includeShutdown !== false || device.state === "Booted",
  );
  const hasAxe = yield* axeAvailable();
  return {
    available: true,
    interactionDriver: hasAxe ? "axe" : "lifecycle-only",
    interactionInstallHint: hasAxe ? null : AXE_INSTALL_HINT,
    devices,
  };
});

const boot = Effect.fn("IosSimulator.boot")(function* (input: {
  readonly udid: string;
  readonly reveal?: boolean | undefined;
}): Effect.fn.Return<
  IosSimulatorActionResult,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  const devices = yield* listDevices();
  const target = devices.find((device) => device.udid === input.udid);
  if (!target) return yield* toolError("boot", "The requested Simulator UDID is unavailable.");
  if (target.state !== "Booted") {
    yield* runCommand("boot", "xcrun", ["simctl", "boot", input.udid], "45 seconds");
  }
  yield* runCommand("boot", "xcrun", ["simctl", "bootstatus", input.udid, "-b"], "90 seconds");
  if (input.reveal !== false) {
    yield* runCommand("reveal", "open", ["-a", "Simulator"], "15 seconds");
  }
  return actionResult(input.udid, `${target.name} is booted and ready.`);
});

const launch = Effect.fn("IosSimulator.launch")(function* (input: {
  readonly udid?: string | undefined;
  readonly bundleId: string;
}): Effect.fn.Return<
  IosSimulatorActionResult,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  const udid = yield* resolveUdid("launch", input.udid);
  yield* runCommand("launch", "xcrun", ["simctl", "launch", udid, input.bundleId]);
  return actionResult(udid, `Launched ${input.bundleId}.`);
});

const openUrl = Effect.fn("IosSimulator.openUrl")(function* (input: {
  readonly udid?: string | undefined;
  readonly url: string;
}): Effect.fn.Return<
  IosSimulatorActionResult,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  const udid = yield* resolveUdid("open_url", input.udid);
  yield* runCommand("open_url", "xcrun", ["simctl", "openurl", udid, input.url]);
  return actionResult(udid, `Opened ${input.url}.`);
});

const describeUi = Effect.fn("IosSimulator.describeUi")(function* (input: {
  readonly udid?: string | undefined;
}): Effect.fn.Return<
  IosSimulatorUiDescription,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  yield* requireAxe("describe_ui");
  const udid = yield* resolveUdid("describe_ui", input.udid);
  const accessibilityTree = yield* runCommand(
    "describe_ui",
    "axe",
    ["describe-ui", "--udid", udid],
    "30 seconds",
  );
  return { udid, accessibilityTree: accessibilityTree.slice(0, 128_000) };
});

const tap = Effect.fn("IosSimulator.tap")(function* (input: {
  readonly udid?: string | undefined;
  readonly label?: string | undefined;
  readonly id?: string | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
}): Effect.fn.Return<
  IosSimulatorActionResult,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  yield* requireAxe("tap");
  const udid = yield* resolveUdid("tap", input.udid);
  const targetArgs = input.label
    ? ["--label", input.label]
    : input.id
      ? ["--id", input.id]
      : ["-x", String(input.x), "-y", String(input.y)];
  yield* runCommand("tap", "axe", ["tap", ...targetArgs, "--udid", udid]);
  return actionResult(udid, "Tapped the requested target.");
});

const typeText = Effect.fn("IosSimulator.type")(function* (input: {
  readonly udid?: string | undefined;
  readonly text: string;
}): Effect.fn.Return<
  IosSimulatorActionResult,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  yield* requireAxe("type");
  const udid = yield* resolveUdid("type", input.udid);
  yield* runCommand("type", "axe", ["type", input.text, "--udid", udid]);
  return actionResult(udid, "Typed text into the focused control.");
});

const swipe = Effect.fn("IosSimulator.swipe")(function* (input: {
  readonly udid?: string | undefined;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}): Effect.fn.Return<
  IosSimulatorActionResult,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  yield* requireAxe("swipe");
  const udid = yield* resolveUdid("swipe", input.udid);
  yield* runCommand("swipe", "axe", [
    "swipe",
    "--start-x",
    String(input.startX),
    "--start-y",
    String(input.startY),
    "--end-x",
    String(input.endX),
    "--end-y",
    String(input.endY),
    "--udid",
    udid,
  ]);
  return actionResult(udid, "Completed the swipe gesture.");
});

const pngDimensions = (data: Buffer): { readonly width: number; readonly height: number } =>
  data.length >= 24
    ? { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
    : { width: 0, height: 0 };

const screenshot = Effect.fn("IosSimulator.screenshot")(function* (input: {
  readonly udid?: string | undefined;
}): Effect.fn.Return<
  IosSimulatorScreenshot,
  IosSimulatorToolError,
  McpInvocationContext.McpInvocationContext | ProcessRunner.ProcessRunner
> {
  const udid = yield* resolveUdid("screenshot", input.udid);
  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "modesto-ios-simulator-"));
  const screenshotPath = NodePath.join(directory, "screen.png");
  return yield* Effect.gen(function* () {
    yield* runCommand(
      "screenshot",
      "xcrun",
      ["simctl", "io", udid, "screenshot", "--type=png", screenshotPath],
      "30 seconds",
    );
    let data: Buffer;
    try {
      data = NodeFS.readFileSync(screenshotPath);
    } catch {
      return yield* toolError("screenshot", "Simulator produced no readable screenshot.");
    }
    const dimensions = pngDimensions(data);
    return {
      udid,
      mimeType: "image/png" as const,
      data: data.toString("base64"),
      ...dimensions,
    };
  }).pipe(
    Effect.ensuring(Effect.sync(() => NodeFS.rmSync(directory, { recursive: true, force: true }))),
  );
});

const handlers = {
  simulator_list: () => list(),
  simulator_boot: boot,
  simulator_launch: launch,
  simulator_open_url: openUrl,
  simulator_describe_ui: describeUi,
  simulator_tap: tap,
  simulator_type: typeText,
  simulator_swipe: swipe,
  simulator_screenshot: screenshot,
} satisfies Parameters<typeof SimulatorToolkit.toLayer>[0];

const { simulator_screenshot, ...standardHandlers } = handlers;

export const SimulatorStandardToolkitHandlersLive =
  SimulatorStandardToolkit.toLayer(standardHandlers);

export const SimulatorScreenshotToolkitHandlersLive = SimulatorScreenshotToolkit.toLayer({
  simulator_screenshot,
});

export const SimulatorToolkitHandlersLive = SimulatorToolkit.toLayer(handlers);
