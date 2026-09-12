// FILE: welcomeSetupStore.ts
// Purpose: Imperative handle on the first-run setup tour, so Settings (and any
//          other surface) can re-launch it without owning its state. Mirrors
//          themeEditorStore: the dialog lives above the router, callers only
//          ask for a session.

import { create } from "zustand";

import { WELCOME_SETUP_STEPS, type WelcomeSetupStepId } from "./welcomeSetup";

export type WelcomeSetupTrigger = "first-run" | "manual";

export type WelcomeSetupSession = {
  /**
   * Distinguishes two sessions that start on the same step, so asking for the
   * tour while it is already open restarts it instead of doing nothing.
   */
  id: number;
  startStep: WelcomeSetupStepId;
  trigger: WelcomeSetupTrigger;
};

type WelcomeSetupStore = {
  session: WelcomeSetupSession | null;
  openWelcomeSetup: (input?: {
    startStep?: WelcomeSetupStepId;
    trigger?: WelcomeSetupTrigger;
  }) => void;
  closeWelcomeSetup: () => void;
};

let nextSessionId = 0;

export const useWelcomeSetupStore = create<WelcomeSetupStore>((set) => ({
  session: null,
  openWelcomeSetup: (input) =>
    set({
      session: {
        id: ++nextSessionId,
        startStep: input?.startStep ?? WELCOME_SETUP_STEPS[0] ?? "welcome",
        trigger: input?.trigger ?? "manual",
      },
    }),
  closeWelcomeSetup: () => set({ session: null }),
}));

/** Re-run the setup tour from the beginning. */
export function openWelcomeSetup(input?: {
  startStep?: WelcomeSetupStepId;
  trigger?: WelcomeSetupTrigger;
}): void {
  useWelcomeSetupStore.getState().openWelcomeSetup(input);
}

export function closeWelcomeSetup(): void {
  useWelcomeSetupStore.getState().closeWelcomeSetup();
}
