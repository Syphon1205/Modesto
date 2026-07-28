import { type OrchestrationThreadActivity, EventId } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import {
  adaptUnifiedTimelineActivity,
  isUnifiedThreadLevelActivity,
} from "./activityTimelineAdapters";

describe("review activity timeline adapter", () => {
  it("renders cancelled reviews as terminal thread activity", () => {
    const activity: OrchestrationThreadActivity = {
      id: EventId.makeUnsafe("activity:review-cancelled"),
      kind: "review.cancelled",
      summary: "Modesto Review cancelled",
      tone: "info",
      payload: {},
      turnId: null,
      createdAt: "2026-07-23T20:00:00.000Z",
    };

    expect(isUnifiedThreadLevelActivity(activity.kind)).toBe(true);
    expect(adaptUnifiedTimelineActivity(activity)).toEqual({
      label: "Modesto Review cancelled",
      tone: "info",
    });
  });
});
