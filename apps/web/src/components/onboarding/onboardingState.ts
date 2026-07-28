// FILE: onboardingState.ts
// Purpose: Keep first-run eligibility and completion persistence independent from the UI.

export const ONBOARDING_COMPLETE_STORAGE_KEY = "modesto:onboarding-complete:v1";

export function hasCompletedOnboarding(storage: Pick<Storage, "getItem"> | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(storage: Pick<Storage, "setItem"> | null): void {
  if (!storage) return;
  try {
    storage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, "1");
  } catch {
    // Storage can be unavailable in hardened browser contexts. Completion still applies
    // for the current mounted session through component state.
  }
}

export function resolveOnboardingVisibility(input: {
  completed: boolean;
  hydrated: boolean;
  projectCount: number;
  threadCount: number;
}): "pending" | "show" | "skip-existing-workspace" | "hidden" {
  if (input.completed) return "hidden";
  if (!input.hydrated) return "pending";
  if (input.projectCount > 0 || input.threadCount > 0) return "skip-existing-workspace";
  return "show";
}
