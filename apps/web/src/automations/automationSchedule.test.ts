import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_SCHEDULE_FORM,
  describeNextRun,
  describeSchedule,
  toSchedule,
} from "./automationSchedule";

const NOW = new Date("2026-09-03T12:00:00Z").getTime();

/**
 * A `datetime-local` value for an instant, in the browser's own zone.
 *
 * Built from local getters on purpose: the input's value is wall-clock with no
 * offset, so a UTC-formatted string would land hours away from the intended
 * instant anywhere but UTC - which is exactly the bug this conversion exists
 * to avoid.
 */
const pad = (value: number) => String(value).padStart(2, "0");

function localInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

describe("describeSchedule", () => {
  it("reads as a sentence for each kind", () => {
    expect(describeSchedule({ kind: "daily", timezone: "UTC", hour: 9, minute: 0 })).toBe(
      "Every day at 09:00",
    );
    expect(
      describeSchedule({
        kind: "weekly",
        timezone: "UTC",
        daysOfWeek: [5, 1],
        hour: 17,
        minute: 30,
      }),
    ).toBe("Mon, Fri at 17:30");
  });
});

describe("describeNextRun", () => {
  it("says due now for a time already passed", () => {
    // The runner ticks on an interval, so a past due time is normal.
    expect(describeNextRun(NOW - 60_000, NOW)).toBe("Due now");
  });

  it("scales the unit with the distance", () => {
    expect(describeNextRun(NOW + 15 * 60_000, NOW)).toBe("In 15 min");
    expect(describeNextRun(NOW + 3 * 60 * 60_000, NOW)).toBe("In 3 h");
    expect(describeNextRun(NOW + 5 * 24 * 60 * 60_000, NOW)).toBe("In 5 days");
  });

  it("distinguishes unscheduled from due", () => {
    expect(describeNextRun(null, NOW)).toBe("Not scheduled");
  });

  it("says plainly when a one-off's time has gone", () => {
    // A once schedule with no next occurrence never gets one, so "Not
    // scheduled" would leave the user guessing whether it is broken.
    expect(describeNextRun(null, NOW, { kind: "once", timezone: "UTC", at: NOW - 60_000 })).toBe(
      "Its scheduled time has passed",
    );
    expect(describeNextRun(null, NOW, { kind: "daily", timezone: "UTC", hour: 9, minute: 0 })).toBe(
      "Not scheduled",
    );
  });
});

describe("toSchedule", () => {
  it("builds a daily schedule from the form's clock", () => {
    expect(toSchedule({ ...DEFAULT_SCHEDULE_FORM, time: "07:45" }, "UTC", NOW)).toEqual({
      kind: "daily",
      timezone: "UTC",
      hour: 7,
      minute: 45,
    });
  });

  it("de-duplicates and sorts weekly days", () => {
    expect(
      toSchedule(
        { ...DEFAULT_SCHEDULE_FORM, kind: "weekly", daysOfWeek: [5, 1, 5], time: "08:00" },
        "UTC",
        NOW,
      ),
    ).toEqual({ kind: "weekly", timezone: "UTC", daysOfWeek: [1, 5], hour: 8, minute: 0 });
  });

  it("refuses a weekly schedule with no days", () => {
    expect(
      toSchedule({ ...DEFAULT_SCHEDULE_FORM, kind: "weekly", daysOfWeek: [] }, "UTC", NOW),
    ).toBeNull();
  });

  it("refuses a malformed clock", () => {
    expect(toSchedule({ ...DEFAULT_SCHEDULE_FORM, time: "9am" }, "UTC", NOW)).toBeNull();
    expect(toSchedule({ ...DEFAULT_SCHEDULE_FORM, time: "24:00" }, "UTC", NOW)).toBeNull();
  });

  it("refuses a one-shot in the past, which would never run", () => {
    const past = localInputValue(NOW - 60 * 60_000);
    expect(toSchedule({ ...DEFAULT_SCHEDULE_FORM, kind: "once", at: past }, "UTC", NOW)).toBeNull();
  });

  it("takes a one-shot in the future as a local wall-clock time", () => {
    const localValue = localInputValue(NOW + 60 * 60_000);

    const schedule = toSchedule(
      { ...DEFAULT_SCHEDULE_FORM, kind: "once", at: localValue },
      "UTC",
      NOW,
    );

    expect(schedule?.kind).toBe("once");
    expect(schedule?.kind === "once" ? schedule.at : 0).toBe(new Date(localValue).getTime());
  });
});
