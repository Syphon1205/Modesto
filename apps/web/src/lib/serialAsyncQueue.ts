/**
 * Tiny FIFO serializer for async work that must not drop concurrent callers.
 * Failures in one item do not block later items.
 */
export function createSerialAsyncQueue(): {
  readonly enqueue: <T>(task: () => Promise<T>) => Promise<T>;
} {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      const run = tail.catch(() => undefined).then(task);
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}
