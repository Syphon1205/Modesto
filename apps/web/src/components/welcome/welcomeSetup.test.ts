import { describe, expect, it } from "vitest";
import type { ServerProvider } from "@modesto/contracts";

import {
  advanceWelcomeSetupStep,
  isWelcomeDefaultThemeActive,
  resolveWelcomeThemeSelection,
  welcomeProviderMarkUrl,
  welcomeRingLayout,
  WELCOME_DEFAULT_THEME_ID,
  isFinalWelcomeSetupStep,
  selectWelcomeAgentProviders,
  shouldOpenWelcomeSetup,
  formatWelcomeDetectedLabel,
  summarizeWelcomeAgent,
  summarizeWelcomeAgentRoster,
  WELCOME_SETUP_STEPS,
  WELCOME_SETUP_VERSION,
  welcomeSetupStepIndex,
} from "./welcomeSetup";

// `instanceId` and `driver` are branded in the contract; the fixture takes
// plain strings and casts once, so each case reads as the data it is testing.
type ProviderFixture = { readonly instanceId: string } & Partial<
  Omit<ServerProvider, "instanceId" | "auth">
> & { readonly auth?: { readonly status: string } };

function makeProvider(overrides: ProviderFixture): ServerProvider {
  return {
    driver: "codex",
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-09-08T00:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...overrides,
  } as unknown as ServerProvider;
}

describe("shouldOpenWelcomeSetup", () => {
  it("stays closed until client settings hydrate", () => {
    // The pre-hydration snapshot is the schema defaults, where the completed
    // version is empty — opening on it flashes the tour at returning users.
    expect(shouldOpenWelcomeSetup({ hydrated: false, completedVersion: "" })).toBe(false);
  });

  it("opens for a client that has never seen setup", () => {
    expect(shouldOpenWelcomeSetup({ hydrated: true, completedVersion: "" })).toBe(true);
  });

  it("stays closed once the current revision is recorded", () => {
    expect(
      shouldOpenWelcomeSetup({ hydrated: true, completedVersion: WELCOME_SETUP_VERSION }),
    ).toBe(false);
  });

  it("re-opens when the setup revision moves on", () => {
    expect(
      shouldOpenWelcomeSetup({
        hydrated: true,
        completedVersion: "0.3.0",
        currentVersion: "0.4.0",
      }),
    ).toBe(true);
  });

  it("treats a padded stored version as the same revision", () => {
    expect(
      shouldOpenWelcomeSetup({
        hydrated: true,
        completedVersion: "  0.4.0 ",
        currentVersion: "0.4.0",
      }),
    ).toBe(false);
  });
});

describe("welcome setup steps", () => {
  it("clamps at the first step instead of wrapping to the finish", () => {
    expect(advanceWelcomeSetupStep("welcome", -1)).toBe("welcome");
  });

  it("clamps at the final step", () => {
    const final = WELCOME_SETUP_STEPS[WELCOME_SETUP_STEPS.length - 1]!;
    expect(advanceWelcomeSetupStep(final, 1)).toBe(final);
    expect(isFinalWelcomeSetupStep(final)).toBe(true);
  });

  it("walks forward through every step in order", () => {
    let step = WELCOME_SETUP_STEPS[0]!;
    const visited = [step];
    for (let index = 1; index < WELCOME_SETUP_STEPS.length; index += 1) {
      step = advanceWelcomeSetupStep(step, 1);
      visited.push(step);
    }
    expect(visited).toEqual([...WELCOME_SETUP_STEPS]);
    expect(welcomeSetupStepIndex(visited[1]!)).toBe(1);
  });
});

describe("summarizeWelcomeAgent", () => {
  it("reports a missing CLI before anything else", () => {
    const summary = summarizeWelcomeAgent(
      makeProvider({ instanceId: "codex", installed: false, enabled: false }),
    );
    expect(summary.readiness).toBe("missing");
  });

  it("separates installed-but-disabled from installed-but-signed-out", () => {
    expect(
      summarizeWelcomeAgent(makeProvider({ instanceId: "codex", enabled: false })).detail,
    ).toBe("Installed, turned off");
    expect(
      summarizeWelcomeAgent(
        makeProvider({ instanceId: "codex", auth: { status: "unauthenticated" } }),
      ).detail,
    ).toBe("Installed, not signed in");
  });

  it("calls an installed, authenticated provider ready", () => {
    expect(summarizeWelcomeAgent(makeProvider({ instanceId: "codex" })).readiness).toBe("ready");
  });
});

describe("selectWelcomeAgentProviders", () => {
  it("drops drivers this build does not ship", () => {
    const providers = selectWelcomeAgentProviders([
      makeProvider({ instanceId: "codex" }),
      makeProvider({
        instanceId: "ghost",
        availability: "unavailable",
        installed: false,
        enabled: false,
      }),
    ]);
    expect(providers.map((provider) => provider.instanceId)).toEqual(["codex"]);
  });

  it("puts what already works first", () => {
    const providers = selectWelcomeAgentProviders([
      makeProvider({ instanceId: "missing", installed: false, enabled: false }),
      makeProvider({ instanceId: "attention", enabled: false }),
      makeProvider({ instanceId: "ready" }),
    ]);
    expect(providers.map((provider) => provider.instanceId)).toEqual([
      "ready",
      "attention",
      "missing",
    ]);
  });
});

describe("formatWelcomeDetectedLabel", () => {
  it("stays quiet until something is actually installed", () => {
    expect(formatWelcomeDetectedLabel(0)).toBeNull();
  });

  it("names the machine scan in singular and plural", () => {
    expect(formatWelcomeDetectedLabel(1)).toBe("Detected 1 provider");
    expect(formatWelcomeDetectedLabel(7)).toBe("Detected 7 providers");
  });
});

describe("summarizeWelcomeAgentRoster", () => {
  it("waits rather than claiming nothing is installed before the first probe", () => {
    expect(summarizeWelcomeAgentRoster([]).headline).toBe("Checking which agents are installed…");
  });

  it("says so when nothing is usable yet", () => {
    const roster = summarizeWelcomeAgentRoster([
      makeProvider({ instanceId: "codex", installed: false, enabled: false }),
    ]);
    expect(roster.readyCount).toBe(0);
    expect(roster.installedCount).toBe(0);
    expect(roster.detectedLabel).toBeNull();
    expect(roster.totalCount).toBe(1);
    expect(roster.headline).toContain("No agents are ready yet");
  });

  it("counts only ready agents, singular and plural", () => {
    expect(
      summarizeWelcomeAgentRoster([
        makeProvider({ instanceId: "codex" }),
        makeProvider({ instanceId: "claude", installed: false, enabled: false }),
      ]).headline,
    ).toBe("1 agent is ready to go.");
    expect(
      summarizeWelcomeAgentRoster([
        makeProvider({ instanceId: "codex" }),
        makeProvider({ instanceId: "claude" }),
      ]).headline,
    ).toBe("2 agents are ready to go.");
    expect(
      summarizeWelcomeAgentRoster([
        makeProvider({ instanceId: "codex" }),
        makeProvider({ instanceId: "claude" }),
        makeProvider({ instanceId: "cursor", installed: false, enabled: false }),
      ]).detectedLabel,
    ).toBe("Detected 2 providers");
  });
});

describe("welcomeRingLayout", () => {
  it("expresses the orbit radius in container units, never percentages", () => {
    // A percentage inside `translate()` resolves against the tile, not the
    // ring, which piled every provider in the middle of the circle.
    for (const count of [1, 6, 12]) {
      expect(welcomeRingLayout(count).radius).not.toContain("%");
      expect(welcomeRingLayout(count).radius).toContain("cqmin");
    }
  });

  it("spaces tiles evenly from twelve o'clock", () => {
    expect(welcomeRingLayout(4).angles).toEqual([-90, 0, 90, 180]);
  });

  it("shrinks the tiles once the ring gets crowded", () => {
    expect(welcomeRingLayout(12).tilePx).toBeLessThan(welcomeRingLayout(3).tilePx);
  });

  it("has no angles, and does not divide by zero, with nothing detected", () => {
    expect(welcomeRingLayout(0).angles).toEqual([]);
  });
});

describe("welcomeProviderMarkUrl", () => {
  it("maps driver slugs onto their differently named marks", () => {
    expect(welcomeProviderMarkUrl("claudeAgent")).toBe("/brand/marks/claude.svg");
    expect(welcomeProviderMarkUrl("githubCopilot")).toBe("/brand/marks/copilot.svg");
    expect(welcomeProviderMarkUrl("customAcp")).toBe("/brand/marks/acp.svg");
  });

  it("returns null rather than a 404 for a driver with no mark", () => {
    expect(welcomeProviderMarkUrl("somethingNew")).toBeNull();
  });
});

describe("theme selection", () => {
  it("persists a built-in theme by id", () => {
    expect(resolveWelcomeThemeSelection({ themeId: "ocean", appearanceMode: "dark" })).toBe(
      "ocean",
    );
  });

  it("expresses the default palette as a bare appearance preference", () => {
    expect(
      resolveWelcomeThemeSelection({
        themeId: WELCOME_DEFAULT_THEME_ID,
        appearanceMode: "system",
      }),
    ).toBe("system");
    expect(
      resolveWelcomeThemeSelection({ themeId: WELCOME_DEFAULT_THEME_ID, appearanceMode: "dark" }),
    ).toBe("dark");
  });

  it("treats any preference naming no installed theme as the default", () => {
    const installedThemeIds = ["modesto", "ocean"];
    expect(isWelcomeDefaultThemeActive({ selectedId: "system", installedThemeIds })).toBe(true);
    expect(isWelcomeDefaultThemeActive({ selectedId: "dark", installedThemeIds })).toBe(true);
    expect(isWelcomeDefaultThemeActive({ selectedId: "ocean", installedThemeIds })).toBe(false);
  });
});
