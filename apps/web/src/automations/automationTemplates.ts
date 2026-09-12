// FILE: automationTemplates.ts
// Purpose: Curated automation recipes for the Cursor-style gallery.
// Layer: Automations model (pure)

import type { ScheduleFormValue } from "./automationSchedule";

export type AutomationTemplateCategory =
  | "popular"
  | "review"
  | "security"
  | "triage"
  | "research"
  | "environment";

export type AutomationTemplate = {
  readonly id: string;
  readonly category: AutomationTemplateCategory;
  readonly popular?: boolean;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly schedule: ScheduleFormValue;
  readonly triggerLabel: string;
  readonly actionLabel: string;
  readonly icon: "bug" | "shield" | "search" | "sun" | "git" | "flask" | "inbox" | "zap";
};

export const AUTOMATION_TEMPLATE_CATEGORIES: ReadonlyArray<{
  readonly id: AutomationTemplateCategory | "all";
  readonly label: string;
}> = [
  { id: "popular", label: "Popular" },
  { id: "review", label: "Code Review" },
  { id: "security", label: "Security" },
  { id: "triage", label: "Incidents & Triage" },
  { id: "research", label: "Data & Research" },
  { id: "environment", label: "Environment" },
];

export const AUTOMATION_TEMPLATES: ReadonlyArray<AutomationTemplate> = [
  {
    id: "morning-digest",
    category: "research",
    popular: true,
    name: "Morning project digest",
    description: "Summarize overnight commits, open PRs, and anything that needs a decision.",
    instructions: `Each morning, inspect this workspace and write a short digest:

1. What changed since yesterday (commits, open PRs, failing checks if visible).
2. Anything blocked or waiting on review.
3. The three most useful next actions for today.

Keep it under one page. Prefer concrete file and PR references over vague advice.`,
    schedule: { kind: "daily", time: "09:00", daysOfWeek: [1, 2, 3, 4, 5], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "sun",
  },
  {
    id: "find-critical-bugs",
    category: "review",
    popular: true,
    name: "Find critical bugs",
    description: "Catch regressions and high-severity defects before they ship.",
    instructions: `Review recent changes in this workspace for critical bugs:

1. Focus on correctness, crashes, data loss, auth breaks, and broken happy paths.
2. Cite files and likely failure modes.
3. Propose the smallest safe fix for each issue you are confident about.
4. Skip style nits unless they hide a real bug.

Write a ranked report, highest severity first.`,
    schedule: { kind: "daily", time: "18:00", daysOfWeek: [1, 2, 3, 4, 5], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "bug",
  },
  {
    id: "security-scan",
    category: "security",
    popular: true,
    name: "Scan for vulnerabilities",
    description: "Look for secrets in logs, unsafe defaults, and dependency risk.",
    instructions: `Security triage this workspace:

1. Search for secrets written to plaintext logs, hardcoded credentials, and unsafe shell usage.
2. Flag obvious dependency or auth issues with concrete paths.
3. Rank findings High / Medium / Low and say how to fix each one.
4. Do not invent issues — only report what you can point to.`,
    schedule: { kind: "weekly", time: "10:00", daysOfWeek: [1], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "shield",
  },
  {
    id: "pr-summary",
    category: "review",
    popular: true,
    name: "Weekly PR review sweep",
    description: "Summarize open pull requests and call out what is stuck.",
    instructions: `Sweep open pull requests for this repository (use gh if available):

1. List open PRs with age, author, and review status.
2. Call out anything blocked, stale, or missing tests.
3. Suggest a review order for today.
4. Keep the write-up scannable.`,
    schedule: { kind: "weekly", time: "09:30", daysOfWeek: [1], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "git",
  },
  {
    id: "flaky-tests",
    category: "triage",
    name: "Hunt flaky tests",
    description: "Find intermittent failures and propose hardening or quarantine.",
    instructions: `Investigate flaky or intermittent tests in this workspace:

1. Look at recent test files, CI notes, and known flake patterns (timing, order, network).
2. Name the top suspects with paths.
3. Propose a concrete fix or quarantine for each.
4. Prefer evidence over speculation.`,
    schedule: { kind: "weekly", time: "14:00", daysOfWeek: [3], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "flask",
  },
  {
    id: "inbox-triage",
    category: "triage",
    name: "Triage needs-attention runs",
    description: "Re-check failed automation outcomes and propose next steps.",
    instructions: `Triage the latest failures and needs-attention signals in this workspace:

1. Summarize what broke and why.
2. Separate one-off failures from systemic ones.
3. Propose the next concrete action for each item.
4. Keep the response short enough to act on in five minutes.`,
    schedule: { kind: "daily", time: "17:00", daysOfWeek: [1, 2, 3, 4, 5], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "inbox",
  },
  {
    id: "codebase-map",
    category: "research",
    name: "Map the risky areas",
    description: "Research where complexity and change risk concentrate.",
    instructions: `Research this codebase and produce a risk map:

1. Hotspots with high churn or tangled dependencies.
2. Areas lacking tests relative to importance.
3. Three improvements that would reduce future incident risk.
Keep it specific to files and packages that exist here.`,
    schedule: { kind: "weekly", time: "11:00", daysOfWeek: [5], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "search",
  },
  {
    id: "env-health",
    category: "environment",
    name: "Nightly environment health",
    description: "Check tooling, lockfiles, and obvious workspace health issues.",
    instructions: `Run a nightly environment health check on this workspace:

1. Note broken scripts, stale lockfiles, missing docs for setup, or obvious CI mismatches.
2. Verify the project still has a clear way to install and run.
3. List only actionable issues with paths.
4. End with a green/yellow/red overall status.`,
    schedule: { kind: "daily", time: "22:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], at: "" },
    triggerLabel: "Scheduled",
    actionLabel: "Run agent",
    icon: "zap",
  },
];

export function templatesForCategory(
  category: AutomationTemplateCategory | "all",
): ReadonlyArray<AutomationTemplate> {
  if (category === "popular") {
    return AUTOMATION_TEMPLATES.filter((template) => template.popular);
  }
  if (category === "all") return AUTOMATION_TEMPLATES;
  return AUTOMATION_TEMPLATES.filter((template) => template.category === category);
}

export type FeaturedCapability = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly templateId: string;
  readonly icon: AutomationTemplate["icon"];
};

export const FEATURED_CAPABILITIES: ReadonlyArray<FeaturedCapability> = [
  {
    id: "review",
    title: "Review code on a schedule",
    description: "Catch bugs and draft fixes before they ship.",
    templateId: "find-critical-bugs",
    icon: "bug",
  },
  {
    id: "security",
    title: "Scan and triage security issues",
    description: "Security checks without waiting for a human to open chat.",
    templateId: "security-scan",
    icon: "shield",
  },
  {
    id: "digest",
    title: "Ship a morning digest",
    description: "Overnight changes, open PRs, and what to do next.",
    templateId: "morning-digest",
    icon: "sun",
  },
];
