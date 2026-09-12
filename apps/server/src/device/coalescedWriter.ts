/**
 * coalescedWriter - keep only the newest value per key, and one write in flight.
 *
 * Some device writes describe a *state* rather than an *event*: where the
 * accelerometer points, what the screen brightness is. For those, a queue is
 * the wrong shape — replaying every intermediate value just makes the device
 * lag behind the caller, and each one costs a process spawn.
 *
 * This keeps at most one pending value per key and at most one call in flight.
 * A caller producing values at animation rate against a writer that takes tens
 * of milliseconds gets the latest value delivered next, and the ones it
 * overtook are dropped — which is correct, because they were superseded before
 * anything observed them.
 *
 * @module device/coalescedWriter
 */

export interface CoalescedWriter<T> {
  /**
   * Record `value` as the newest for `key`.
   *
   * Resolves when this call's value — or a newer one that replaced it — has
   * been written. Rejects only for the caller that was actually draining when
   * the underlying write failed; a superseded value resolves rather than
   * inheriting an error from a write it never performed.
   */
  write(key: string, value: T): Promise<void>;
  /** Whether a value for `key` is queued or being written. Test seam. */
  busy(key: string): boolean;
}

type Slot<T> = {
  pending: T | null;
  /** Present while a drain loop owns this slot. */
  draining: boolean;
};

export function createCoalescedWriter<T>(
  perform: (key: string, value: T) => Promise<void>,
): CoalescedWriter<T> {
  const slots = new Map<string, Slot<T>>();

  return {
    async write(key, value) {
      const existing = slots.get(key);
      if (existing?.draining) {
        // A drain already owns this key and will pick this value up on its next
        // pass. Returning here — rather than awaiting the drain — is what keeps
        // a per-frame caller from accumulating promises for writes it no longer
        // cares about.
        existing.pending = value;
        return;
      }

      const slot: Slot<T> = { pending: value, draining: true };
      slots.set(key, slot);
      try {
        while (slot.pending !== null) {
          const next = slot.pending;
          slot.pending = null;
          await perform(key, next);
        }
      } finally {
        slot.draining = false;
        // Only clear when nothing arrived during the final write; otherwise the
        // next caller starts a fresh drain and picks it up.
        if (slot.pending === null && slots.get(key) === slot) slots.delete(key);
      }
    },
    busy(key) {
      const slot = slots.get(key);
      return slot !== undefined && (slot.draining || slot.pending !== null);
    },
  };
}
