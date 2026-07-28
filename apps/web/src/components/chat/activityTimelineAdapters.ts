import type { OrchestrationThreadActivity } from "@modesto/contracts";

export interface AdaptedTimelineActivity {
  readonly label: string;
  readonly detail?: string;
  readonly tone?: "info" | "tool" | "error";
}

const THREAD_LEVEL_ACTIVITY_PREFIXES = ["automation.openclaw.", "review."] as const;

export function isUnifiedThreadLevelActivity(kind: string): boolean {
  return THREAD_LEVEL_ACTIVITY_PREFIXES.some((prefix) => kind.startsWith(prefix));
}

/**
 * Lightweight adapters for cross-system events. Producers keep their native
 * event payloads; the transcript receives a stable display shape without
 * becoming a second orchestration model.
 */
export function adaptUnifiedTimelineActivity(
  activity: OrchestrationThreadActivity,
): AdaptedTimelineActivity | null {
  const payload =
    activity.payload && typeof activity.payload === "object"
      ? (activity.payload as Record<string, unknown>)
      : null;
  if (activity.kind === "automation.openclaw.received") {
    return {
      label: "OpenClaw submitted this task",
      tone: "info",
      ...(typeof payload?.sourceTaskId === "string"
        ? { detail: `Source task ${payload.sourceTaskId}` }
        : {}),
    };
  }
  if (activity.kind === "review.started") {
    return { label: "Modesto Review started", tone: "tool" };
  }
  if (activity.kind === "review.finding") {
    const file = typeof payload?.file === "string" ? payload.file : null;
    const severity = typeof payload?.severity === "string" ? payload.severity : null;
    const detail = [severity, file].filter(Boolean).join(" · ");
    return {
      label: activity.summary,
      tone: "info",
      ...(detail ? { detail } : {}),
    };
  }
  if (activity.kind === "review.completed") {
    return { label: activity.summary, tone: "info" };
  }
  if (activity.kind === "review.cancelled") {
    return { label: "Modesto Review cancelled", tone: "info" };
  }
  if (activity.kind === "review.failed") {
    return {
      label: "Modesto Review failed",
      tone: "error",
      ...(typeof payload?.error === "string" ? { detail: payload.error } : {}),
    };
  }
  return null;
}
