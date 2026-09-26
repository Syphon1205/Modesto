// FILE: WelcomeSetupScreen.tsx
// Purpose: The optional setup tour. It is re-launchable from Settings →
//          General and uses the same compact, two-pane dialog language as the
//          current app shell.

import { useAtomValue } from "@effect/atom-react";
import {
  ArrowRightIcon,
  CheckIcon,
  CpuIcon,
  FolderPlusIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  RocketIcon,
  SunIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { APP_BASE_NAME } from "~/branding";
import { openCommandPalette } from "~/commandPaletteBus";
import { useAppNavigate } from "~/hooks/useAppNavigate";
import { useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";
import { useTheme } from "~/hooks/useTheme";
import { shortcutLabelForCommand } from "~/keybindings";
import { cn } from "~/lib/utils";
import { useProjects } from "~/state/entities";
import { primaryServerKeybindingsAtom, primaryServerProvidersAtom } from "~/state/server";
import { getDriverOption } from "~/components/settings/providerDriverMeta";
import { ModestoLogo } from "~/components/ModestoLogo";
import { WelcomeThemeGallery } from "./WelcomeThemeGallery";
import { Button } from "~/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "~/components/ui/dialog";
import {
  advanceWelcomeSetupStep,
  isFinalWelcomeSetupStep,
  resolveWelcomeThemeSelection,
  selectWelcomeAgentProviders,
  summarizeWelcomeAgent,
  summarizeWelcomeAgentRoster,
  WELCOME_SETUP_STEP_LABELS,
  WELCOME_SETUP_STEPS,
  WELCOME_SETUP_VERSION,
  welcomeSetupStepIndex,
  type WelcomeAgentReadiness,
  type WelcomeSetupStepId,
} from "./welcomeSetup";
import { useWelcomeSetupStore } from "./welcomeSetupStore";
import "./welcomeHero.css";

export function WelcomeSetupScreen() {
  const completedVersion = useClientSettings((settings) => settings.welcomeSetupCompletedVersion);
  const updateClientSettings = useUpdateClientSettings();
  const session = useWelcomeSetupStore((store) => store.session);
  const closeWelcomeSetup = useWelcomeSetupStore((store) => store.closeWelcomeSetup);
  const navigate = useAppNavigate();

  // Older hot-reloaded clients can still have a first-run session in the
  // Zustand store. Close it so upgrading to this behavior immediately returns
  // control of the visible sidebar to the user.
  useEffect(() => {
    if (session?.trigger === "first-run") {
      closeWelcomeSetup();
    }
  }, [closeWelcomeSetup, session?.trigger]);

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
      <DialogPopup
        aria-label={`Welcome to ${APP_BASE_NAME}`}
        showCloseButton={false}
        bottomStickOnMobile={false}
        data-welcome-setup=""
        data-interface-shell="github"
        className="flex h-[min(680px,calc(100dvh-48px))] w-[min(920px,calc(100vw-48px))] max-w-[920px] flex-row overflow-hidden rounded-xl border border-border bg-background p-0 shadow-[0_24px_60px_-18px_rgb(0_0_0/26%),0_4px_12px_rgb(0_0_0/8%)] max-sm:h-[calc(100dvh-24px)] max-sm:w-[calc(100vw-24px)] max-sm:flex-col"
      >
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-muted/20 p-3 max-sm:w-full max-sm:border-r-0 max-sm:border-b">
          <div className="flex h-9 items-center gap-2 px-2">
            <ModestoLogo aria-hidden className="size-4" />
            <span className="text-[13px] font-semibold text-foreground">{APP_BASE_NAME}</span>
          </div>
          <WelcomeSetupProgress currentStep={step} onStepSelect={setStep} />
          <p className="mt-auto px-2 pb-1 text-[11px] leading-4 text-muted-foreground max-sm:hidden">
            You can revisit setup any time from Settings.
          </p>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border/70 px-5">
            <p className="text-xs text-muted-foreground">
              Step {stepIndex + 1} of {WELCOME_SETUP_STEPS.length}
            </p>
            <Button size="icon-xs" variant="ghost" aria-label="Close setup" onClick={complete}>
              <XIcon />
            </Button>
          </header>

          <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 sm:px-8">
            {/* Keyed on the step so each one plays its own entrance instead of
              swapping content inside a container that never re-mounts. */}
            <div
              key={step}
              className="welcome-rise mx-auto flex w-full max-w-[640px] flex-1 items-center py-8"
            >
              {step === "welcome" ? <WelcomeStep /> : null}
              {step === "appearance" ? <AppearanceStep /> : null}
              {step === "agents" ? (
                <AgentsStep onOpenAgentSettings={completeAndOpenProviderSettings} />
              ) : null}
              {step === "ready" ? <ReadyStep onAddProject={completeAndOpenAddProject} /> : null}
            </div>
          </main>

          <footer className="flex min-h-[60px] shrink-0 items-center justify-between gap-4 border-t border-border/70 px-5 py-3">
            <Button variant="ghost" size="sm" onClick={complete}>
              {isFinalStep ? "Close" : "Skip setup"}
            </Button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStep(advanceWelcomeSetupStep(step, -1))}
                >
                  Back
                </Button>
              ) : null}
              {isFinalStep ? (
                <Button size="sm" className="copilot-primary-button" onClick={complete}>
                  Start building
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="copilot-primary-button"
                  onClick={() => setStep(advanceWelcomeSetupStep(step, 1))}
                >
                  Continue
                  <ArrowRightIcon />
                </Button>
              )}
            </div>
          </footer>
        </section>
      </DialogPopup>
    </Dialog>
  );
}

/**
 * The small label above each step heading. One component so every step's
 * eyebrow shares a size and a contrast — they were `text-muted-foreground` at
 * 10px over a tinted backdrop, which is below what this needs to be readable.
 */
function StepEyebrow({ children }: { readonly children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

/**
 * Compact step navigation shared by desktop and mobile layouts.
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
    <ol className="mt-4 grid gap-1 max-sm:grid-cols-4" role="list">
      {WELCOME_SETUP_STEPS.map((step, index) => {
        const isCurrent = index === currentIndex;
        const Icon = WELCOME_STEP_ICONS[step];
        return (
          <li key={step}>
            <button
              type="button"
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${WELCOME_SETUP_STEP_LABELS[step]}, step ${index + 1} of ${WELCOME_SETUP_STEPS.length}`}
              className={cn(
                "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring max-sm:justify-center max-sm:px-1",
                isCurrent
                  ? "bg-foreground/[0.07] font-medium text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
              )}
              onClick={() => onStepSelect(step)}
            >
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
                {index < currentIndex ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </span>
              <span className="max-sm:sr-only">{WELCOME_SETUP_STEP_LABELS[step]}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const WELCOME_STEP_ICONS: Record<WelcomeSetupStepId, typeof RocketIcon> = {
  welcome: RocketIcon,
  appearance: PaletteIcon,
  agents: CpuIcon,
  ready: FolderPlusIcon,
};

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
    <div className="w-full">
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/30">
        <ModestoLogo aria-hidden className="size-5" />
      </div>
      <div className="mt-5">
        <StepEyebrow>Welcome</StepEyebrow>
      </div>
      <DialogTitle className="mt-2 text-2xl leading-tight tracking-tight">
        Set up {APP_BASE_NAME}
      </DialogTitle>
      <DialogDescription className="mt-2 max-w-[58ch] text-sm leading-6">
        This is the desk for the coding agents you already run. Pick one, hand the thread to
        another, and keep the plan when you switch.
      </DialogDescription>
      <ul className="mt-7 grid gap-3 sm:grid-cols-3">
        {WELCOME_NOTES.map((note) => (
          <li key={note.title} className="rounded-lg border border-border bg-muted/15 p-4">
            <p className="text-[13px] font-semibold text-foreground">{note.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{note.body}</p>
          </li>
        ))}
      </ul>
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
    <div className="grid w-full min-w-0 gap-6">
      <div className="max-w-2xl">
        <StepEyebrow>Appearance</StepEyebrow>
        <DialogTitle className="mt-2 text-2xl leading-tight tracking-tight">
          Choose a look
        </DialogTitle>
        <DialogDescription className="mt-2 max-w-[58ch] text-sm leading-6">
          Choose an appearance and palette. You can change both any time in Settings.
        </DialogDescription>
      </div>

      <div
        aria-label="Appearance mode"
        className="flex w-fit rounded-lg bg-muted/60 p-1"
        role="group"
      >
        {APPEARANCE_MODES.map(({ mode, label, Icon }) => {
          const isActive = appearanceMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={isActive}
              aria-label={mode === "system" ? "Follow the system appearance" : `Use ${mode} mode`}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setAppearanceMode(mode)}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
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
  const displayedProviders = useMemo(
    () =>
      roster.installedCount > 0
        ? providers.filter((provider) => provider.installed)
        : providers.slice(0, 6),
    [providers, roster.installedCount],
  );

  return (
    <div className="w-full">
      <div className="max-w-2xl">
        <StepEyebrow>Providers</StepEyebrow>
        <DialogTitle className="mt-2 text-2xl leading-tight tracking-tight">
          {roster.detectedLabel ?? roster.headline}
        </DialogTitle>
        <DialogDescription className="mt-2 max-w-[58ch] text-sm leading-6">
          {APP_BASE_NAME} drives the coding provider CLIs installed on this machine. Install one or
          sign in and it appears here — no restart needed.
        </DialogDescription>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        {providers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <TerminalIcon className="mx-auto size-5 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-xs text-muted-foreground">
              Waiting for this environment to report which providers it can run.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {displayedProviders.map((provider) => {
              const driver = getDriverOption(provider.driver);
              const summary = summarizeWelcomeAgent(provider);
              const Icon = driver?.icon;
              return (
                <li
                  key={provider.instanceId}
                  className="flex min-h-11 items-center gap-3 px-4 text-sm"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/60">
                    {Icon ? (
                      <Icon className="size-4" aria-hidden />
                    ) : (
                      <TerminalIcon className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
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
        )}
      </div>
      <Button className="mt-4" size="sm" variant="outline" onClick={onOpenAgentSettings}>
        Open provider settings
      </Button>
    </div>
  );
}

function ReadyStep({ onAddProject }: { readonly onAddProject: () => void }) {
  const projects = useProjects();
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const paletteShortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const hasProjects = projects.length > 0;

  return (
    <div className="w-full">
      <div className="max-w-2xl">
        <StepEyebrow>Your workspace</StepEyebrow>
        <DialogTitle className="mt-2 text-2xl leading-tight tracking-tight">
          {hasProjects ? "You're set up" : "Start a project"}
        </DialogTitle>
        <DialogDescription className="mt-2 max-w-[58ch] text-sm leading-6">
          {hasProjects
            ? `${projects.length === 1 ? "1 project is" : `${projects.length} projects are`} already connected. Pick one in the sidebar and start a thread.`
            : `A project is just a folder on this machine. ${APP_BASE_NAME} keeps every thread, diff and pull request about it together.`}
        </DialogDescription>
        <ul className="mt-6 grid gap-3">
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
      <div className="mt-7 grid gap-3">
        <button
          type="button"
          onClick={onAddProject}
          className="welcome-project-card flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border bg-background px-4 py-4 text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="welcome-project-mark grid size-9 shrink-0 place-items-center rounded-md bg-muted text-foreground"
          >
            <FolderPlusIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-foreground">
              {hasProjects ? "Add another project" : "Add your first project"}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
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
