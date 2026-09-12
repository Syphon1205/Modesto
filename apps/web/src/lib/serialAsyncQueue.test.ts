import { describe, expect, it } from "vite-plus/test";

import { createSerialAsyncQueue } from "./serialAsyncQueue";

describe("createSerialAsyncQueue", () => {
  it("runs enqueued tasks in FIFO order without dropping concurrent callers", async () => {
    const queue = createSerialAsyncQueue();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async () => {
      await firstGate;
      order.push("a");
      return "a";
    });
    const second = queue.enqueue(async () => {
      order.push("b");
      return "b";
    });
    const third = queue.enqueue(async () => {
      order.push("c");
      return "c";
    });

    expect(order).toEqual([]);
    releaseFirst();
    await expect(Promise.all([first, second, third])).resolves.toEqual(["a", "b", "c"]);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("continues draining after a rejected item", async () => {
    const queue = createSerialAsyncQueue();
    const order: string[] = [];

    const failed = queue.enqueue(async () => {
      order.push("fail");
      throw new Error("boom");
    });
    const next = queue.enqueue(async () => {
      order.push("ok");
      return "ok";
    });

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
    expect(order).toEqual(["fail", "ok"]);
  });
});
