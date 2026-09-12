// FILE: DevicePanel.logic.ts
// Purpose: Pure decision logic for the Mobile Simulator pane (video gating, input mapping, picker/availability views).
// Layer: Component logic helper
// Exports: frame-gate state machine, canvas/device coordinate mapping, hardware-button and key translation, picker + availability view models
// Depends on: device contracts and the shared frame envelope header only — no DOM, no React.

import type {
  DeviceAvailability,
  DeviceCapabilityId,
  DeviceCapabilityStatus,
  DeviceDescriptor,
  DeviceFrameHeader,
  DeviceGeometry,
  DeviceHardwareButton,
  DeviceKeyModifier,
  DeviceSetupStep,
  DeviceSetupStepId,
  DeviceToolchain,
  DeviceUdid,
  ThreadDeviceState,
} from "@modesto/contracts";

import { DEVICE_CAPABILITY_LABELS } from "@modesto/contracts";

// ── Frame gating ─────────────────────────────────────────────────────
//
// A WebCodecs VideoDecoder must be configured from a codec-config frame (SPS/PPS)
// before it accepts any sample, and after configuring it must receive a keyframe
// before any delta frame or it errors out. The stream is lossy by design (the
// server drops frames under backpressure), so sequence gaps are expected and must
// re-arm the keyframe requirement rather than kill the pane.

export type DeviceFrameGatePhase =
  /** No codec config seen yet: nothing can be decoded. */
  | "awaiting-config"
  /** Configured, but no keyframe has been admitted since the last configure or gap. */
  | "awaiting-keyframe"
  /** Decoding normally. */
  | "streaming";

export interface DeviceFrameGateState {
  readonly phase: DeviceFrameGatePhase;
  /** Sequence of the last admitted frame; null before the first admission. */
  readonly lastSequence: number | null;
  /** Frames dropped since the gate last reached "streaming". Diagnostics only. */
  readonly droppedSinceResync: number;
}

export type DeviceFrameGateAction =
  /** Hand the payload to `VideoDecoder.configure` (or `decode` for media frames). */
  | { readonly kind: "configure" }
  | { readonly kind: "decode"; readonly keyframe: boolean }
  /** Frame cannot be decoded in the current phase. */
  | { readonly kind: "drop"; readonly reason: DeviceFrameDropReason }
  /** Frame belongs to another device/thread and was never ours to decode. */
  | { readonly kind: "ignore" };

export type DeviceFrameDropReason =
  | "no-codec-config"
  | "awaiting-keyframe"
  | "sequence-gap"
  | "stale-sequence";

export interface DeviceFrameGateStep {
  readonly state: DeviceFrameGateState;
  readonly action: DeviceFrameGateAction;
  /**
   * True when the gate newly needs a keyframe it cannot produce itself, so the
   * caller should ask the server for one instead of waiting for the next
   * natural IDR (which may be seconds away at a low keyframe interval).
   */
  readonly requestKeyframe: boolean;
}

export function createDeviceFrameGateState(): DeviceFrameGateState {
  return { phase: "awaiting-config", lastSequence: null, droppedSinceResync: 0 };
}

// u32 sequence wraps, so "next" is computed modulo 2^32 rather than by addition.
const SEQUENCE_MODULUS = 2 ** 32;

export function isNextDeviceFrameSequence(previous: number, next: number): boolean {
  return (previous + 1) % SEQUENCE_MODULUS === next;
}

/**
 * Distance from `previous` to `next` going forward through the wrap point.
 * Used to tell a small forward gap (dropped frames) from a stale/reordered
 * frame, which would otherwise look like an enormous forward jump.
 */
function forwardSequenceDistance(previous: number, next: number): number {
  return (next - previous + SEQUENCE_MODULUS) % SEQUENCE_MODULUS;
}

// Beyond this, a "forward" jump is far more likely a stale frame from a previous
// stream generation than a real burst of drops, so it is discarded rather than
// treated as a gap.
const MAX_PLAUSIBLE_SEQUENCE_GAP = 1_024;

export function stepDeviceFrameGate(
  state: DeviceFrameGateState,
  header: Pick<DeviceFrameHeader, "deviceId" | "sequence" | "keyframe" | "codecConfig">,
  expectedDeviceId: DeviceUdid | string | null,
): DeviceFrameGateStep {
  if (expectedDeviceId === null || header.deviceId !== expectedDeviceId) {
    return { state, action: { kind: "ignore" }, requestKeyframe: false };
  }

  // Codec config re-arms the keyframe requirement: a new parameter set means the
  // decoder is reconfigured, and a decoder cannot resume mid-GOP after that.
  // Fresh subscribe already gets an IDR right after config — only ask the server
  // to rebuild when config arrives mid-stream, or a resync restart fights the
  // encoder and can leave the pane on a single held keyframe forever.
  if (header.codecConfig) {
    return {
      state: {
        phase: "awaiting-keyframe",
        lastSequence: header.sequence,
        droppedSinceResync: 0,
      },
      action: { kind: "configure" },
      requestKeyframe: state.phase === "streaming",
    };
  }

  if (state.phase === "awaiting-config") {
    return {
      state: { ...state, droppedSinceResync: state.droppedSinceResync + 1 },
      action: { kind: "drop", reason: "no-codec-config" },
      requestKeyframe: false,
    };
  }

  if (state.lastSequence !== null) {
    const distance = forwardSequenceDistance(state.lastSequence, header.sequence);
    if (distance === 0 || distance > MAX_PLAUSIBLE_SEQUENCE_GAP) {
      // Reordered, duplicated, or from a previous stream generation. Dropping it
      // keeps `lastSequence` monotonic so one stale frame cannot wedge the gate.
      return {
        state: { ...state, droppedSinceResync: state.droppedSinceResync + 1 },
        action: { kind: "drop", reason: "stale-sequence" },
        requestKeyframe: false,
      };
    }
    if (distance > 1 && !header.keyframe && state.phase === "streaming") {
      // Frames were dropped mid-GOP. Decoding onward would render visible
      // corruption, so hold until the next keyframe and ask for one now.
      return {
        state: {
          phase: "awaiting-keyframe",
          lastSequence: header.sequence,
          droppedSinceResync: state.droppedSinceResync + 1,
        },
        action: { kind: "drop", reason: "sequence-gap" },
        requestKeyframe: true,
      };
    }
  }

  if (state.phase === "awaiting-keyframe" && !header.keyframe) {
    return {
      state: {
        ...state,
        lastSequence: header.sequence,
        droppedSinceResync: state.droppedSinceResync + 1,
      },
      action: { kind: "drop", reason: "awaiting-keyframe" },
      requestKeyframe: false,
    };
  }

  return {
    state: { phase: "streaming", lastSequence: header.sequence, droppedSinceResync: 0 },
    action: { kind: "decode", keyframe: header.keyframe },
    requestKeyframe: false,
  };
}

/**
 * Drops back to the pre-config phase. Used on decoder error and on
 * detach/resubscribe, where the next stream may carry different parameter sets.
 */
export function resetDeviceFrameGate(): DeviceFrameGateState {
  return createDeviceFrameGateState();
}

// ── Coordinate mapping ───────────────────────────────────────────────

export interface DeviceCanvasGeometry {
  /** Decoded frame size in pixels. */
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Rendered canvas size in CSS pixels (its bounding box). */
  readonly displayWidth: number;
  readonly displayHeight: number;
}

export interface DevicePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Frames arrive at the device's native pixel resolution while input is injected
 * in device points, so the scale factor is derived from the frame rather than
 * assumed: `object-fit: contain` letterboxes, and a click in a letterbox band
 * has no device coordinate at all.
 */
export function deviceContainRect(geometry: DeviceCanvasGeometry): {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
} | null {
  const { frameWidth, frameHeight, displayWidth, displayHeight } = geometry;
  if (
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    displayWidth <= 0 ||
    displayHeight <= 0
  ) {
    return null;
  }
  const scale = Math.min(displayWidth / frameWidth, displayHeight / frameHeight);
  const width = frameWidth * scale;
  const height = frameHeight * scale;
  return {
    offsetX: (displayWidth - width) / 2,
    offsetY: (displayHeight - height) / 2,
    width,
    height,
  };
}

/**
 * Maps a pointer position (relative to the canvas bounding box) to device
 * points. Returns null for clicks in the letterbox bands, which must not be
 * clamped onto the screen edge — a stray tap at (0, y) is worse than no tap.
 */
export function canvasPointToDevicePoint(
  geometry: DeviceCanvasGeometry & {
    /** Device screen size in points; falls back to frame pixels when unknown. */
    readonly devicePointWidth?: number;
    readonly devicePointHeight?: number;
  },
  canvasX: number,
  canvasY: number,
): DevicePoint | null {
  const rect = deviceContainRect(geometry);
  if (!rect) return null;

  const withinX = canvasX - rect.offsetX;
  const withinY = canvasY - rect.offsetY;
  if (withinX < 0 || withinY < 0 || withinX > rect.width || withinY > rect.height) {
    return null;
  }

  const pointWidth = geometry.devicePointWidth ?? geometry.frameWidth;
  const pointHeight = geometry.devicePointHeight ?? geometry.frameHeight;
  // Round to whole points: the helper injects integral HID coordinates, and a
  // fractional point would be truncated inconsistently across the hop.
  return {
    x: clampToRange(Math.round((withinX / rect.width) * pointWidth), 0, pointWidth),
    y: clampToRange(Math.round((withinY / rect.height) * pointHeight), 0, pointHeight),
  };
}

function clampToRange(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

// ── Tap vs swipe ─────────────────────────────────────────────────────

/**
 * Below this movement a drag is a tap: trackpads and touchscreens jitter a few
 * pixels during a press, and sending a 3px swipe instead of a tap makes buttons
 * feel unreliable.
 */
export const DEVICE_TAP_MOVEMENT_THRESHOLD_POINTS = 8;

export type DevicePointerGesture =
  | { readonly kind: "tap"; readonly point: DevicePoint }
  | {
      readonly kind: "swipe";
      readonly from: DevicePoint;
      readonly to: DevicePoint;
      readonly durationMs: number;
    };

/**
 * Classifies a completed pointer interaction. A press that started or ended
 * outside the screen area yields no gesture rather than a clamped one.
 */
export function resolveDevicePointerGesture(input: {
  readonly from: DevicePoint | null;
  readonly to: DevicePoint | null;
  readonly durationMs: number;
  readonly movementThreshold?: number;
}): DevicePointerGesture | null {
  const { from, to } = input;
  if (!from) return null;
  if (!to) return { kind: "tap", point: from };

  const threshold = input.movementThreshold ?? DEVICE_TAP_MOVEMENT_THRESHOLD_POINTS;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance <= threshold) {
    return { kind: "tap", point: to };
  }
  return {
    kind: "swipe",
    from,
    to,
    // A zero-duration swipe is rejected by the helper as a flick with infinite
    // velocity; clamp to a single frame's worth of time.
    durationMs: Math.max(16, Math.round(input.durationMs)),
  };
}

// ── Hardware buttons and keyboard ────────────────────────────────────

export interface DeviceShortcutEventLike {
  readonly key: string;
  readonly code?: string;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
}

/**
 * Simulator.app's hardware chords, matched before keyboard passthrough so the
 * muscle memory carries over. Everything else with Cmd held is left to the
 * browser/app rather than injected, since Cmd+W/Cmd+R on a focused canvas must
 * still reach Modesto.
 *
 * One of Simulator.app's chords is deliberately absent, for one reason:
 * claiming a chord swallows the keystroke, so a chord the backend refuses is
 * worse than no chord at all. ⌘→ rotate is a window command with no HID usage
 * and no simctl equivalent.
 */
export function resolveDeviceHardwareButtonShortcut(
  event: DeviceShortcutEventLike,
): DeviceHardwareButton | null {
  if (!event.metaKey || event.ctrlKey) return null;

  const key = event.key.toLowerCase();
  if (event.shiftKey) {
    return key === "h" ? "home" : null;
  }
  if (key === "arrowup") return "volume-up";
  if (key === "arrowdown") return "volume-down";
  return key === "l" ? "lock" : null;
}

export function deviceKeyModifiers(event: DeviceShortcutEventLike): DeviceKeyModifier[] {
  const modifiers: DeviceKeyModifier[] = [];
  if (event.metaKey) modifiers.push("command");
  if (event.shiftKey) modifiers.push("shift");
  if (event.altKey) modifiers.push("option");
  if (event.ctrlKey) modifiers.push("control");
  return modifiers;
}

// HID usage codes (page 0x07) for the keys the pane forwards. Letters and digits
// are computed; only the named keys need a table.
const HID_USAGE_BY_KEY: Readonly<Record<string, number>> = {
  Enter: 0x28,
  Escape: 0x29,
  Backspace: 0x2a,
  Tab: 0x2b,
  " ": 0x2c,
  "-": 0x2d,
  "=": 0x2e,
  "[": 0x2f,
  "]": 0x30,
  "\\": 0x31,
  ";": 0x33,
  "'": 0x34,
  "`": 0x35,
  ",": 0x36,
  ".": 0x37,
  "/": 0x38,
  ArrowRight: 0x4f,
  ArrowLeft: 0x50,
  ArrowDown: 0x51,
  ArrowUp: 0x52,
};

const HID_USAGE_A = 0x04;
const HID_USAGE_1 = 0x1e;
const HID_USAGE_0 = 0x27;

/**
 * Translates a DOM key to a HID usage code. Returns null for keys the device
 * has no equivalent for (function keys, dead keys, IME composition), which are
 * dropped rather than guessed at.
 */
export function deviceHidUsageForKey(key: string): number | null {
  if (key.length === 1) {
    const lower = key.toLowerCase();
    const codePoint = lower.codePointAt(0);
    if (codePoint === undefined) return null;
    if (lower >= "a" && lower <= "z") {
      return HID_USAGE_A + (codePoint - 97);
    }
    if (lower === "0") return HID_USAGE_0;
    if (lower >= "1" && lower <= "9") {
      return HID_USAGE_1 + (codePoint - 49);
    }
  }
  return HID_USAGE_BY_KEY[key] ?? null;
}

// ── Device picker ────────────────────────────────────────────────────

export type DevicePickerAction =
  /** Already booted: attaching is all that is needed. */
  | { readonly kind: "attach" }
  /** Shut down: boot first, then attach when the boot resolves. */
  | { readonly kind: "boot-then-attach" }
  /** Mid-transition: selecting would race the state machine. */
  | { readonly kind: "wait" };

export interface DevicePickerEntry {
  readonly device: DeviceDescriptor;
  readonly attached: boolean;
  readonly action: DevicePickerAction;
  /** Secondary line, e.g. `iOS 18.2 · Booted`. */
  readonly detail: string;
}

const RUNTIME_STATE_LABELS = {
  shutdown: "Shut down",
  booting: "Booting",
  booted: "Booted",
  "shutting-down": "Shutting down",
} as const satisfies Record<DeviceDescriptor["state"], string>;

export function deviceRuntimeStateLabel(state: DeviceDescriptor["state"]): string {
  return RUNTIME_STATE_LABELS[state];
}

function devicePickerAction(state: DeviceDescriptor["state"]): DevicePickerAction {
  switch (state) {
    case "booted":
      return { kind: "attach" };
    case "shutdown":
      return { kind: "boot-then-attach" };
    default:
      return { kind: "wait" };
  }
}

/**
 * Booted devices sort first so the common case (pick the running simulator) is
 * one click away; within a group, name order keeps the list stable as states
 * churn during boots.
 */
export function buildDevicePickerEntries(input: {
  readonly devices: readonly DeviceDescriptor[];
  readonly attachedDeviceUdid: DeviceUdid | null;
}): readonly DevicePickerEntry[] {
  const rank = (device: DeviceDescriptor): number => {
    if (device.udid === input.attachedDeviceUdid) return 0;
    if (device.state === "booted") return 1;
    if (device.state === "booting") return 2;
    return 3;
  };

  return [...input.devices]
    .sort((left, right) => rank(left) - rank(right) || left.name.localeCompare(right.name))
    .map((device) => ({
      device,
      attached: device.udid === input.attachedDeviceUdid,
      action: devicePickerAction(device.state),
      detail: `${device.runtime} · ${deviceRuntimeStateLabel(device.state)}`,
    }));
}

export function groupDevicePickerEntries(entries: readonly DevicePickerEntry[]): {
  readonly ios: readonly DevicePickerEntry[];
  readonly android: readonly DevicePickerEntry[];
} {
  return {
    ios: entries.filter((entry) => entry.device.platform === "ios-simulator"),
    android: entries.filter((entry) => entry.device.platform === "android-emulator"),
  };
}

export const DEVICE_MAKERS = [
  { id: "apple", label: "Apple", product: "iPhone" },
  { id: "google", label: "Google", product: "Pixel" },
  { id: "samsung", label: "Samsung", product: "Galaxy" },
] as const;

export type DeviceMakerId = (typeof DEVICE_MAKERS)[number]["id"];

/** Latest shipping phones the pane offers when the SDK has no matching device yet. */
export const LATEST_CATALOG_MODELS = {
  google: { name: "Pixel 10", detail: "Latest Pixel" },
  samsung: { name: "Galaxy S26 Ultra", detail: "Latest Galaxy" },
} as const;

export function deviceMakerFor(device: {
  readonly platform: string;
  readonly name: string;
}): DeviceMakerId {
  if (device.platform === "ios-simulator") return "apple";
  return /(galaxy|samsung)/iu.test(device.name) ? "samsung" : "google";
}

export function chassisForMaker(maker: DeviceMakerId | null): "iPhone" | "pixel" | "galaxy" {
  if (maker === "google") return "pixel";
  if (maker === "samsung") return "galaxy";
  return "iPhone";
}

export function isApplePhone(device: {
  readonly platform: string;
  readonly name: string;
  readonly family?: DeviceDescriptor["family"];
}): boolean {
  if (device.platform !== "ios-simulator") return false;
  if (device.family === "tablet") return false;
  if (device.family === "phone") return true;
  return /iphone/iu.test(device.name);
}

export function entriesForMaker(
  entries: readonly DevicePickerEntry[],
  maker: DeviceMakerId,
): readonly DevicePickerEntry[] {
  return entries.filter((entry) => {
    if (deviceMakerFor(entry.device) !== maker) return false;
    return maker === "apple" ? isApplePhone(entry.device) : true;
  });
}

export function runtimeRank(runtime: string): number {
  const match = /(\d+)(?:\.(\d+))?/u.exec(runtime);
  if (!match) return 0;
  return Number.parseInt(match[1]!, 10) * 1_000 + Number.parseInt(match[2] ?? "0", 10);
}

/**
 * One row per marketing name. A machine with three iOS runtimes otherwise lists
 * "iPhone 17 Pro" three times; keep the booted copy, then the newest runtime.
 */
export function uniqueLatestModels(
  entries: readonly DevicePickerEntry[],
): readonly DevicePickerEntry[] {
  const rank = (entry: DevicePickerEntry): number => {
    const state = entry.device.state === "booted" ? 3 : entry.device.state === "booting" ? 2 : 0;
    return state * 1_000_000 + runtimeRank(entry.device.runtime);
  };
  const byName = new Map<string, DevicePickerEntry>();
  for (const entry of [...entries].sort((left, right) => rank(right) - rank(left))) {
    if (!byName.has(entry.device.name)) byName.set(entry.device.name, entry);
  }
  return [...byName.values()].sort((left, right) =>
    right.device.name.localeCompare(left.device.name, undefined, { numeric: true }),
  );
}

export interface MakerModelOption {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly device: DeviceDescriptor | null;
}

function catalogId(maker: Exclude<DeviceMakerId, "apple">): string {
  return `catalog:${maker}`;
}

function namesMatch(left: string, right: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[_-]+/gu, " ").trim();
  return normalize(left) === normalize(right) || normalize(left).includes(normalize(right));
}

export function buildMakerModelOptions(
  entries: readonly DevicePickerEntry[],
  maker: DeviceMakerId,
): readonly MakerModelOption[] {
  const installed = uniqueLatestModels(entriesForMaker(entries, maker));
  const toOption = (entry: DevicePickerEntry, detail = entry.detail): MakerModelOption => ({
    id: entry.device.udid,
    label: entry.device.name,
    detail,
    device: entry.device,
  });
  if (maker === "apple") return installed.map((entry) => toOption(entry));

  const catalog = LATEST_CATALOG_MODELS[maker];
  const exact = installed.find((entry) => namesMatch(entry.device.name, catalog.name));
  const match = exact ?? installed[0];
  const rest = installed.filter((entry) => entry !== match);
  const latest: MakerModelOption = match
    ? toOption(match, catalog.detail)
    : { id: catalogId(maker), label: catalog.name, detail: catalog.detail, device: null };
  return [latest, ...rest.map((entry) => toOption(entry))];
}

export function isAndroidSetupStep(id: DeviceSetupStepId): boolean {
  return id.startsWith("install-android");
}

/** Shown for iPhone before the server answers, so the phone is never an empty spinner. */
export const FALLBACK_APPLE_SETUP_STEPS: readonly DeviceSetupStep[] = [
  { id: "install-xcode", label: "Xcode installed", done: false },
  { id: "select-xcode-command-line-tools", label: "Select Xcode", done: false },
  { id: "install-ios-runtime", label: "Simulator installed", done: false },
];

/** Shown for Pixel/Galaxy before the server answers, so the phone is never an empty spinner. */
export const FALLBACK_ANDROID_SETUP_STEPS: readonly DeviceSetupStep[] = [
  { id: "install-android-sdk", label: "Android Studio installed", done: false },
  { id: "install-android-platform-tools", label: "Platform-tools installed", done: false },
  { id: "install-android-emulator", label: "Emulator installed", done: false },
  { id: "install-android-avd", label: "Virtual device created", done: false },
];

export function fallbackSetupStepsForMaker(maker: DeviceMakerId): readonly DeviceSetupStep[] {
  return maker === "apple" ? FALLBACK_APPLE_SETUP_STEPS : FALLBACK_ANDROID_SETUP_STEPS;
}

/**
 * Setup cards are only for a maker with no devices and leftover install work.
 * Devices already listed means Xcode/the SDK is present — fallback cards while
 * `getThreadState` is in flight made a ready Mac look uninstalled.
 */
export function shouldShowDeviceSetup(input: {
  readonly threadState: ThreadDeviceState | undefined;
  readonly hasMakerDevices: boolean;
  readonly makerSteps: readonly DeviceSetupStep[];
}): boolean {
  if (input.hasMakerDevices) return false;
  if (!input.threadState) return false;
  return input.makerSteps.some((step) => !step.done);
}

export function setupStepsForMaker(
  steps: readonly DeviceSetupStep[],
  maker: DeviceMakerId,
): readonly DeviceSetupStep[] {
  return steps.filter((step) => {
    if (step.id === "build-device-helper") return false;
    // The screenshot checklist is Xcode / Select Xcode / Simulator. License
    // and a completed Select Xcode are noise once the developer dir is pinned.
    if (step.id === "accept-xcode-license" && step.done) return false;
    if (step.id === "select-xcode-command-line-tools" && step.done) return false;
    return maker === "apple" ? !isAndroidSetupStep(step.id) : isAndroidSetupStep(step.id);
  });
}

export function defaultDeviceMaker(entries: readonly DevicePickerEntry[]): DeviceMakerId | null {
  const attached = entries.find((entry) => entry.attached);
  if (attached) return deviceMakerFor(attached.device);
  return null;
}

export interface PresentedDeviceSetupStep {
  readonly id: DeviceSetupStepId;
  readonly title: string;
  readonly done: boolean;
  readonly active: boolean;
  readonly status: string | null;
  readonly body: string | null;
  readonly command: string | null;
}

const SETUP_STEP_TITLES: Record<DeviceSetupStepId, string> = {
  "install-xcode": "Xcode installed",
  "select-xcode-command-line-tools": "Select Xcode",
  "accept-xcode-license": "Accept the Xcode license",
  "install-ios-runtime": "Simulator installed",
  "build-device-helper": "Build the Modesto device helper",
  "install-android-sdk": "Android Studio installed",
  "install-android-platform-tools": "Platform-tools installed",
  "install-android-emulator": "Emulator installed",
  "install-android-avd": "Virtual device created",
};

function androidAvdCopy(maker: DeviceMakerId): {
  readonly title: string;
  readonly body: string;
  readonly command: string;
} {
  if (maker === "samsung") {
    return {
      title: "Galaxy virtual device",
      body: "Create a Galaxy S26 Ultra in Android Studio's Device Manager. Name it with Galaxy or Samsung so it shows up here.",
      command:
        "sdkmanager 'system-images;android-36;google_apis;arm64-v8a' && avdmanager create avd -n Galaxy_S26_Ultra -k 'system-images;android-36;google_apis;arm64-v8a'",
    };
  }
  return {
    title: "Pixel virtual device",
    body: "Create a Pixel 10 in Android Studio's Device Manager, then it will show up here.",
    command:
      "sdkmanager 'system-images;android-36;google_apis;arm64-v8a' && avdmanager create avd -n Pixel_10 -k 'system-images;android-36;google_apis;arm64-v8a'",
  };
}

function looksLikeShellCommand(detail: string): boolean {
  return /^(sudo |xcodebuild |sdkmanager |avdmanager )/u.test(detail.trim());
}

/** Bare `-downloadPlatform iOS` exits immediately when the iOS SDK is already in Xcode. */
const DOWNLOAD_PLATFORM_NOOP = "xcodebuild -downloadPlatform iOS";

function iosSimulatorRuntimeInstallCommand(arch: string = "arm64"): string {
  const variant = arch === "arm64" ? "arm64" : "universal";
  return `xcodebuild -downloadPlatform iOS -architectureVariant ${variant}`;
}

export function presentDeviceSetupStep(
  step: DeviceSetupStep,
  active = false,
  maker: DeviceMakerId = "apple",
): PresentedDeviceSetupStep {
  const title =
    step.id === "install-android-avd"
      ? androidAvdCopy(maker).title
      : (SETUP_STEP_TITLES[step.id] ?? step.label);
  const detail = step.detail?.trim() || null;
  if (step.id === "select-xcode-command-line-tools" && !step.done) {
    return {
      id: step.id,
      title,
      done: false,
      active,
      status: null,
      body: "Xcode is installed, but your Mac's command-line tools don't point at it. Paste this in Terminal — it will ask for your Mac password:",
      command:
        detail && looksLikeShellCommand(detail)
          ? detail
          : "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
    };
  }
  if (step.id === "install-android-avd" && !step.done) {
    const avd = androidAvdCopy(maker);
    return {
      id: step.id,
      title: avd.title,
      done: false,
      active,
      status: null,
      body: avd.body,
      command: avd.command,
    };
  }
  if (step.id === "install-ios-runtime" && !step.done) {
    const command =
      detail && looksLikeShellCommand(detail) && detail !== DOWNLOAD_PLATFORM_NOOP
        ? detail
        : iosSimulatorRuntimeInstallCommand();
    return {
      id: step.id,
      title,
      done: false,
      active,
      status: null,
      body: "Open Xcode → Settings → Components and download an iOS Simulator. xcodebuild -downloadPlatform iOS does nothing when Xcode already has the iOS SDK — if it prints a UUID and exits, pick an iPhone here instead.",
      command,
    };
  }
  if (step.id === "install-android-sdk" && !step.done) {
    return {
      id: step.id,
      title,
      done: false,
      active,
      status: null,
      body: "Install Android Studio. Modesto uses its emulator and platform-tools.",
      command: null,
    };
  }
  if (step.done) {
    return {
      id: step.id,
      title,
      done: true,
      active: false,
      status: detail && !looksLikeShellCommand(detail) ? detail : null,
      body: null,
      command: null,
    };
  }
  const command = detail && looksLikeShellCommand(detail) ? detail : null;
  return {
    id: step.id,
    title,
    done: false,
    active,
    status: null,
    body: command ? null : detail,
    command,
  };
}

export function setupScreenCopy(maker: DeviceMakerId): {
  readonly title: string;
  readonly description: string;
  readonly trademark: string;
} {
  if (maker === "apple") {
    return {
      title: "Set up the iOS simulator",
      description: "Progress updates automatically as each step finishes.",
      trademark: "Xcode is a trademark of Apple Inc., registered in the U.S. and other countries.",
    };
  }
  if (maker === "samsung") {
    return {
      title: "Set up the Galaxy emulator",
      description: "Progress updates automatically as each step finishes.",
      trademark: "Samsung and Galaxy are trademarks of Samsung Electronics Co., Ltd.",
    };
  }
  return {
    title: "Set up the Pixel emulator",
    description: "Progress updates automatically as each step finishes.",
    trademark: "Android and Pixel are trademarks of Google LLC.",
  };
}

/** Spinner copy while that maker's SDK is still being probed. Never names the other toolchain. */
export function setupProbeCopy(maker: DeviceMakerId): {
  readonly title: string;
  readonly description: string;
} {
  if (maker === "apple") {
    return {
      title: "Checking for Xcode…",
      description: "Looking for Xcode on this Mac.",
    };
  }
  if (maker === "samsung") {
    return {
      title: "Checking Android Studio…",
      description: "Looking for the Android SDK and a Galaxy system image.",
    };
  }
  return {
    title: "Checking Android Studio…",
    description: "Looking for the Android SDK and a Pixel system image.",
  };
}

export function makerChooserCopy(): { readonly title: string; readonly description: string } {
  return {
    title: "Choose a phone",
    description: "Apple, Google, or Samsung — then pick the model to boot here.",
  };
}

export function modelChooserCopy(maker: DeviceMakerId): {
  readonly title: string;
  readonly description: string;
} {
  if (maker === "apple") {
    return {
      title: "Choose an iPhone",
      description: "Installed simulators show up here. Pick one to boot it in Modesto.",
    };
  }
  if (maker === "samsung") {
    return {
      title: "Galaxy S26 Ultra",
      description: "The latest Galaxy. Create it in Android Studio if it is not on this Mac yet.",
    };
  }
  return {
    title: "Pixel 10",
    description: "The latest Pixel. Create it in Android Studio if it is not on this Mac yet.",
  };
}

// ── Availability ─────────────────────────────────────────────────────

export type DeviceAvailabilityView =
  | { readonly kind: "ready" }
  /**
   * The pane opens and works, but some capability failed its preflight. Kept
   * separate from "blocked" because the user has nothing to fix and everything
   * else still runs: blocking the pane over a broken accessibility path would
   * cost streaming and input for no reason.
   */
  | {
      readonly kind: "degraded";
      readonly notice: string;
      readonly brokenCapabilities: readonly DeviceCapabilityId[];
    }
  | {
      readonly kind: "blocked";
      readonly title: string;
      readonly description: string;
      /** Present only for setup-required; drives the live checklist. */
      readonly steps: readonly DeviceSetupStep[];
      /** Whether the pane should keep polling/listening for a state change. */
      readonly retryable: boolean;
    };

/**
 * "Accessibility inspection unavailable with Xcode 26.3 — streaming and input
 * unaffected": names what broke, the toolchain that broke it, and what still
 * works, so the notice answers the obvious next question in one line.
 */
export function describeDegradedCapabilities(
  capabilities: readonly DeviceCapabilityStatus[],
  toolchain: DeviceToolchain | undefined,
): string {
  const broken = capabilities.filter((capability) => !capability.ok);
  const working = capabilities.filter((capability) => capability.ok);
  const list = (entries: readonly DeviceCapabilityStatus[]): string => {
    const names = entries.map((entry) => DEVICE_CAPABILITY_LABELS[entry.id]);
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!.toLowerCase()}`;
  };

  const xcode = toolchain?.xcodeVersion
    ? ` with Xcode ${toolchain.xcodeVersion}`
    : toolchain?.xcodeBuild
      ? ` with Xcode build ${toolchain.xcodeBuild}`
      : "";
  const unaffected = working.length > 0 ? ` — ${list(working).toLowerCase()} unaffected` : "";
  return `${list(broken)} unavailable${xcode}${unaffected}.`;
}

/**
 * True when every setup step the user can act on is done and only the helper
 * build is left. Xcode, the license and a runtime all need the user; the helper
 * only needs an attach, which the picker provides.
 */
function onlyHelperBuildRemains(steps: readonly DeviceSetupStep[]): boolean {
  const remaining = steps.filter((step) => !step.done);
  return remaining.length > 0 && remaining.every((step) => step.id === "build-device-helper");
}

export function resolveDeviceAvailabilityView(
  availability: DeviceAvailability,
): DeviceAvailabilityView {
  switch (availability.kind) {
    case "available":
      return { kind: "ready" };
    case "unsupported-platform":
      return {
        kind: "blocked",
        title: "Mobile Simulator needs a local SDK",
        description: `This Modesto server runs on ${availability.platform}. iOS Simulator requires macOS with Xcode; the Android Emulator requires the Android SDK.`,
        steps: [],
        retryable: false,
      };
    case "setup-required":
      // The helper is the one step the user cannot perform: it is built on
      // first attach. Blocking on it hid the picker, so there was no way to
      // attach, so it never built — the setup card asked for the one thing it
      // prevented. When it is all that remains, show the picker and let
      // choosing a device do the build.
      if (onlyHelperBuildRemains(availability.steps)) return { kind: "ready" };
      return {
        kind: "blocked",
        title: availability.steps.some((step) => step.id.startsWith("install-android"))
          ? "Set up Mobile Simulator"
          : "Set up the iOS Simulator",
        description: "Progress updates automatically as each step finishes.",
        steps: availability.steps,
        retryable: true,
      };
    case "degraded":
      return {
        kind: "degraded",
        notice: describeDegradedCapabilities(availability.capabilities, availability.toolchain),
        brokenCapabilities: availability.capabilities
          .filter((capability) => !capability.ok)
          .map((capability) => capability.id),
      };
    case "helper-unavailable":
      return {
        kind: "blocked",
        title: "Simulator helper could not start",
        description: availability.message,
        steps: [],
        retryable: true,
      };
  }
}

export function deviceSetupProgress(steps: readonly DeviceSetupStep[]): {
  readonly done: number;
  readonly total: number;
} {
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

// ── Device screen geometry ───────────────────────────────────────────

/**
 * Every Apple display ships at 1x, 2x, or 3x. Frames arrive in pixels and input
 * is injected in points, so the pane must divide by the scale — sending pixels
 * puts a tap several hundred points off the right edge of the screen, where the
 * backend silently clamps it and nothing happens.
 *
 * The authoritative point size comes from the accessibility tree's root frame;
 * this is the fallback for before that first read resolves, and it only has to
 * pick between three candidates.
 */
export const DEVICE_SCALE_FACTORS = [3, 2, 1] as const;

/**
 * Every 3x device Apple ships is a phone, and every phone is narrow: 3x frames
 * land at 1080-1320px. Wider frames are iPads, which are always 2x. Choosing on
 * the frame width directly avoids the trap of a plausible-looking point width —
 * an iPad's 1640px divides by 3 into 547, which is a perfectly reasonable
 * number and completely wrong.
 */
export function inferDeviceScaleFactor(framePixelWidth: number): number {
  if (!Number.isFinite(framePixelWidth) || framePixelWidth <= 0) return 1;
  if (framePixelWidth >= 1000 && framePixelWidth <= 1400) return 3;
  if (framePixelWidth > 1400) return 2;
  // Below 1000px: a 2x phone (750-828px) or a 1x frame. Point widths under 320
  // do not exist on shipping hardware, so anything that small is already points.
  return framePixelWidth >= 640 ? 2 : 1;
}

function usablePointSize(
  size: { readonly width: number; readonly height: number } | null | undefined,
): { readonly width: number; readonly height: number } | null {
  if (!size) return null;
  const { width, height } = size;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Resolves the device's point dimensions, in descending order of authority:
 *
 * 1. `geometry` from the device descriptor. This is the helper's own attachment
 *    geometry — the exact numbers the backend validates input against — so a
 *    coordinate derived from it can never be rejected as out of bounds.
 * 2. The accessibility tree's root frame, for a server that predates the
 *    geometry field or a device attached elsewhere.
 * 3. The scale inferred from the frame width, which only has to pick between
 *    Apple's three scale factors.
 */
export function resolveDevicePointSize(input: {
  readonly framePixelWidth: number;
  readonly framePixelHeight: number;
  readonly geometry?: DeviceGeometry | null | undefined;
  readonly measured?: { readonly width: number; readonly height: number } | null | undefined;
}): { readonly width: number; readonly height: number } | null {
  const { framePixelWidth, framePixelHeight, geometry, measured } = input;
  const fromContract = usablePointSize(
    geometry ? { width: geometry.pointWidth, height: geometry.pointHeight } : null,
  );
  if (fromContract) return fromContract;
  const fromAccessibility = usablePointSize(measured);
  if (fromAccessibility) return fromAccessibility;
  if (framePixelWidth <= 0 || framePixelHeight <= 0) return null;
  const scale = inferDeviceScaleFactor(framePixelWidth);
  return {
    width: Math.round(framePixelWidth / scale),
    height: Math.round(framePixelHeight / scale),
  };
}

// ── Screen recording ─────────────────────────────────────────────────

/**
 * The pane's view of a recording.
 *
 * `starting` and `stopping` exist because both RPCs are slow enough to see:
 * the server waits for simctl's "Recording started" before acking, and stopping
 * sends SIGINT and waits for the container to finalise. Without the two
 * transitional phases the toolbar button would sit in its old state for a
 * second and invite a second click, which is exactly the double-start the
 * backend refuses.
 */
export type DeviceRecordingState =
  | { readonly kind: "idle" }
  | { readonly kind: "starting" }
  | { readonly kind: "recording"; readonly path: string; readonly startedAtMs: number }
  | { readonly kind: "stopping"; readonly path: string };

export type DeviceRecordingEvent =
  | { readonly kind: "start-requested" }
  | { readonly kind: "started"; readonly path: string; readonly startedAtMs: number }
  | { readonly kind: "stop-requested" }
  | { readonly kind: "stopped" }
  | { readonly kind: "failed" }
  /** The device went away (detached, shut down, or the stream ended). */
  | { readonly kind: "device-lost" };

export function createDeviceRecordingState(): DeviceRecordingState {
  return { kind: "idle" };
}

/**
 * Advances the recording state, ignoring events that do not apply to the
 * current phase. Ignoring rather than throwing is deliberate: a stop that
 * arrives after a failure, or a second click that beats the first response, is
 * a race the UI should absorb silently rather than a bug to surface.
 */
export function stepDeviceRecording(
  state: DeviceRecordingState,
  event: DeviceRecordingEvent,
): DeviceRecordingState {
  if (event.kind === "device-lost" || event.kind === "failed") {
    return { kind: "idle" };
  }
  switch (state.kind) {
    case "idle":
      return event.kind === "start-requested" ? { kind: "starting" } : state;
    case "starting":
      return event.kind === "started"
        ? { kind: "recording", path: event.path, startedAtMs: event.startedAtMs }
        : state;
    case "recording":
      return event.kind === "stop-requested" ? { kind: "stopping", path: state.path } : state;
    case "stopping":
      return event.kind === "stopped" ? { kind: "idle" } : state;
  }
}

/** Whether the toolbar's record button should read as active. */
export function isDeviceRecordingActive(state: DeviceRecordingState): boolean {
  return state.kind === "recording" || state.kind === "stopping";
}

/**
 * Which RPC a click on the record button should send, or null while a
 * transition is already in flight and a second call would be refused.
 */
export function deviceRecordingClickIntent(state: DeviceRecordingState): "start" | "stop" | null {
  if (state.kind === "idle") return "start";
  if (state.kind === "recording") return "stop";
  return null;
}

export interface DeviceSetupAction {
  readonly label: string;
  readonly url: string;
}

/**
 * The one thing the user can act on right now. "Open Xcode" here is only a
 * developer-dir affordance while `xcode-select` still points at the CLT —
 * booting a listed iPhone never goes through this button.
 */
const ANDROID_STUDIO_ACTION: DeviceSetupAction = {
  label: "Open Android Studio",
  url: "file:///Applications/Android%20Studio.app",
};

const DEVICE_SETUP_ACTIONS: Partial<Record<DeviceSetupStepId, DeviceSetupAction>> = {
  // The https form rather than macappstore://: the shell bridge only forwards
  // http(s), and macOS hands this link to the App Store app regardless.
  "install-xcode": {
    label: "Open Mac App Store",
    url: "https://apps.apple.com/app/xcode/id497799835",
  },
  "select-xcode-command-line-tools": {
    label: "Open Xcode",
    url: "file:///Applications/Xcode.app",
  },
  "accept-xcode-license": {
    label: "Open Xcode",
    url: "file:///Applications/Xcode.app",
  },
  "install-ios-runtime": {
    label: "Open Xcode",
    url: "file:///Applications/Xcode.app",
  },
  "install-android-sdk": {
    label: "Install Android Studio",
    url: "https://developer.android.com/studio",
  },
  "install-android-platform-tools": ANDROID_STUDIO_ACTION,
  "install-android-emulator": ANDROID_STUDIO_ACTION,
  "install-android-avd": ANDROID_STUDIO_ACTION,
};

export function resolveDeviceSetupAction(
  steps: readonly DeviceSetupStep[],
): DeviceSetupAction | null {
  const next = steps.find((step) => !step.done);
  return next ? (DEVICE_SETUP_ACTIONS[next.id] ?? null) : null;
}

/**
 * The checklist re-reports on its own, so a "checking" line is only honest while
 * steps remain. Once everything is done the pane is about to flip to the picker
 * and a spinner would be a lie.
 */
export function deviceSetupCheckingLabel(
  steps: readonly DeviceSetupStep[],
  maker: DeviceMakerId = "apple",
): string | null {
  const next = steps.find((step) => !step.done);
  if (!next) return null;
  if (next.id === "select-xcode-command-line-tools") return "Checking the selected Xcode…";
  if (next.id === "install-xcode") return "Checking for Xcode…";
  if (next.id === "install-ios-runtime") return "Checking for the iOS Simulator…";
  if (next.id === "install-android-avd") {
    return maker === "samsung" ? "Checking for a Galaxy image…" : "Checking for a Pixel image…";
  }
  if (isAndroidSetupStep(next.id)) return "Checking Android Studio…";
  return maker === "apple" ? "Checking for Xcode…" : "Checking Android Studio…";
}

export function presentDeviceSetup(
  steps: readonly DeviceSetupStep[],
  maker: DeviceMakerId = "apple",
): {
  readonly cards: readonly PresentedDeviceSetupStep[];
  readonly checking: string | null;
} {
  const activeId = steps.find((step) => !step.done)?.id ?? null;
  const cards = steps.map((step) => presentDeviceSetupStep(step, step.id === activeId, maker));
  return { cards, checking: deviceSetupCheckingLabel(steps, maker) };
}

// ── Thread state helpers ─────────────────────────────────────────────

export function attachedDeviceFromThreadState(
  state: ThreadDeviceState | undefined,
): DeviceDescriptor | null {
  if (!state?.attachedDeviceUdid) return null;
  return state.devices.find((device) => device.udid === state.attachedDeviceUdid) ?? null;
}

/**
 * A device the user picked, before the server has confirmed it.
 *
 * `supersedes` is the attachment the pick was made against. It is what tells a
 * selection still in flight from one the server has already answered: while the
 * thread still reports that old attachment, nothing has happened yet and the
 * pick stands; the moment it reports anything else, the server has spoken and
 * its answer wins — whether that is the picked device, or a different one an
 * agent claimed in the meantime.
 */
export interface PendingDeviceSelection {
  readonly device: DeviceDescriptor;
  readonly supersedes: DeviceUdid | null;
}

/**
 * The device the pane should be showing right now: the one the user just
 * picked, until the server's state catches up with that choice.
 *
 * Booting a cold simulator takes the better part of a minute, and until the
 * attach resolved the thread state named no device at all — so the picker sat
 * on "Choose a simulator" and the screen stayed blank while the machine was
 * visibly working. Preferring the pending selection makes the pane reflect the
 * intent immediately and reconcile when the real descriptor arrives.
 */
export function resolveDisplayedDevice(input: {
  readonly threadState: ThreadDeviceState | undefined;
  readonly pending: PendingDeviceSelection | null;
}): DeviceDescriptor | null {
  const attached = attachedDeviceFromThreadState(input.threadState);
  const { pending } = input;
  if (!pending) return attached;

  const reported = input.threadState?.attachedDeviceUdid ?? null;
  // The server has moved off the attachment this pick was made against, so its
  // answer is the current truth even when it is not the device that was picked.
  if (reported !== pending.supersedes) return attached;

  // Still pending. Prefer the thread's own copy of the descriptor where it has
  // one: it carries the live runtime state and the helper's measured geometry,
  // both fresher than the listing the pick came from.
  const known = input.threadState?.devices.find((device) => device.udid === pending.device.udid);
  return known ?? pending.device;
}

/**
 * What the phone's screen should say while an attachment comes up.
 *
 * Driven by the server's phase where there is one, because only the server
 * knows whether it is waiting on the boot or on the display. `selecting` is the
 * client-only stage before the first response, and every stage names the device
 * so the pane never shows an anonymous spinner or mixed Xcode/Android copy.
 */
export function deviceAttachStatusLabel(input: {
  readonly phase: ThreadDeviceState["attachPhase"] | undefined;
  readonly deviceState: DeviceDescriptor["state"];
  readonly pendingSelection: boolean;
  readonly deviceName?: string;
}): string | null {
  const name = input.deviceName?.trim();
  const starting = name ? `Starting ${name}…` : "Starting up…";
  switch (input.phase) {
    case "booting":
      return starting;
    case "waiting-for-display":
      return "Waiting for the screen…";
    case "connecting":
      return name ? `Connecting to ${name}…` : "Connecting…";
    default:
      break;
  }
  if (input.deviceState === "booting") return starting;
  if (input.deviceState === "shutdown") return input.pendingSelection ? starting : null;
  return input.pendingSelection ? (name ? `Connecting to ${name}…` : "Connecting…") : null;
}

/**
 * The stream is only worth holding when the pane is live, a device is attached,
 * and that device is actually booted. Preview panes (restored but not yet
 * activated) and hidden tabs unsubscribe so a background thread never decodes
 * H.264 it will not paint.
 */
export function shouldSubscribeToDeviceStream(input: {
  readonly runtimeMode: "live" | "preview";
  readonly isVisible: boolean;
  readonly attachedDevice: DeviceDescriptor | null;
}): boolean {
  return (
    input.runtimeMode === "live" &&
    input.isVisible &&
    input.attachedDevice !== null &&
    input.attachedDevice.state === "booted"
  );
}
