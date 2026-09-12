// FILE: ambientDrag.ts
// Purpose: The one bit of drag math worth pulling out of AmbientPresenceLayer -
//          telling a press-and-release from a press-and-drag on the orb, since
//          the orb is both the drag handle and the click target now that the
//          separate "⋯" handle is gone.
// Layer: Ambient UI (pure)

/**
 * Whether a pointer has moved far enough from where it went down to count as a
 * drag rather than a click. A few pixels of jitter is normal on every input
 * device (mouse, trackpad, touch); without a threshold, a plain click would
 * occasionally read as a zero-distance "drag" and get its click suppressed.
 */
export function exceedsDragThreshold(deltaX: number, deltaY: number, thresholdPx = 4): boolean {
  return Math.hypot(deltaX, deltaY) > thresholdPx;
}
