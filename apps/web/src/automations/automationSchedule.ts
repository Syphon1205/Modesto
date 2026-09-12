// FILE: automationSchedule.ts
// Purpose: Turning a schedule into words, and a form into a schedule.
// Layer: Automations model (pure)
//
// Kept out of the component so the awkward parts - what "every day at 9:00"
// reads like, which weekday numbers mean what, how a local time entered in a
// form becomes the engine's absolute timestamp - are testable without
// rendering anything.

import type { AutomationSchedule } from "@modesto/contracts";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The timezone the browser is in; schedules are stored with one explicitly. */
export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function describeSchedule(schedule: AutomationSchedule): string {
  switch (schedule.kind) {
    case "once":
      return `Once, ${new Date(schedule.at).toLocaleString()}`;
    case "daily":
      return `Every day at ${formatClock(schedule.hour, schedule.minute)}`;
    case "weekly": {
      const days = schedule.daysOfWeek
        .toSorted((left, right) => left - right)
        .map((day) => WEEKDAY_LABELS[day] ?? "?")
        .join(", ");
      return `${days} at ${formatClock(schedule.hour, schedule.minute)}`;
    }
  }
}

/**
 * What a row says about when it runs next.
 *
 * The `once` case is the one worth spelling out: a one-shot whose time has
 * passed has no next occurrence and never will, so "Not scheduled" would leave
 * the user guessing whether it is broken or merely waiting.
 */
export function describeNextRun(
  nextDueAt: number | null,
  now: number,
  schedule?: AutomationSchedule,
): string {
  if (nextDueAt === null) {
    return schedule?.kind === "once" ? "Its scheduled time has passed" : "Not scheduled";
  }
  const deltaMs = nextDueAt - now;
  // A due time in the past means the runner has not picked it up yet, which is
  // a real state (the tick interval) rather than an error.
  if (deltaMs <= 0) return "Due now";
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `In ${hours} h`;
  return `In ${Math.round(hours / 24)} days`;
}

export interface ScheduleFormValue {
  readonly kind: AutomationSchedule["kind"];
  /** "HH:MM" as typed into a time input. */
  readonly time: string;
  readonly daysOfWeek: ReadonlyArray<number>;
  /** ISO-ish local value from a datetime-local input, for `once`. */
  readonly at: string;
}

export const DEFAULT_SCHEDULE_FORM: ScheduleFormValue = {
  kind: "daily",
  time: "09:00",
  daysOfWeek: [1, 2, 3, 4, 5],
  at: "",
};

function parseClock(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Build the schedule to send, or `null` when the form cannot make one.
 *
 * `once` is the only kind carrying an absolute instant: a `datetime-local`
 * value is wall-clock in the user's own zone, so `new Date(value)` - which
 * parses it as local - is the correct conversion, and a time already in the
 * past is rejected rather than silently never running.
 */
export function toSchedule(
  form: ScheduleFormValue,
  timezone: string,
  now: number,
): AutomationSchedule | null {
  if (form.kind === "once") {
    if (!form.at.trim()) return null;
    const at = new Date(form.at).getTime();
    if (!Number.isFinite(at) || at <= now) return null;
    return { kind: "once", timezone, at };
  }

  const clock = parseClock(form.time);
  if (!clock) return null;

  if (form.kind === "daily") {
    return { kind: "daily", timezone, hour: clock.hour, minute: clock.minute };
  }

  const daysOfWeek = [...new Set(form.daysOfWeek)].toSorted((left, right) => left - right);
  if (daysOfWeek.length === 0) return null;
  return { kind: "weekly", timezone, daysOfWeek, hour: clock.hour, minute: clock.minute };
}
