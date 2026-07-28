// FILE: greeting.ts
// Purpose: Varied, time-of-day-aware landing greetings for the empty chat composer.
// Layer: Web UI copy
// Exports: randomHomeLandingGreeting, randomProjectLandingGreeting, LANDING_GREETING_PROJECT_TOKEN

/** Placeholder token inside a project greeting template, replaced by the caller
 * with a styled project-name element (kept as a plain string here so this module
 * stays JSX-free). */
export const LANDING_GREETING_PROJECT_TOKEN = "{project}";

type TimeBucket = "morning" | "afternoon" | "evening" | "night";

function timeBucketForHour(hour: number): TimeBucket {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const HOME_GREETINGS: Record<TimeBucket, readonly string[]> = {
  morning: [
    "Good morning. What should we work on?",
    "Morning — what are we building today?",
    "Good morning. Where should we start?",
  ],
  afternoon: [
    "Good afternoon. What should we work on?",
    "What are we tackling this afternoon?",
    "Good afternoon — where should we pick up?",
  ],
  evening: [
    "Good evening. What should we work on?",
    "Evening — what's on the list tonight?",
    "Good evening. Where should we start?",
  ],
  night: [
    "Burning the midnight oil? What should we work on?",
    "Late night session — what are we building?",
    "Still up? Let's get something done.",
  ],
};

const PROJECT_GREETINGS: Record<TimeBucket, readonly string[]> = {
  morning: [
    `Good morning. What should we do in ${LANDING_GREETING_PROJECT_TOKEN}?`,
    `Morning — what's next for ${LANDING_GREETING_PROJECT_TOKEN}?`,
  ],
  afternoon: [
    `What should we do in ${LANDING_GREETING_PROJECT_TOKEN}?`,
    `Where should we pick up in ${LANDING_GREETING_PROJECT_TOKEN}?`,
  ],
  evening: [
    `Good evening. What should we do in ${LANDING_GREETING_PROJECT_TOKEN}?`,
    `What's next for ${LANDING_GREETING_PROJECT_TOKEN} tonight?`,
  ],
  night: [
    `Still up? What should we do in ${LANDING_GREETING_PROJECT_TOKEN}?`,
    `Late one — what's next for ${LANDING_GREETING_PROJECT_TOKEN}?`,
  ],
};

function pickRandom(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!;
}

export function randomHomeLandingGreeting(date: Date = new Date()): string {
  return pickRandom(HOME_GREETINGS[timeBucketForHour(date.getHours())]);
}

export function randomProjectLandingGreeting(date: Date = new Date()): string {
  return pickRandom(PROJECT_GREETINGS[timeBucketForHour(date.getHours())]);
}
