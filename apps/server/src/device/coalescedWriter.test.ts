import { describe, expect, it } from "@effect/vitest";

import { createCoalescedWriter } from "./coalescedWriter.ts";

/** A writer whose completion the test controls, so overlap is deterministic. */
function gatedWriter() {
  const calls: Array<{ key: string; value: number }> = [];
  const gates: Array<() => void> = [];
  const writer = createCoalescedWriter<number>(async (key, value) => {
    calls.push({ key, value });
    await new Promise<void>((resolve) => gates.push(resolve));
  });
  return {
    writer,
    calls,
    /** Let the oldest outstanding write finish. */
    async release() {
      gates.shift()?.();
      // Yield twice: once for the write's own continuation, once for the drain
      // loop to reach its next iteration.
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe("createCoalescedWriter", () => {
  it("performs a lone write immediately", async () => {
    const { writer, calls, release } = gatedWriter();
    const done = writer.write("a", 1);
    expect(calls).toEqual([{ key: "a", value: 1 }]);
    await release();
    await done;
    expect(writer.busy("a")).toBe(false);
  });

  it("drops superseded values instead of queuing them", async () => {
    const { writer, calls, release } = gatedWriter();
    void writer.write("a", 1);
    // These three land while the first write is still in flight. Only the last
    // is a state anything will ever observe, so the middle two must not be sent.
    void writer.write("a", 2);
    void writer.write("a", 3);
    void writer.write("a", 4);
    expect(calls).toEqual([{ key: "a", value: 1 }]);

    await release();
    expect(calls).toEqual([
      { key: "a", value: 1 },
      { key: "a", value: 4 },
    ]);
    await release();
    expect(calls).toHaveLength(2);
    expect(writer.busy("a")).toBe(false);
  });

  it("keeps keys independent", async () => {
    const { writer, calls, release } = gatedWriter();
    void writer.write("a", 1);
    void writer.write("b", 2);
    expect(calls).toEqual([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
    expect(writer.busy("a")).toBe(true);
    expect(writer.busy("b")).toBe(true);
    await release();
    await release();
    expect(writer.busy("a")).toBe(false);
    expect(writer.busy("b")).toBe(false);
  });

  it("accepts new writes after a drain finishes", async () => {
    const { writer, calls, release } = gatedWriter();
    const first = writer.write("a", 1);
    await release();
    await first;

    const second = writer.write("a", 9);
    expect(calls).toEqual([
      { key: "a", value: 1 },
      { key: "a", value: 9 },
    ]);
    await release();
    await second;
  });

  it("reports the failure to the caller that was draining and stays usable", async () => {
    let attempt = 0;
    const writer = createCoalescedWriter<number>(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("adb refused");
    });

    await expect(writer.write("a", 1)).rejects.toThrow("adb refused");
    // A failed write must not strand the slot as draining, or the device would
    // never accept another value for the rest of the session.
    expect(writer.busy("a")).toBe(false);
    await expect(writer.write("a", 2)).resolves.toBeUndefined();
    expect(attempt).toBe(2);
  });
});
