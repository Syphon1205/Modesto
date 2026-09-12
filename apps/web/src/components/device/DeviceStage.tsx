// FILE: DeviceStage.tsx
// Purpose: Free-look device view — mounts the WebGL stage, turns pointer drags
//          into rotation, and routes screen and button hits back to the pane.
// Layer: Device pane presentation
// Exports: DeviceStage
// Depends on: DeviceStage3d (lazily), deviceChassis for the kind.
//
// three.js and the stage are imported on demand so a pane that never enters
// free look never pays for them. Until the chunk resolves the caller keeps
// showing the flat frame, so there is no empty state to design.
//
// Grab the body to turn it; the screen stays the guest's. That split is what
// lets a drag mean "rotate" and "swipe" in the same view without a modifier:
// the raycast already knows which surface the pointer went down on.

import { useCallback, useEffect, useRef, useState } from "react";

import type { DeviceKind } from "./deviceChassis";
import type { DeviceStage as Stage, DeviceStagePose, DeviceStageSource } from "./DeviceStage3d";

/** Radians of travel per pixel dragged. Tuned so a pane-width drag is a half turn. */
const DRAG_SENSITIVITY = 0.0075;
/** How far the body may turn. Past this the screen is edge-on and unreadable. */
const YAW_LIMIT = Math.PI / 2.6;
const PITCH_LIMIT = Math.PI / 3.4;
/** Matches the shared disclosure motion, so the reset feels like the rest of the app. */
const RESET_MS = 220;

const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A completed press on the screen, in normalized display coordinates. Left
 * unclassified on purpose: the pane already owns the tap-versus-swipe
 * threshold, and it has to be applied in device points, not in fractions of a
 * screen whose physical size varies by an order of magnitude.
 */
export type DeviceStagePress = {
  readonly from: { readonly u: number; readonly v: number };
  /** Null when the pointer left the screen before release. */
  readonly to: { readonly u: number; readonly v: number } | null;
  readonly durationMs: number;
};

export function DeviceStage(props: {
  kind: DeviceKind;
  pixelWidth?: number | undefined;
  pixelHeight?: number | undefined;
  /** The canvas the H.264 decoder paints into; used as the screen texture. */
  screenSource: React.RefObject<HTMLCanvasElement | null>;
  /**
   * Handed a function the caller invokes once per decoded frame. Passing the
   * signal rather than a changing prop keeps video-rate redraws off React's
   * render path entirely — sixty state updates a second to move a texture would
   * cost more than the drawing does.
   */
  onFrameSignal: (signal: (() => void) | null) => void;
  onPress: (press: DeviceStagePress) => void;
  onPressButton: (name: string) => void;
  /**
   * The gravity the guest should feel, in Android sensor axes. Fired on every
   * pose change; the caller decides how often to forward it.
   */
  onGravityChange?: ((gravity: { x: number; y: number; z: number }) => void) | undefined;
  onSourceChange?: ((source: DeviceStageSource) => void) | undefined;
  /** Called if the GPU drops the context, so the pane can leave free look. */
  onUnavailable?: (() => void) | undefined;
}) {
  const { onPress, onGravityChange, onPressButton, onSourceChange, onUnavailable } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const poseRef = useRef<DeviceStagePose>({ yaw: 0, pitch: 0, roll: 0 });
  const dragRef = useRef<
    | { mode: "orbit"; x: number; y: number; pose: DeviceStagePose }
    | { mode: "screen"; u: number; v: number; at: number }
    | { mode: "button"; name: string }
    | null
  >(null);
  const resetRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  // Latest callbacks without retriggering the stage effect: rebuilding a WebGL
  // context because a parent re-rendered would drop the loaded model with it.
  const handlers = useRef({ onGravityChange, onSourceChange, onUnavailable });
  handlers.current = { onGravityChange, onSourceChange, onUnavailable };

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = props.screenSource.current;
    if (!canvas || !source) return;

    let stage: Stage | null = null;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    void (async () => {
      const module = await import("./DeviceStage3d");
      if (disposed) return;
      if (!module.isWebglAvailable()) {
        handlers.current.onUnavailable?.();
        return;
      }
      stage = module.createDeviceStage3d({
        canvas,
        kind: props.kind,
        pixelWidth: props.pixelWidth,
        pixelHeight: props.pixelHeight,
        screenSource: source,
        onSourceChange: (value) => handlers.current.onSourceChange?.(value),
        onContextLost: () => handlers.current.onUnavailable?.(),
      });
      if (disposed) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;
      stage.setPose(poseRef.current);
      const parent = canvas.parentElement;
      if (parent) {
        observer = new ResizeObserver(() => {
          const rect = parent.getBoundingClientRect();
          stage?.resize(rect.width, rect.height);
        });
        observer.observe(parent);
        const rect = parent.getBoundingClientRect();
        stage.resize(rect.width, rect.height);
      }
      setReady(true);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      if (resetRef.current !== null) cancelAnimationFrame(resetRef.current);
      resetRef.current = null;
      stageRef.current = null;
      stage?.dispose();
      setReady(false);
    };
  }, [props.kind, props.pixelHeight, props.pixelWidth, props.screenSource]);

  // A decoded frame changes the texture but nothing in the scene, so the stage
  // has no way to know it should redraw. This registers that signal, and
  // withdraws it on unmount so the video hook stops calling into a dead stage.
  const { onFrameSignal } = props;
  useEffect(() => {
    onFrameSignal(() => stageRef.current?.invalidate());
    return () => onFrameSignal(null);
  }, [onFrameSignal]);

  const applyPose = useCallback((pose: DeviceStagePose) => {
    poseRef.current = pose;
    const stage = stageRef.current;
    if (!stage) return;
    stage.setPose(pose);
    handlers.current.onGravityChange?.(stage.gravity());
  }, []);

  const resetPose = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (resetRef.current !== null) cancelAnimationFrame(resetRef.current);
    const from = poseRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyPose({ yaw: 0, pitch: 0, roll: 0 });
      return;
    }
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / RESET_MS);
      const k = 1 - easeOut(t);
      applyPose({ yaw: from.yaw * k, pitch: from.pitch * k, roll: from.roll * k });
      resetRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    resetRef.current = requestAnimationFrame(step);
  }, [applyPose]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (resetRef.current !== null) {
      cancelAnimationFrame(resetRef.current);
      resetRef.current = null;
    }
    const hit = stage.hitTest(event.clientX, event.clientY);
    if (hit?.kind === "button") {
      dragRef.current = { mode: "button", name: hit.name };
      return;
    }
    if (hit?.kind === "screen") {
      dragRef.current = { mode: "screen", u: hit.u, v: hit.v, at: performance.now() };
      return;
    }
    dragRef.current = {
      mode: "orbit",
      x: event.clientX,
      y: event.clientY,
      pose: poseRef.current,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.mode !== "orbit") return;
    applyPose({
      yaw: clamp(drag.pose.yaw + (event.clientX - drag.x) * DRAG_SENSITIVITY, YAW_LIMIT),
      pitch: clamp(drag.pose.pitch + (event.clientY - drag.y) * DRAG_SENSITIVITY, PITCH_LIMIT),
      roll: drag.pose.roll,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    if (drag.mode === "button") {
      const hit = stage.hitTest(event.clientX, event.clientY);
      // Released off the button: a cancelled press, exactly as a DOM button does.
      if (hit?.kind === "button" && hit.name === drag.name) onPressButton(drag.name);
      return;
    }
    if (drag.mode !== "screen") return;
    const hit = stage.hitTest(event.clientX, event.clientY);
    onPress({
      from: { u: drag.u, v: drag.v },
      to: hit?.kind === "screen" ? { u: hit.u, v: hit.v } : null,
      durationMs: performance.now() - drag.at,
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      style={{ opacity: ready ? 1 : 0, transition: "opacity 220ms ease-out" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onDoubleClick={resetPose}
    />
  );
}
