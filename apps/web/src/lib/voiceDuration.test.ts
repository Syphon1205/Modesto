import { describe, expect, it } from "vite-plus/test";

import { formatVoiceRecordingDuration } from "./voiceDuration";

describe("formatVoiceRecordingDuration", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatVoiceRecordingDuration(0)).toBe("0:00");
    expect(formatVoiceRecordingDuration(7_000)).toBe("0:07");
    expect(formatVoiceRecordingDuration(65_000)).toBe("1:05");
  });
});
