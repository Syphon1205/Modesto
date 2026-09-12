import { describe, expect, it } from "@effect/vitest";

import { runProcess } from "./runProcess.ts";

describe("device runProcess output limits", () => {
  it("retains bounded output and allows completion when truncation is requested", async () => {
    const result = await runProcess(
      process.execPath,
      ["-e", 'process.stdout.write("abcdefgh"); process.stderr.write("12345678");'],
      {
        maxBufferBytes: 4,
        outputMode: "truncate",
      },
    );
    expect(result.stdout).toBe("abcd");
    expect(result.stderr).toBe("1234");
    expect(result.code).toBe(0);
  });

  it("rejects oversized output by default", async () => {
    await expect(
      runProcess(process.execPath, ["-e", 'process.stdout.write("abcdefgh");'], {
        maxBufferBytes: 4,
      }),
    ).rejects.toThrow("exceeded its 4-byte output limit");
  });
});
