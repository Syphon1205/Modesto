import { useAtomValue } from "@effect/atom-react";
import type {
  DeviceDescriptor,
  DeviceHardwareButton,
  EnvironmentId,
  ThreadId,
} from "@modesto/contracts";
import * as Cause from "effect/Cause";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  Camera,
  CircleStop,
  Home,
  LoaderCircle,
  Power,
  Rotate3d,
  RotateCw,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toastManager } from "~/components/ui/toast";
import { selectThreadDeviceState, useDeviceStateStore } from "~/deviceStateStore";
import { cn } from "~/lib/utils";
import { readLocalApi } from "~/localApi";
import { deviceEnvironment } from "~/state/device";
import { usePreparedConnection } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";

import {
  buildDevicePickerEntries,
  buildMakerModelOptions,
  canvasPointToDevicePoint,
  chassisForMaker,
  defaultDeviceMaker,
  describeDegradedCapabilities,
  DEVICE_MAKERS,
  deviceAttachStatusLabel,
  deviceHidUsageForKey,
  deviceKeyModifiers,
  deviceMakerFor,
  makerChooserCopy,
  modelChooserCopy,
  presentDeviceSetup,
  resolveDeviceHardwareButtonShortcut,
  resolveDevicePointSize,
  resolveDevicePointerGesture,
  resolveDeviceSetupAction,
  resolveDisplayedDevice,
  setupProbeCopy,
  setupScreenCopy,
  setupStepsForMaker,
  shouldShowDeviceSetup,
  type DeviceMakerId,
  type DevicePoint,
  type PendingDeviceSelection,
} from "./DevicePanel.logic";
import { DeviceChooserScreen, DeviceStatusScreen } from "./device/DeviceChooserScreen";
import { NUB_ACTIONS } from "./device/deviceChassis";
import { deviceModelFor } from "./device/deviceModelRegistry";
import { DeviceScreen, deviceKindFor } from "./device/DeviceFrame";
import { DeviceSetupScreen } from "./device/DeviceSetupScreen";
import { DeviceStage, type DeviceStagePress } from "./device/DeviceStage";
import type { DeviceStageSource } from "./device/DeviceStage3d";
import { useDeviceMotionSync } from "./device/useDeviceMotionSync";
import { useDeviceVideoStream } from "./device/useDeviceVideoStream";

function commandFailure(
  result: Exclude<Awaited<ReturnType<ReturnType<typeof useAtomCommand>>>, never>,
): string {
  if (AsyncResult.isSuccess(result)) return "";
  const error = Cause.squash(result.cause);
  return error instanceof Error && error.message ? error.message : "The simulator action failed.";
}

function showFailure(title: string, description: string) {
  toastManager.add({ type: "error", title, description });
}

function DeviceActionButton(props: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        props.active && "bg-destructive/10 text-destructive",
      )}
    >
      {props.children}
    </button>
  );
}

export default function DevicePanel(props: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  visible: boolean;
}) {
  const stateResult = useAtomValue(
    deviceEnvironment.state({
      environmentId: props.environmentId,
      input: { threadId: props.threadId },
    }),
  );
  const eventResult = useAtomValue(
    deviceEnvironment.events({ environmentId: props.environmentId, input: {} }),
  );
  const threadState = useDeviceStateStore(selectThreadDeviceState(props.threadId));
  const upsertThreadState = useDeviceStateStore((state) => state.upsertThreadState);
  const preparedConnection = usePreparedConnection(props.environmentId);

  useEffect(() => {
    if (AsyncResult.isSuccess(stateResult)) upsertThreadState(stateResult.value);
  }, [stateResult, upsertThreadState]);
  useEffect(() => {
    if (!AsyncResult.isSuccess(eventResult)) return;
    if (eventResult.value.type !== "device.thread-state") return;
    if (eventResult.value.state.threadId !== props.threadId) return;
    upsertThreadState(eventResult.value.state);
  }, [eventResult, props.threadId, upsertThreadState]);

  const boot = useAtomCommand(deviceEnvironment.boot, { reportFailure: false });
  const attach = useAtomCommand(deviceEnvironment.attach, { reportFailure: false });
  const detach = useAtomCommand(deviceEnvironment.detach, { reportFailure: false });
  const shutdown = useAtomCommand(deviceEnvironment.shutdown, { reportFailure: false });
  const tap = useAtomCommand(deviceEnvironment.tap, { reportFailure: false });
  const swipe = useAtomCommand(deviceEnvironment.swipe, { reportFailure: false });
  const keyEvent = useAtomCommand(deviceEnvironment.keyEvent, { reportFailure: false });
  const pressButton = useAtomCommand(deviceEnvironment.pressButton, { reportFailure: false });
  const setGravity = useAtomCommand(deviceEnvironment.setGravity, { reportFailure: false });
  const screenshot = useAtomCommand(deviceEnvironment.screenshot, { reportFailure: false });
  const startRecording = useAtomCommand(deviceEnvironment.startRecording, { reportFailure: false });
  const stopRecording = useAtomCommand(deviceEnvironment.stopRecording, { reportFailure: false });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerStart = useRef<{ point: DevicePoint | null; at: number } | null>(null);
  // Set by the 3D stage while free look is engaged, so a decoded frame schedules
  // a redraw without passing through React.
  const stageFrameSignal = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [freeLook, setFreeLook] = useState(false);
  const [stageSource, setStageSource] = useState<DeviceStageSource>("procedural");
  const [recording, setRecording] = useState(false);
  const [maker, setMaker] = useState<DeviceMakerId | null>(null);
  const [pending, setPending] = useState<PendingDeviceSelection | null>(null);

  const displayedDevice = useMemo(
    () => resolveDisplayedDevice({ threadState, pending }),
    [pending, threadState],
  );
  const attachedDevice = displayedDevice;
  const pickerEntries = useMemo(
    () =>
      buildDevicePickerEntries({
        devices: threadState?.devices ?? [],
        attachedDeviceUdid: threadState?.attachedDeviceUdid ?? null,
      }),
    [threadState],
  );
  const attachedMaker = attachedDevice ? deviceMakerFor(attachedDevice) : null;
  const resolvedMaker = maker ?? attachedMaker ?? defaultDeviceMaker(pickerEntries);
  const modelOptions = useMemo(
    () => (resolvedMaker ? buildMakerModelOptions(pickerEntries, resolvedMaker) : []),
    [pickerEntries, resolvedMaker],
  );
  const availabilitySteps =
    threadState?.availability.kind === "setup-required" ? threadState.availability.steps : [];
  const makerSteps = resolvedMaker ? setupStepsForMaker(availabilitySteps, resolvedMaker) : [];
  const setup = presentDeviceSetup(makerSteps, resolvedMaker ?? "apple");
  const setupCopy = resolvedMaker ? setupScreenCopy(resolvedMaker) : null;
  const setupAction = resolveDeviceSetupAction(makerSteps);
  const makerNeedsSetup = shouldShowDeviceSetup({
    threadState,
    hasMakerDevices: modelOptions.some((option) => option.device !== null),
    makerSteps,
  });
  const selectedModelId =
    attachedDevice && attachedMaker === resolvedMaker ? attachedDevice.udid : "";
  const socketUrl = preparedConnection._tag === "Some" ? preparedConnection.value.socketUrl : null;
  const video = useDeviceVideoStream({
    canvasRef,
    udid: attachedDevice?.udid ?? null,
    enabled:
      props.visible &&
      attachedDevice?.state === "booted" &&
      threadState?.attachedDeviceUdid === attachedDevice.udid,
    socketUrl,
    onFrame: useCallback(() => stageFrameSignal.current?.(), []),
  });

  const run = useCallback(async (operation: () => Promise<void>, title: string) => {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      showFailure(title, error instanceof Error ? error.message : "The simulator action failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const selectDevice = useCallback(
    (device: DeviceDescriptor) => {
      setPending({
        device,
        supersedes: threadState?.attachedDeviceUdid ?? null,
      });
      void run(async () => {
        try {
          let udid = device.udid;
          if (device.state !== "booted") {
            const bootResult = await boot({
              environmentId: props.environmentId,
              input: { udid: device.udid },
            });
            if (!AsyncResult.isSuccess(bootResult))
              throw new Error(commandFailure(bootResult as never));
            if (bootResult.value.kind === "boot-limit-reached") {
              throw new Error(
                `Modesto already started ${bootResult.value.limit} simulators. Shut one down and try again.`,
              );
            }
            udid = bootResult.value.device.udid;
          }
          const result = await attach({
            environmentId: props.environmentId,
            input: { threadId: props.threadId, udid },
          });
          if (result._tag !== "Success") throw new Error(commandFailure(result as never));
          upsertThreadState(result.value);
        } finally {
          setPending(null);
        }
      }, "Could not open the simulator");
    },
    [
      attach,
      boot,
      props.environmentId,
      props.threadId,
      run,
      threadState?.attachedDeviceUdid,
      upsertThreadState,
    ],
  );

  const press = useCallback(
    (button: DeviceHardwareButton) => {
      if (!attachedDevice) return;
      void pressButton({
        environmentId: props.environmentId,
        input: { udid: attachedDevice.udid, button },
      }).then((result) => {
        if (!AsyncResult.isSuccess(result))
          showFailure("Simulator input failed", commandFailure(result as never));
      });
    },
    [attachedDevice, pressButton, props.environmentId],
  );

  // ── Free look ──────────────────────────────────────────────────────

  const supportsMotion = attachedDevice?.supportsMotion === true;
  const motion = useDeviceMotionSync({
    enabled: freeLook && supportsMotion && attachedDevice !== null,
    send: useCallback(
      (gravity) => {
        if (!attachedDevice) return;
        void setGravity({
          environmentId: props.environmentId,
          input: { udid: attachedDevice.udid, ...gravity },
        });
      },
      [attachedDevice, props.environmentId, setGravity],
    ),
  });

  /**
   * Normalized stage coordinates to device points, through the same contain-fit
   * and rounding the flat canvas uses. A 1x1 display box makes `u`/`v` the
   * fractions the mapper already expects, so the two input paths cannot drift.
   */
  const pointFromStage = useCallback(
    (u: number, v: number): DevicePoint | null => {
      if (!video.dimensions || !attachedDevice) return null;
      const pointSize = resolveDevicePointSize({
        framePixelWidth: video.dimensions.width,
        framePixelHeight: video.dimensions.height,
        geometry: attachedDevice.geometry,
      });
      return canvasPointToDevicePoint(
        {
          frameWidth: video.dimensions.width,
          frameHeight: video.dimensions.height,
          displayWidth: 1,
          displayHeight: 1,
          ...(pointSize
            ? { devicePointWidth: pointSize.width, devicePointHeight: pointSize.height }
            : {}),
        },
        u,
        v,
      );
    },
    [attachedDevice, video.dimensions],
  );

  const pointFromPointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): DevicePoint | null => {
      const canvas = canvasRef.current;
      if (!canvas || !video.dimensions || !attachedDevice) return null;
      const rect = canvas.getBoundingClientRect();
      const pointSize = resolveDevicePointSize({
        framePixelWidth: video.dimensions.width,
        framePixelHeight: video.dimensions.height,
        geometry: attachedDevice.geometry,
      });
      return canvasPointToDevicePoint(
        {
          frameWidth: video.dimensions.width,
          frameHeight: video.dimensions.height,
          displayWidth: rect.width,
          displayHeight: rect.height,
          ...(pointSize
            ? { devicePointWidth: pointSize.width, devicePointHeight: pointSize.height }
            : {}),
        },
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    [attachedDevice, video.dimensions],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { point: pointFromPointer(event), at: performance.now() };
  };
  /**
   * The one place a completed press becomes guest input. Both the flat canvas
   * and the 3D stage resolve their own coordinates and then land here, so the
   * tap-versus-swipe threshold is applied once and the two views cannot
   * disagree about what a drag meant.
   */
  const sendGesture = useCallback(
    (input: { from: DevicePoint | null; to: DevicePoint | null; durationMs: number }) => {
      if (!attachedDevice) return;
      const gesture = resolveDevicePointerGesture(input);
      if (!gesture) return;
      if (gesture.kind === "tap") {
        void tap({
          environmentId: props.environmentId,
          input: { udid: attachedDevice.udid, x: gesture.point.x, y: gesture.point.y },
        });
        return;
      }
      void swipe({
        environmentId: props.environmentId,
        input: {
          udid: attachedDevice.udid,
          fromX: gesture.from.x,
          fromY: gesture.from.y,
          toX: gesture.to.x,
          toY: gesture.to.y,
          durationMs: gesture.durationMs,
        },
      });
    },
    [attachedDevice, props.environmentId, swipe, tap],
  );

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    sendGesture({
      from: start.point,
      to: pointFromPointer(event),
      durationMs: performance.now() - start.at,
    });
  };

  const handleStagePress = useCallback(
    (press: DeviceStagePress) => {
      sendGesture({
        from: pointFromStage(press.from.u, press.from.v),
        to: press.to ? pointFromStage(press.to.u, press.to.v) : null,
        durationMs: press.durationMs,
      });
    },
    [pointFromStage, sendGesture],
  );

  /**
   * A 3D nub carries the same action name the flat frame's nubs do, so the
   * press goes through the identical mapping — a button that does nothing in
   * one view does nothing in the other, rather than silently diverging.
   */
  const handleStageButton = useCallback(
    (name: string) => {
      const action = NUB_ACTIONS[name];
      if (action?.button) press(action.button);
    },
    [press],
  );

  const handleKey = (event: React.KeyboardEvent<HTMLCanvasElement>, direction: "down" | "up") => {
    if (!attachedDevice) return;
    const shortcut = resolveDeviceHardwareButtonShortcut(event);
    if (shortcut) {
      if (direction === "down") press(shortcut);
      event.preventDefault();
      return;
    }
    if (event.metaKey) return;
    const keyCode = deviceHidUsageForKey(event.key);
    if (keyCode === null) return;
    event.preventDefault();
    void keyEvent({
      environmentId: props.environmentId,
      input: {
        udid: attachedDevice.udid,
        keyCode,
        modifiers: deviceKeyModifiers(event),
        direction,
      },
    });
  };

  const captureScreenshot = () => {
    if (!attachedDevice) return;
    void screenshot({
      environmentId: props.environmentId,
      input: { udid: attachedDevice.udid, save: true },
    }).then((result) => {
      if (!AsyncResult.isSuccess(result)) {
        showFailure("Screenshot failed", commandFailure(result as never));
        return;
      }
      toastManager.add({
        type: "success",
        title: "Screenshot saved",
        description: result.value.path ?? "The simulator screenshot was captured.",
      });
    });
  };

  const toggleRecording = () => {
    if (!attachedDevice || busy) return;
    void run(
      async () => {
        const result = recording
          ? await stopRecording({
              environmentId: props.environmentId,
              input: { udid: attachedDevice.udid },
            })
          : await startRecording({
              environmentId: props.environmentId,
              input: { udid: attachedDevice.udid },
            });
        if (result._tag !== "Success") throw new Error(commandFailure(result as never));
        setRecording(!recording);
        if (recording) {
          toastManager.add({
            type: "success",
            title: "Recording saved",
            description: result.value.path,
          });
        }
      },
      recording ? "Could not stop recording" : "Could not start recording",
    );
  };

  const detachDevice = () => {
    void run(async () => {
      const result = await detach({
        environmentId: props.environmentId,
        input: { threadId: props.threadId },
      });
      if (result._tag !== "Success") throw new Error(commandFailure(result as never));
      upsertThreadState(result.value);
      setRecording(false);
    }, "Could not detach the simulator");
  };

  const shutdownDevice = () => {
    if (!attachedDevice) return;
    void run(async () => {
      const result = await shutdown({
        environmentId: props.environmentId,
        input: { udid: attachedDevice.udid },
      });
      if (result._tag !== "Success") throw new Error(commandFailure(result as never));
    }, "Could not shut down the simulator");
  };

  const pickModel = (id: string) => {
    const option = modelOptions.find((item) => item.id === id);
    if (option?.device) selectDevice(option.device);
  };

  const attachStatus = attachedDevice
    ? deviceAttachStatusLabel({
        phase: threadState?.attachPhase,
        deviceState: attachedDevice.state,
        pendingSelection: pending !== null,
        deviceName: attachedDevice.name,
      })
    : null;

  const screen =
    resolvedMaker === null ? (
      <DeviceChooserScreen
        title={makerChooserCopy().title}
        description={makerChooserCopy().description}
        options={DEVICE_MAKERS.map((item) => ({
          id: item.id,
          label: item.label,
          detail: item.product,
        }))}
        onPick={(id) => setMaker(id as DeviceMakerId)}
      />
    ) : attachedDevice && attachedMaker === resolvedMaker ? (
      <div className="relative h-full w-full bg-black">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label={`${attachedDevice.name} simulator screen`}
          className="h-full w-full touch-none object-contain outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onKeyDown={(event) => handleKey(event, "down")}
          onKeyUp={(event) => handleKey(event, "up")}
        />
        {video.status.kind !== "streaming" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-white/60">
            <LoaderCircle className="mr-2 size-3.5 animate-spin" />
            {video.status.kind === "error" ? video.status.message : (attachStatus ?? "Connecting…")}
          </div>
        ) : null}
      </div>
    ) : makerNeedsSetup && setupCopy ? (
      <DeviceSetupScreen
        title={setupCopy.title}
        description={setupCopy.description}
        trademark={setupCopy.trademark}
        cards={setup.cards}
        checking={setup.checking}
        actionLabel={setupAction?.label ?? null}
        onAction={
          setupAction ? () => void readLocalApi()?.shell.openExternal(setupAction.url) : null
        }
      />
    ) : !threadState ? (
      <DeviceStatusScreen
        title={setupProbeCopy(resolvedMaker).title}
        description={setupProbeCopy(resolvedMaker).description}
        checking
      />
    ) : modelOptions.length === 0 ? (
      <DeviceStatusScreen
        title={
          resolvedMaker === "apple"
            ? "No iPhone simulators"
            : resolvedMaker === "samsung"
              ? "No Galaxy emulator"
              : "No Pixel emulator"
        }
        description={
          resolvedMaker === "apple"
            ? "Install an iPhone simulator in Xcode, then it will show up here."
            : resolvedMaker === "samsung"
              ? "Create a Galaxy S26 Ultra in Android Studio, then choose it here."
              : "Create a Pixel 10 in Android Studio, then choose it here."
        }
      />
    ) : (
      <DeviceChooserScreen
        title={modelChooserCopy(resolvedMaker).title}
        description={modelChooserCopy(resolvedMaker).description}
        options={modelOptions.map((option) => ({
          id: option.id,
          label: option.label,
          detail: option.detail,
        }))}
        onPick={pickModel}
      />
    );

  const kind =
    attachedDevice && attachedMaker === resolvedMaker
      ? deviceKindFor(attachedDevice)
      : chassisForMaker(resolvedMaker);
  // Free look needs live pixels to texture: engaging it before the stream is up
  // would show a device with a black slab for a screen.
  const stageActive = freeLook && attachedDevice !== null && video.status.kind === "streaming";
  const degradedNotice =
    threadState?.availability.kind === "degraded" ? threadState.availability : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <select
          aria-label="Maker"
          value={resolvedMaker ?? ""}
          disabled={busy}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "apple" || value === "google" || value === "samsung") setMaker(value);
          }}
          className="w-[7.5rem] shrink-0 cursor-pointer bg-transparent text-sm outline-none disabled:opacity-50"
        >
          <option value="" disabled>
            Maker
          </option>
          {DEVICE_MAKERS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Model"
          value={selectedModelId}
          disabled={busy || resolvedMaker === null || modelOptions.length === 0}
          onChange={(event) => pickModel(event.target.value)}
          className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm outline-none disabled:opacity-50"
        >
          <option value="">Choose a model…</option>
          {modelOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {threadState?.agentActive ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
            Agent using
          </span>
        ) : null}
      </div>
      {degradedNotice ? (
        <div className="border-b border-border bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {describeDegradedCapabilities(degradedNotice.capabilities, degradedNotice.toolchain)}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1 p-3">
        {/*
          The flat frame stays mounted under free look rather than being
          swapped out. The decoder paints into its canvas and the 3D stage
          samples that canvas as a texture, so unmounting it would tear down the
          video pipeline every time the toggle moved. `invisible` hides it and
          takes it out of hit-testing while leaving the canvas live.
        */}
        <div className={cn("h-full", stageActive && "invisible")}>
          <DeviceScreen
            kind={kind}
            landscape={landscape}
            buttonsDisabled={!attachedDevice || busy}
            onPressButton={press}
          >
            {screen}
          </DeviceScreen>
        </div>
        {stageActive ? (
          <div className="absolute inset-0 p-3">
            <DeviceStage
              kind={kind}
              pixelWidth={video.dimensions?.width}
              pixelHeight={video.dimensions?.height}
              screenSource={canvasRef}
              onFrameSignal={(signal) => {
                stageFrameSignal.current = signal;
              }}
              onPress={handleStagePress}
              onPressButton={handleStageButton}
              onGravityChange={motion.push}
              onSourceChange={setStageSource}
              onUnavailable={() => {
                setFreeLook(false);
                showFailure(
                  "Free look is unavailable",
                  "This machine's graphics stack could not run the 3D device view.",
                );
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] text-white/70">
                {supportsMotion
                  ? "Drag the body to turn it — the app feels the tilt. Double-click to reset."
                  : "Drag the body to turn it. This runtime has no motion sensors, so the app cannot feel it."}
                {/*
                  Said out loud only when a model was expected and did not
                  arrive. Without a registered model the drawn chassis is simply
                  what this pane looks like, and captioning it would be noise.
                */}
                {stageSource === "procedural" && deviceModelFor(kind)
                  ? " Showing the drawn chassis — the device model did not load."
                  : ""}
              </span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex h-12 shrink-0 items-center justify-center gap-1 border-t border-border px-3">
        <DeviceActionButton
          label="Home"
          disabled={!attachedDevice || busy}
          onClick={() => press("home")}
        >
          <Home className="size-4" />
        </DeviceActionButton>
        <DeviceActionButton
          label="Rotate view"
          active={landscape}
          disabled={!attachedDevice}
          onClick={() => setLandscape((value) => !value)}
        >
          <RotateCw className="size-4" />
        </DeviceActionButton>
        <DeviceActionButton
          label={
            freeLook
              ? "Leave free look"
              : supportsMotion
                ? "Free look — turns the device and its sensors"
                : "Free look — view only on this runtime"
          }
          active={freeLook}
          disabled={!attachedDevice || video.status.kind !== "streaming"}
          onClick={() => setFreeLook((value) => !value)}
        >
          <Rotate3d className="size-4" />
        </DeviceActionButton>
        <DeviceActionButton
          label="Save screenshot"
          disabled={!attachedDevice || busy}
          onClick={captureScreenshot}
        >
          <Camera className="size-4" />
        </DeviceActionButton>
        <DeviceActionButton
          label={recording ? "Stop recording" : "Record video"}
          active={recording}
          disabled={!attachedDevice || busy}
          onClick={toggleRecording}
        >
          <CircleStop className="size-4" />
        </DeviceActionButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <DeviceActionButton
          label="Shut down simulator"
          disabled={!attachedDevice || busy}
          onClick={shutdownDevice}
        >
          <Power className="size-4" />
        </DeviceActionButton>
        <DeviceActionButton
          label="Detach simulator"
          disabled={!attachedDevice || busy}
          onClick={detachDevice}
        >
          <Unplug className="size-4" />
        </DeviceActionButton>
      </div>
    </div>
  );
}
