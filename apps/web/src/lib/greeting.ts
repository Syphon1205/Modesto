// FILE: greeting.ts
// Purpose: Time-of-day landing greetings for the empty chat composer.
//          Short, dry, code-flavored — the first thing people see on open.
//          Code mode and chat mode keep separate joke arsenals.
// Exports: randomHomeLandingGreeting, randomProjectLandingGreeting,
//          randomChatLandingGreeting, LANDING_GREETING_PROJECT_TOKEN

/** Placeholder token inside a project greeting template, replaced by the caller
 *  with the live project-name control (or the title when the picker is hidden). */
export const LANDING_GREETING_PROJECT_TOKEN = "{project}";

type TimeBucket = "morning" | "afternoon" | "evening" | "night";

function timeBucketForHour(hour: number): TimeBucket {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const CODE_HOME_ANY: readonly string[] = [
  "Who is Json?",
  "There's no place like 127.0.0.1",
  "Stack Overflow is loading. Emotionally.",
  "Copy. Paste. Pray.",
  "I accept this answer.",
  'Marked as duplicate of "it works"',
  "It's not a bug until it's in main.",
  "worksOnMyMachine()",
  "Have you tried turning it off and on again?",
  "Hello world. Again.",
  "npm install coffee",
  "May the source be with you.",
  "Who left this semicolon here?",
  "undefined is not a function. You might be.",
  "Git happens.",
  "Merge conflicts are just spicy diffs.",
  "I don't always test. When I do, it's in prod.",
  "9,001 tabs. All Stack Overflow.",
  "This meeting could have been a PR.",
  "The tests passed. Suspicious.",
  'console.log("still here")',
  "sudo make me a sandwich",
  "!false — it's funny because it's true",
  "A SQL query walks into a bar. Can I join you?",
  "I'll just vibe-code it.",
  "Prompt it till it compiles.",
  "Production is the only staging we have.",
  "CI is red. So is my face.",
  "We don't talk about node_modules.",
  'The PR is "small." It is not.',
  "git blame is a lifestyle.",
  "Who pushed to prod on a Friday?",
  "It's always DNS.",
  "It's always a cache issue.",
  "It's always a timezone.",
  "I'll refactor it later. I won't.",
  "Technical debt is just spicy TODO.",
  "Now you have two problems. (It's regex.)",
  "I'll just add another useEffect.",
  "z-index: 9999 and a prayer",
  "TypeScript said no. I said please.",
  "as unknown as any",
  "Promise.reject(monday)",
  "Off by one. Again.",
  "418 I'm a teapot",
  "Did you clear the cache?",
  "Rubber duck is on PTO.",
  "Accepted answer from 2013. Still works. Maybe.",
  "YAML indentation is a lifestyle.",
  "Tabs vs spaces: the civil war continues.",
  "rm -rf doubts",
  "TODO: become sentient",
  "hotfix incoming",
  "Approved with comments I'll ignore",
  "npm audit fix --force and faith",
  "It rendered. Don't ask how.",
];

const CODE_HOME_BY_TIME: Record<TimeBucket, readonly string[]> = {
  morning: [
    "git checkout morning",
    "Standup in 10. No updates. Classic.",
    "Boot sequence: coffee, then code.",
    "Inbox zero. Bug count: not zero.",
    "Fresh branch. Fresh lies.",
    "npm run start-the-day",
    "The build is still yellow. Good morning.",
    "Did yesterday's deploy survive the night?",
  ],
  afternoon: [
    "Time for a hot reload.",
    "Post-lunch compile. Wish us luck.",
    "The 2pm slump is just GC pause.",
    'Afternoon: prime time for a "quick" refactor.',
    "Still not a bug. Still in main.",
    "CI has been thinking about it.",
    "Lunch is over. The stack trace isn't.",
    "Ship it before standup tomorrow.",
  ],
  evening: [
    "One more commit. Famous last words.",
    "LGTM. What's next?",
    "Shipping after dark.",
    "Evening deploy. Living dangerously.",
    "The office is quiet. The pager isn't.",
    "Wrapping up. The tests disagree.",
    "Last PR of the day. Probably.",
    "Dinner, then one tiny fix.",
  ],
  night: [
    "404: sleep not found",
    'git commit -m "wip"',
    "while (awake) { code() }",
    "undefined at this hour",
    "Who is Json, and why is he awake?",
    "Burning the midnight oil?",
    "3am is a perfectly normal deploy window.",
    "The bug only reproduces after midnight.",
    "Sleep is a blocking call.",
    "Night shift: just me and the stack trace.",
  ],
};

const CODE_PROJECT_ANY: readonly string[] = [
  `Who is Json, and why is he in ${LANDING_GREETING_PROJECT_TOKEN}?`,
  `What should we break in ${LANDING_GREETING_PROJECT_TOKEN} today?`,
  `Let's vibe-code ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `Prompt it till ${LANDING_GREETING_PROJECT_TOKEN} compiles.`,
  `It's not a bug until it's in ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `worksOnMyMachine("${LANDING_GREETING_PROJECT_TOKEN}")`,
  `Copy. Paste. Pray. Then ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `Stack Overflow opened ${LANDING_GREETING_PROJECT_TOKEN} for a reason.`,
  `What's on fire in ${LANDING_GREETING_PROJECT_TOKEN}?`,
  `git blame ${LANDING_GREETING_PROJECT_TOKEN} is a lifestyle.`,
  `Merge conflicts in ${LANDING_GREETING_PROJECT_TOKEN}. Spicy.`,
  `CI is red in ${LANDING_GREETING_PROJECT_TOKEN}. So am I.`,
  `The PR for ${LANDING_GREETING_PROJECT_TOKEN} is "small."`,
  `We don't talk about node_modules in ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `It's always DNS. Except in ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `I'll just add another useEffect to ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `TypeScript said no to ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `as unknown as ${LANDING_GREETING_PROJECT_TOKEN}`,
  `TODO forever: ${LANDING_GREETING_PROJECT_TOKEN}`,
  `Rubber ducking ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `Accepted answer, meet ${LANDING_GREETING_PROJECT_TOKEN}.`,
  `Who pushed ${LANDING_GREETING_PROJECT_TOKEN} to prod on a Friday?`,
  `hotfix incoming for ${LANDING_GREETING_PROJECT_TOKEN}`,
  `May the source of ${LANDING_GREETING_PROJECT_TOKEN} be with you.`,
  `Hello world. Ready for ${LANDING_GREETING_PROJECT_TOKEN}?`,
  `I'll refactor ${LANDING_GREETING_PROJECT_TOKEN} later. I won't.`,
];

const CODE_PROJECT_BY_TIME: Record<TimeBucket, readonly string[]> = {
  morning: [
    `npm install coffee. Then ${LANDING_GREETING_PROJECT_TOKEN}.`,
    `git checkout morning — ${LANDING_GREETING_PROJECT_TOKEN} is waiting.`,
    `Fresh branch for ${LANDING_GREETING_PROJECT_TOKEN}. Fresh lies.`,
    `Standup update: looking at ${LANDING_GREETING_PROJECT_TOKEN}.`,
    `Boot ${LANDING_GREETING_PROJECT_TOKEN}. Coffee is compiling.`,
  ],
  afternoon: [
    `Time to hot-reload ${LANDING_GREETING_PROJECT_TOKEN}.`,
    `Who left this semicolon in ${LANDING_GREETING_PROJECT_TOKEN}?`,
    `Post-lunch: just a tiny change in ${LANDING_GREETING_PROJECT_TOKEN}.`,
    `The 2pm slump vs ${LANDING_GREETING_PROJECT_TOKEN}.`,
    `Still compiling ${LANDING_GREETING_PROJECT_TOKEN}. Mentally.`,
  ],
  evening: [
    `One more commit in ${LANDING_GREETING_PROJECT_TOKEN}.`,
    `The tests passed in ${LANDING_GREETING_PROJECT_TOKEN}. Weird.`,
    `LGTM. What's next in ${LANDING_GREETING_PROJECT_TOKEN}?`,
    `console.log("${LANDING_GREETING_PROJECT_TOKEN}")`,
    `Evening deploy of ${LANDING_GREETING_PROJECT_TOKEN}. Bold.`,
    `Dinner, then one tiny fix in ${LANDING_GREETING_PROJECT_TOKEN}.`,
  ],
  night: [
    `404: sleep not found. ${LANDING_GREETING_PROJECT_TOKEN} is still here.`,
    `git commit -m "wip" — ${LANDING_GREETING_PROJECT_TOKEN}`,
    `undefined at this hour, but ${LANDING_GREETING_PROJECT_TOKEN} isn't.`,
    `while (awake) { ${LANDING_GREETING_PROJECT_TOKEN} }`,
    `Burning the midnight oil in ${LANDING_GREETING_PROJECT_TOKEN}?`,
    `3am is a normal deploy window for ${LANDING_GREETING_PROJECT_TOKEN}.`,
    `The bug in ${LANDING_GREETING_PROJECT_TOKEN} only shows up at night.`,
  ],
};

const CHAT_HOME_ANY: readonly string[] = [
  "Stack Overflow, but it talks back.",
  "Faster than waiting for a Slack reply.",
  "I'll mark this as accepted.",
  "Duplicate of every question you've ever had.",
  "Rubber duck, but with opinions.",
  "Ask me anything. Even regex.",
  "I read the docs so you don't have to.",
  "ELI5, or ELI-staff-engineer. Your call.",
  "No coworkers were pinged in this chat.",
  "Let's talk it through before we ship it.",
  'Closed as "works on my machine."',
  "I'll be your pair. You drive.",
  "No judgment. Well, a little judgment.",
  "Let's debug the idea first.",
  "Vibe-check the question.",
  "What's the actual question?",
  "Is this a rant or a ticket?",
  "Tell me what broke. Slowly.",
  "I can hear the stack trace from here.",
  "Let's not open Jira for this.",
  "I won't say RTFM. I'll just send the link.",
  "Your rubber duck learned to type.",
  "Office hours. No calendar invite.",
  "I'll answer. Then the follow-up.",
  "Start anywhere. I'll catch up.",
  "Unload the brain dump.",
  "This is a safe space for bad variable names.",
  "No, I will not join your Zoom.",
  "I brought opinions and a search index.",
  "Let's figure it out out loud.",
  "I'll be your second tab.",
  "Stack Overflow called. They're busy.",
  "Let's not @channel this.",
  "The answer is cache. Unless it's DNS.",
  "You prompt. I'll ramble productively.",
  "I can hold context. You hold coffee.",
  "Is this about the semicolon again?",
  "Tell Json I said hi.",
  "Why did the developer go broke? Bad cache.",
  "A rubber duck walks into a chat…",
  "This meeting could have been this box.",
  "Marked as needs more context. Kidding. Mostly.",
  "I have 30 years of comments. Some are even right.",
  "Let's not reinvent XML.",
  "Explain it like I skipped the RFC.",
  "I'll wait. Your compiler won't.",
  "Is this production, or are we vibing?",
  "Draw the rest of the owl. I'll help.",
  "Your move, Stack Overflow.",
  "I accept follow-up questions.",
  "Let's not make this a 40-comment thread.",
  "Peer review, but nicer.",
  "Hit me with the weird one first.",
  "I already opened the docs. You're welcome.",
];

const CHAT_HOME_BY_TIME: Record<TimeBucket, readonly string[]> = {
  morning: [
    "Coffee first. Then the question.",
    "Standup can wait. This can't.",
    "Morning brain dump. I'm ready.",
    "What kept you up, besides the inbox?",
    "Fresh day. Same unanswered question.",
    "Before Slack wakes up — ask me.",
    "Good morning. What's confusing?",
    "Booting empathy.exe…",
  ],
  afternoon: [
    "Post-lunch questions hit different.",
    'The 2pm "quick question" era.',
    "Afternoon: prime time to overthink an API.",
    "I'll take the question Slack left on read.",
    "Lunch is over. The confusion isn't.",
    "Need a second opinion that isn't your intern?",
    "This could have been a hallway chat.",
    "Walk me through it like I'm new here.",
  ],
  evening: [
    "One last question. Famous last words.",
    "Wrapping up, or just getting started?",
    "Evening office hours are open.",
    "Ask it now so you don't take it home.",
    "The team's offline. I'm not.",
    "End-of-day rubber ducking.",
    "What's the leftover thought?",
    "We can close the tabs after this. Maybe.",
  ],
  night: [
    "3am questions welcome.",
    "What's keeping you up? Besides this.",
    "We can spiral together.",
    "Insomnia and a well-formed question.",
    "Night shift: just us and the docs.",
    "Sleep is a blocking call. This isn't.",
    "The good questions show up after midnight.",
    "I won't tell your commit history you were here.",
    "404: teammates not found. I'm here.",
    "Go to bed after this. After this.",
  ],
};

function pickRandom(options: readonly string[]): string {
  return options[Math.floor(Math.random() * options.length)] ?? options[0] ?? "";
}

function pickFromPools(...pools: readonly (readonly string[])[]): string {
  return pickRandom(pools.flat());
}

export function randomHomeLandingGreeting(date: Date = new Date()): string {
  return pickFromPools(CODE_HOME_ANY, CODE_HOME_BY_TIME[timeBucketForHour(date.getHours())]);
}

export function randomProjectLandingGreeting(date: Date = new Date()): string {
  return pickFromPools(CODE_PROJECT_ANY, CODE_PROJECT_BY_TIME[timeBucketForHour(date.getHours())]);
}

export function randomChatLandingGreeting(date: Date = new Date()): string {
  return pickFromPools(CHAT_HOME_ANY, CHAT_HOME_BY_TIME[timeBucketForHour(date.getHours())]);
}
