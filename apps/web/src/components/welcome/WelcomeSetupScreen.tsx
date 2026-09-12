// FILE: WelcomeSetupScreen.tsx
// Purpose: The first-run setup experience — a full-screen takeover, not a
//          dialog: on first launch the app behind it is empty anyway, and the
//          first thing a new user sees should be Modesto introducing itself.
//          Opens once per setup revision (`WELCOME_SETUP_VERSION`) and is
//          re-launchable any time from Settings → General.

import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckIcon,
  DicesIcon,
  FolderPlusIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TerminalIcon,
} from "lucide-react";
import { generateAvatarSpec, randomAvatarSeed } from "~/agents/avatar/agentAvatarRandom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { APP_BASE_NAME } from "~/branding";
import { openCommandPalette } from "~/commandPaletteBus";
import {
  useClientSettings,
  useClientSettingsHydrated,
  useUpdateClientSettings,
} from "~/hooks/useSettings";
import { useTheme } from "~/hooks/useTheme";
import { shortcutLabelForCommand } from "~/keybindings";
import { cn } from "~/lib/utils";
import { useProjects } from "~/state/entities";
import { primaryServerKeybindingsAtom, primaryServerProvidersAtom } from "~/state/server";
import { getDriverOption } from "~/components/settings/providerDriverMeta";
import { ModestoLogo } from "~/components/ModestoLogo";
import { AvatarLab } from "~/agents/AvatarLab";
import { useAgentBotStore } from "~/agents/agentBotStore";
import { Input } from "~/components/ui/input";
import { WelcomeHeroCluster } from "./WelcomeBrandArtwork";
import { WelcomeProjectFolder } from "./WelcomeProjectFolder";
import { WelcomeProviderRing } from "./WelcomeProviderRing";
import { WelcomeThemeGallery } from "./WelcomeThemeGallery";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFullScreenPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  advanceWelcomeSetupStep,
  isFinalWelcomeSetupStep,
  resolveWelcomeThemeSelection,
  selectWelcomeAgentProviders,
  shouldOpenWelcomeSetup,
  summarizeWelcomeAgent,
  summarizeWelcomeAgentRoster,
  WELCOME_SETUP_STEP_LABELS,
  WELCOME_SETUP_STEPS,
  WELCOME_SETUP_VERSION,
  welcomeSetupStepIndex,
  type WelcomeAgentReadiness,
  type WelcomeSetupStepId,
} from "./welcomeSetup";
import { openWelcomeSetup, useWelcomeSetupStore } from "./welcomeSetupStore";
import "./welcomeHero.css";

export function WelcomeSetupScreen() {
  const hydrated = useClientSettingsHydrated();
  const completedVersion = useClientSettings((settings) => settings.welcomeSetupCompletedVersion);
  const updateClientSettings = useUpdateClientSettings();
  const session = useWelcomeSetupStore((store) => store.session);
  const closeWelcomeSetup = useWelcomeSetupStore((store) => store.closeWelcomeSetup);
  const navigate = useNavigate();

  // Once per mount: a user who dismisses the tour and whose settings write
  // fails should not be re-prompted in a loop for the rest of the session.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!shouldOpenWelcomeSetup({ hydrated, completedVersion })) return;
    autoOpenedRef.current = true;
    openWelcomeSetup({ trigger: "first-run" });
  }, [completedVersion, hydrated]);

  const [step, setStep] = useState<WelcomeSetupStepId>(WELCOME_SETUP_STEPS[0] ?? "welcome");
  const sessionId = session?.id ?? null;
  const sessionStartStep = session?.startStep;
  useEffect(() => {
    if (sessionId === null || sessionStartStep === undefined) return;
    setStep(sessionStartStep);
  }, [sessionId, sessionStartStep]);

  // Dismissing and finishing both count as "seen": a tour someone closed is a
  // tour they have decided about, and re-opening it next launch is nagging.
  // Settings keeps it one click away.
  const complete = useCallback(() => {
    closeWelcomeSetup();
    if (completedVersion !== WELCOME_SETUP_VERSION) {
      updateClientSettings({ welcomeSetupCompletedVersion: WELCOME_SETUP_VERSION });
    }
  }, [closeWelcomeSetup, completedVersion, updateClientSettings]);

  // Handing off to another surface finishes the tour first, so the thing the
  // user asked for (settings page, project picker) is not left behind a
  // full-screen overlay.
  const completeAndOpenAddProject = useCallback(() => {
    complete();
    openCommandPalette({ open: "add-project" });
  }, [complete]);

  const completeAndOpenProviderSettings = useCallback(() => {
    complete();
    void navigate({ to: "/settings/providers" });
  }, [complete, navigate]);

  const stepIndex = welcomeSetupStepIndex(step);
  const isFinalStep = isFinalWelcomeSetupStep(step);

  return (
    <Dialog
      open={session !== null}
      onOpenChange={(open) => {
        if (!open) complete();
      }}
    >
      <DialogFullScreenPopup
        aria-label={`Welcome to ${APP_BASE_NAME}`}
        className="bg-[var(--background)]"
      >
        <header className="relative flex shrink-0 items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <div className="flex items-center gap-2.5">
            <ModestoLogo aria-hidden className="size-5" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {APP_BASE_NAME}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={complete}>
            {isFinalStep ? "Close" : "Skip setup"}
          </Button>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 sm:px-10">
          {/* Keyed on the step so each one plays its own entrance instead of
            swapping content inside a container that never re-mounts. */}
          <div
            key={step}
            className="welcome-rise m-auto flex w-full min-w-0 max-w-[1180px] items-center py-6 sm:py-8"
          >
            {step === "welcome" ? <WelcomeStep /> : null}
            {step === "appearance" ? <AppearanceStep /> : null}
            {step === "agents" ? (
              <AgentsStep onOpenAgentSettings={completeAndOpenProviderSettings} />
            ) : null}
            {step === "avatar" ? <AvatarStep /> : null}
            {step === "ready" ? <ReadyStep onAddProject={completeAndOpenAddProject} /> : null}
          </div>
        </main>

        <footer className="relative flex shrink-0 items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <WelcomeSetupProgress currentStep={step} onStepSelect={setStep} />
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? (
              <Button variant="outline" onClick={() => setStep(advanceWelcomeSetupStep(step, -1))}>
                Back
              </Button>
            ) : null}
            {isFinalStep ? (
              <Button onClick={complete}>Start building</Button>
            ) : (
              <Button onClick={() => setStep(advanceWelcomeSetupStep(step, 1))}>
                Continue
                <ArrowRightIcon />
              </Button>
            )}
          </div>
        </footer>
      </DialogFullScreenPopup>
    </Dialog>
  );
}

/**
 * The small label above each step heading. One component so every step's
 * eyebrow shares a size and a contrast — they were `text-muted-foreground` at
 * 10px over a tinted backdrop, which is below what this needs to be readable.
 */
function StepEyebrow({ children }: { readonly children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-foreground/70 uppercase">
      {children}
    </p>
  );
}

/**
 * Step dots. Deliberately small and out of the way in the footer: on a
 * full-screen surface the content is the wayfinding, and a heavy stepper
 * across the top would compete with the headline.
 */
function WelcomeSetupProgress({
  currentStep,
  onStepSelect,
}: {
  readonly currentStep: WelcomeSetupStepId;
  readonly onStepSelect: (step: WelcomeSetupStepId) => void;
}) {
  const currentIndex = welcomeSetupStepIndex(currentStep);
  return (
    <ol className="flex items-center gap-1.5" role="list">
      {WELCOME_SETUP_STEPS.map((step, index) => {
        const isCurrent = index === currentIndex;
        return (
          <li key={step}>
            <button
              type="button"
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${WELCOME_SETUP_STEP_LABELS[step]}, step ${index + 1} of ${WELCOME_SETUP_STEPS.length}`}
              className="group flex cursor-pointer items-center gap-2 rounded-full px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onStepSelect(step)}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200 ease-out",
                  isCurrent
                    ? "w-6 bg-primary"
                    : index < currentIndex
                      ? "w-1.5 bg-primary/50 group-hover:bg-primary/70"
                      : "w-1.5 bg-muted-foreground/25 group-hover:bg-muted-foreground/45",
                )}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const WELCOME_NOTES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Hand a thread off",
    body: "Switch from Claude to Codex mid-plan. The files and the conversation come with you — no re-briefing.",
  },
  {
    title: "Your CLIs, this machine",
    body: "Agents run on the subscriptions you already pay for. Modesto does not resell tokens.",
  },
  {
    title: "One shared workspace",
    body: "Fifteen agents, one thread model. Projects, diffs, and pull requests stay together.",
  },
];

function WelcomeStep() {
  return (
    <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
      <div className="max-w-xl">
        <StepEyebrow>First launch</StepEyebrow>
        <DialogTitle className="mt-5 font-heading text-[clamp(2.75rem,6.2vw,5.1rem)] leading-[0.92] font-semibold tracking-[-0.04em]">
          Welcome to {APP_BASE_NAME}
        </DialogTitle>
        <p className="mt-5 font-heading text-[clamp(1.45rem,2.6vw,2.15rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground">
          Every agent.{" "}
          <span className="text-[color-mix(in_oklab,var(--primary)_38%,var(--foreground))]">
            One workspace.
          </span>
        </p>
        <DialogDescription className="mt-4 max-w-[46ch] text-base leading-relaxed sm:text-[17px]">
          This is the desk for the coding agents you already run. Pick one, hand the thread to
          another, and keep the plan when you switch.
        </DialogDescription>
        <ul className="mt-8 grid gap-5 border-t border-border/50 pt-6">
          {WELCOME_NOTES.map((note) => (
            <li key={note.title} className="grid gap-1">
              <p className="text-sm font-semibold tracking-tight text-foreground">{note.title}</p>
              <p className="max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
                {note.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <WelcomeHeroCluster />
    </div>
  );
}

/**
 * Create the first agent, face and all.
 *
 * The tour's one piece of creation rather than configuration, and the reason
 * it exists: a roster of characters only means anything if the user made one
 * themselves. It saves as soon as the name is filled in and the step is left
 * — asking a brand-new user to press "Create" inside a tour that already has
 * a Continue button is one button too many — and skipping the step simply
 * creates nothing.
 */
function AvatarStep() {
  const bots = useAgentBotStore((state) => state.bots);
  const addBot = useAgentBotStore((state) => state.addBot);
  const updateBot = useAgentBotStore((state) => state.updateBot);

  const existing = bots[0];
  const [name, setName] = useState(existing?.name ?? "");
  const [tagline, setTagline] = useState(existing?.tagline ?? "");
  const [avatar, setAvatar] = useState(
    () => existing?.avatar ?? generateAvatarSpec(randomAvatarSeed()),
  );
  const createdIdRef = useRef<string | null>(existing?.id ?? null);

  // Persist on change rather than on a button: the footer's Continue is the
  // only affordance here, and losing a character the user just built because
  // they pressed it would be the worst possible first impression.
  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    const draft = {
      name: trimmed,
      tagline,
      persona: "",
      avatar,
      model: null,
      homeProjectKey: null,
    };
    const existingId = createdIdRef.current;
    if (existingId === null) {
      createdIdRef.current = addBot(draft).id;
      return;
    }
    updateBot(existingId, draft);
  }, [name, tagline, avatar, addBot, updateBot]);

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <div className="max-w-xl">
        <StepEyebrow>Your first agent</StepEyebrow>
        <DialogTitle className="mt-5 font-heading text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
          Give it a face
        </DialogTitle>
        <DialogDescription className="mt-4 max-w-[46ch] text-base leading-relaxed">
          Agents are teammates you keep — a name, a look, and a job. You will recognise this one in
          the roster and in the presence overlay long before you read its name.
        </DialogDescription>

        <div className="mt-7 grid gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Name</span>
            <Input
              value={name}
              maxLength={60}
              placeholder="Scout"
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">What it does</span>
            <Input
              value={tagline}
              maxLength={120}
              placeholder="Triages failing tests"
              onChange={(event) => setTagline(event.currentTarget.value)}
            />
          </label>
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <DicesIcon className="size-3.5 shrink-0" aria-hidden />
          Skip this step and no agent is created — you can build one any time from Agents.
        </p>
      </div>

      <div className="min-w-0 rounded-2xl border border-border/60 bg-card/30 p-5">
        <AvatarLab value={avatar} onChange={setAvatar} />
      </div>
    </div>
  );
}

const APPEARANCE_MODES = [
  { mode: "system", label: "System", Icon: MonitorIcon },
  { mode: "light", label: "Light", Icon: SunIcon },
  { mode: "dark", label: "Dark", Icon: MoonIcon },
] as const;

function AppearanceStep() {
  const { appearanceMode, setAppearanceMode, setTheme, theme, themeHalves, resolvedTheme } =
    useTheme();
  // With a light/dark mix in play the "active" theme is whichever half is
  // showing, not the base preference — otherwise no card looks selected.
  const activeThemeId = themeHalves?.[resolvedTheme] ?? theme;

  return (
    <div className="grid w-full min-w-0 gap-8">
      <div className="max-w-2xl">
        <StepEyebrow>Appearance</StepEyebrow>
        <DialogTitle className="mt-4 font-heading text-3xl leading-tight tracking-tight sm:text-4xl">
          Choose a look
        </DialogTitle>
        <DialogDescription className="mt-3 max-w-[52ch] text-base leading-relaxed">
          Each theme is a full palette — canvas, chrome, and one accent. Click a card and the
          workspace washes into it. You can change this any time in Settings.
        </DialogDescription>
      </div>

      <div aria-label="Appearance mode" className="flex flex-wrap gap-2" role="group">
        {APPEARANCE_MODES.map(({ mode, label, Icon }) => {
          const isActive = appearanceMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={isActive}
              aria-label={mode === "system" ? "Follow the system appearance" : `Use ${mode} mode`}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-transparent bg-accent/40 text-foreground"
                  : "border-border bg-card text-foreground/80 hover:bg-accent/20 hover:text-foreground",
              )}
              style={isActive ? { boxShadow: "inset 0 0 0 1px var(--ring)" } : undefined}
              onClick={() => setAppearanceMode(mode)}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Full-bleed: the fan is the subject of this step, and boxing it inside
        the text column made it read as a small widget rather than a shelf of
        physical cards. The negative margins undo the takeover's own padding. */}
      <div className="-mx-6 min-w-0 sm:-mx-10">
        <WelcomeThemeGallery
          selectedId={activeThemeId}
          appearance={resolvedTheme}
          onSelect={(themeId) => {
            void setTheme(resolveWelcomeThemeSelection({ themeId, appearanceMode }));
          }}
        />
      </div>
    </div>
  );
}

const AGENT_READINESS_DOT: Record<WelcomeAgentReadiness, string> = {
  ready: "bg-success",
  attention: "bg-warning",
  missing: "bg-muted-foreground/40",
};

function AgentsStep({ onOpenAgentSettings }: { readonly onOpenAgentSettings: () => void }) {
  const serverProviders = useAtomValue(primaryServerProvidersAtom);
  const providers = useMemo(() => selectWelcomeAgentProviders(serverProviders), [serverProviders]);
  const roster = useMemo(() => summarizeWelcomeAgentRoster(serverProviders), [serverProviders]);

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      <div className="max-w-xl">
        <StepEyebrow>Agents</StepEyebrow>
        <DialogTitle className="mt-4 font-heading text-3xl leading-tight tracking-tight sm:text-4xl">
          {roster.detectedLabel ?? roster.headline}
        </DialogTitle>
        <DialogDescription className="mt-3 max-w-[48ch] text-base leading-relaxed">
          {APP_BASE_NAME} drives the agent CLIs installed on this machine. Install one or sign in
          and it appears here — no restart needed.
        </DialogDescription>
        {providers.length > 0 ? (
          <ul className="mt-8 grid gap-2">
            {providers
              .filter((provider) => summarizeWelcomeAgent(provider).readiness !== "missing")
              .slice(0, 6)
              .map((provider) => {
                const driver = getDriverOption(provider.driver);
                const summary = summarizeWelcomeAgent(provider);
                return (
                  <li
                    key={provider.instanceId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate font-medium text-foreground">
                      {provider.displayName ?? driver?.label ?? provider.instanceId}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-foreground/70">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          AGENT_READINESS_DOT[summary.readiness],
                        )}
                      />
                      {summary.detail}
                    </span>
                  </li>
                );
              })}
          </ul>
        ) : null}
        <Button className="mt-8" variant="outline" onClick={onOpenAgentSettings}>
          Open agent settings
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-16 text-center">
          <TerminalIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            Waiting for this environment to report which agents it can run.
          </p>
        </div>
      ) : (
        <WelcomeProviderRing
          providers={
            roster.installedCount > 0
              ? providers.filter((provider) => provider.installed)
              : providers
          }
          installedCount={roster.installedCount}
        />
      )}
    </div>
  );
}

function ReadyStep({ onAddProject }: { readonly onAddProject: () => void }) {
  const projects = useProjects();
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const paletteShortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const hasProjects = projects.length > 0;

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
      <div className="max-w-xl">
        <StepEyebrow>Your workspace</StepEyebrow>
        <DialogTitle className="mt-4 font-heading text-3xl leading-tight tracking-tight sm:text-4xl">
          {hasProjects ? "You're set up" : "Start a project"}
        </DialogTitle>
        <DialogDescription className="mt-3 max-w-[48ch] text-base leading-relaxed">
          {hasProjects
            ? `${projects.length === 1 ? "1 project is" : `${projects.length} projects are`} already connected. Pick one in the sidebar and start a thread.`
            : `A project is just a folder on this machine. ${APP_BASE_NAME} keeps every thread, diff and pull request about it together.`}
        </DialogDescription>
        <ul className="mt-8 grid gap-3">
          <ReadyTip
            text={
              paletteShortcut
                ? `Press ${paletteShortcut} for the command palette — projects, threads and every action.`
                : "The command palette holds projects, threads and every action."
            }
          />
          <ReadyTip text="Switch agent or model per thread from the composer; each thread remembers its own." />
          <ReadyTip text="This tour lives in Settings → General if you want it again." />
        </ul>
      </div>

      <div className="grid gap-5">
        <WelcomeProjectFolder />
        <button
          type="button"
          onClick={onAddProject}
          className="welcome-project-card flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="welcome-project-mark grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_18%,var(--background))] text-[color-mix(in_oklab,var(--primary)_55%,var(--foreground))]"
          >
            <FolderPlusIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold tracking-tight text-foreground">
              {hasProjects ? "Add another project" : "Add your first project"}
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Choose a folder, or clone a repository from GitHub.
            </span>
          </span>
          <ArrowRightIcon
            className="welcome-project-arrow size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}

function ReadyTip({ text }: { readonly text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/75">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <span>{text}</span>
    </li>
  );
}
