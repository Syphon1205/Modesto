import { PROVIDER_DISPLAY_NAMES, type ProviderKind } from "@modesto/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useAppSettings } from "~/appSettings";
import { GitHubIcon } from "~/lib/icons";
import { gitGithubAuthQueryOptions, gitGithubSignInMutationOptions } from "~/lib/gitReactQuery";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import { useTheme, type ThemeMode } from "~/hooks/useTheme";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { ModestoLogo } from "~/components/ModestoLogo";
import { ProviderIcon } from "~/components/ProviderIcon";
import { GitHubDeviceCodeDialog } from "~/components/GitHubDeviceCodeDialog";
import { CheckIcon, Loader2Icon } from "~/lib/icons";

import {
  hasCompletedOnboarding,
  markOnboardingComplete,
  resolveOnboardingVisibility,
} from "./onboardingState";

const ONBOARDING_STEPS = ["welcome", "appearance", "provider", "github"] as const;
type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const FEATURED_PROVIDERS: readonly ProviderKind[] = ["codex", "claudeAgent", "cursor", "gemini"];

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  { value: "system", label: "System", description: "Follow this Mac" },
  { value: "dark", label: "Dark", description: "Easy on the eyes" },
  { value: "light", label: "Light", description: "Bright and clear" },
];

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function FirstRunOnboarding() {
  const navigate = useNavigate();
  const threadsHydrated = useStore((state) => state.threadsHydrated);
  // Chat and Studio have managed container projects even on a pristine install.
  // Only user-added repository projects count as existing work for onboarding.
  const projectCount = useStore(
    (state) => state.projects.filter((project) => project.kind === "project").length,
  );
  const threadCount = useStore((state) => state.threads.length);
  const [completed, setCompleted] = useState(() => hasCompletedOnboarding(browserStorage()));
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [awaitingGitHubSignIn, setAwaitingGitHubSignIn] = useState(false);
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useAppSettings();
  const [selectedProvider, setSelectedProvider] = useState<ProviderKind>(settings.defaultProvider);
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const githubAuthQuery = useQuery(
    gitGithubAuthQueryOptions({ refetchInterval: awaitingGitHubSignIn ? 2_000 : false }),
  );
  const githubSignInMutation = useMutation({
    ...gitGithubSignInMutationOptions(),
    onSuccess: () => {
      setAwaitingGitHubSignIn(true);
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not start GitHub sign-in",
        description: error instanceof Error ? error.message : "GitHub CLI sign-in failed.",
      });
    },
  });

  const visibility = resolveOnboardingVisibility({
    completed,
    hydrated: threadsHydrated,
    projectCount,
    threadCount,
  });
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const providerStatusByKind = useMemo(
    () => new Map(serverConfigQuery.data?.providers.map((status) => [status.provider, status])),
    [serverConfigQuery.data?.providers],
  );
  const selectedProviderStatus = providerStatusByKind.get(selectedProvider);
  const selectedProviderReady =
    selectedProviderStatus?.available === true &&
    selectedProviderStatus.authStatus !== "unauthenticated";

  useEffect(() => {
    if (visibility !== "skip-existing-workspace") return;
    markOnboardingComplete(browserStorage());
    setCompleted(true);
  }, [visibility]);

  useEffect(() => {
    if (visibility !== "pending" && visibility !== "show") return;
    const appSurface = document.querySelector<HTMLElement>("[data-modesto-app-surface]");
    if (!appSurface) return;
    appSurface.setAttribute("inert", "");
    appSurface.setAttribute("aria-hidden", "true");
    return () => {
      appSurface.removeAttribute("inert");
      appSurface.removeAttribute("aria-hidden");
    };
  }, [visibility]);

  useEffect(() => {
    if (githubAuthQuery.data?.authenticated) setAwaitingGitHubSignIn(false);
  }, [githubAuthQuery.data?.authenticated]);

  useEffect(() => {
    if (!awaitingGitHubSignIn) return;
    const timeout = window.setTimeout(() => setAwaitingGitHubSignIn(false), 120_000);
    return () => window.clearTimeout(timeout);
  }, [awaitingGitHubSignIn]);

  const finish = (destination: "home" | "providers" = "home") => {
    updateSettings({ defaultProvider: selectedProvider });
    markOnboardingComplete(browserStorage());
    setCompleted(true);
    if (destination === "providers") {
      void navigate({
        to: "/settings",
        search: {
          section: "providers",
          target: "provider-installs",
          provider: selectedProvider,
        },
      });
    }
  };

  if (visibility === "hidden" || visibility === "skip-existing-workspace") return null;

  if (visibility === "pending") {
    return (
      <div className="fixed inset-0 z-[210] flex items-center justify-center bg-background text-foreground">
        <ModestoLogo aria-label="Modesto" className="size-12 opacity-80" />
      </div>
    );
  }

  const goBack = () => setStep(ONBOARDING_STEPS[Math.max(0, stepIndex - 1)]!);
  const goNext = () => {
    if (step === "provider") updateSettings({ defaultProvider: selectedProvider });
    const next = ONBOARDING_STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Modesto"
      className="fixed inset-0 z-[210] overflow-auto bg-background text-foreground"
    >
      <div className="drag-region fixed inset-x-0 top-0 h-12" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_srgb,var(--color-background-elevated-secondary)_42%,transparent),transparent_42%)]" />

      <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <ModestoLogo aria-hidden className="size-5" />
          <span>Modesto</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[34rem]">
            {step === "welcome" ? (
              <div className="flex flex-col items-center text-center">
                <div className="mb-8 flex size-20 items-center justify-center rounded-[1.4rem] border border-border/60 bg-[var(--color-background-elevated-secondary)]">
                  <ModestoLogo aria-hidden className="size-11" />
                </div>
                <p className="mb-3 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Your agents, one workspace
                </p>
                <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                  Welcome to Modesto
                </h1>
                <p className="mt-4 max-w-md text-balance text-sm leading-6 text-muted-foreground sm:text-base">
                  Run Codex, Claude, Cursor, and more from one focused desktop workspace.
                </p>
              </div>
            ) : null}

            {step === "appearance" ? (
              <OnboardingSection
                eyebrow="Appearance"
                title="Make Modesto feel like yours"
                description="Choose a starting theme. You can change every detail later."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {THEME_OPTIONS.map(({ value, label, description }) => {
                    const selected = theme === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          "group relative rounded-xl border p-3 text-left transition-colors",
                          selected
                            ? "border-foreground/45 bg-[var(--color-background-elevated-secondary)]"
                            : "border-border/70 hover:border-foreground/25 hover:bg-[var(--color-background-elevated-secondary)]/60",
                        )}
                        onClick={() => setTheme(value)}
                      >
                        <ThemePreview mode={value} />
                        <span className="mt-3 flex items-start">
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{label}</span>
                            <span className="block text-xs text-muted-foreground">
                              {description}
                            </span>
                          </span>
                        </span>
                        {selected ? (
                          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                            <CheckIcon className="size-3" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </OnboardingSection>
            ) : null}

            {step === "provider" ? (
              <OnboardingSection
                eyebrow="Agent"
                title="Choose your default provider"
                description="Modesto found the tools on this machine. Pick where new agents should start."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {FEATURED_PROVIDERS.map((provider) => {
                    const status = providerStatusByKind.get(provider);
                    const ready = status?.available && status.authStatus !== "unauthenticated";
                    const selected = selectedProvider === provider;
                    return (
                      <button
                        key={provider}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          "flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                          selected
                            ? "border-foreground/45 bg-[var(--color-background-elevated-secondary)]"
                            : "border-border/70 hover:border-foreground/25 hover:bg-[var(--color-background-elevated-secondary)]/60",
                        )}
                        onClick={() => setSelectedProvider(provider)}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                          <ProviderIcon provider={provider} className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {PROVIDER_DISPLAY_NAMES[provider]}
                          </span>
                          <span
                            className={cn(
                              "block text-xs",
                              ready ? "text-success" : "text-muted-foreground",
                            )}
                          >
                            {status ? (ready ? "Ready" : "Needs setup") : "Checking…"}
                          </span>
                        </span>
                        {selected ? <CheckIcon className="size-4 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Droid, Grok, Kilo, OpenCode, and Pi remain available in Providers.
                </p>
              </OnboardingSection>
            ) : null}

            {step === "github" ? (
              <OnboardingSection
                eyebrow="GitHub"
                title={
                  githubAuthQuery.data?.authenticated
                    ? "GitHub is connected"
                    : "Connect your GitHub account"
                }
                description={
                  githubAuthQuery.data?.authenticated
                    ? "Modesto can show your commits, push branches, and open pull requests."
                    : "Optional, but recommended for commits, branches, pull requests, and your profile activity."
                }
              >
                <div className="flex min-h-28 items-center gap-4 rounded-2xl border border-border/70 bg-[var(--color-background-elevated-secondary)]/55 px-5 py-4">
                  {githubAuthQuery.data?.avatarUrl ? (
                    <img
                      src={githubAuthQuery.data.avatarUrl}
                      alt=""
                      className="size-12 shrink-0 rounded-full bg-muted object-cover"
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
                      <GitHubIcon className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {githubAuthQuery.data?.authenticated
                        ? (githubAuthQuery.data.name ?? githubAuthQuery.data.login)
                        : "GitHub account"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {githubAuthQuery.data?.authenticated
                        ? `@${githubAuthQuery.data.login}`
                        : githubAuthQuery.data?.installed === false
                          ? "GitHub CLI needs to be installed first"
                          : awaitingGitHubSignIn && githubSignInMutation.data?.userCode
                            ? `Enter code ${githubSignInMutation.data.userCode} on GitHub`
                            : "Sign in securely through your browser"}
                    </span>
                  </span>
                  {githubAuthQuery.data?.authenticated ? (
                    <span className="flex items-center gap-1.5 text-xs text-success">
                      <CheckIcon className="size-3.5" /> Connected
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={
                        githubAuthQuery.isPending ||
                        githubSignInMutation.isPending ||
                        awaitingGitHubSignIn ||
                        githubAuthQuery.data?.installed === false
                      }
                      onClick={() => githubSignInMutation.mutate()}
                    >
                      {githubAuthQuery.isPending ||
                      githubSignInMutation.isPending ||
                      awaitingGitHubSignIn ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : null}
                      {awaitingGitHubSignIn ? "Waiting…" : "Sign in"}
                    </Button>
                  )}
                </div>
              </OnboardingSection>
            ) : null}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[34rem] items-center gap-4">
          <div
            className="flex flex-1 items-center gap-1.5"
            aria-label={`Step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}
          >
            {ONBOARDING_STEPS.map((candidate, index) => (
              <span
                key={candidate}
                className={cn(
                  "h-1 rounded-full transition-[width,background-color] duration-200",
                  index === stepIndex ? "w-6 bg-foreground" : "w-2 bg-muted-foreground/25",
                )}
              />
            ))}
          </div>

          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => finish("home")}>
              Skip setup
            </Button>
          )}

          {step === "github" ? (
            <Button
              autoFocus
              className="min-w-28"
              onClick={() => finish(selectedProviderReady ? "home" : "providers")}
            >
              {selectedProviderReady
                ? "Start building"
                : `Set up ${PROVIDER_DISPLAY_NAMES[selectedProvider]}`}
              <span className="opacity-60">↵</span>
            </Button>
          ) : (
            <Button autoFocus className="min-w-24" onClick={goNext}>
              Continue <span className="opacity-60">↵</span>
            </Button>
          )}
        </div>
      </div>
      <GitHubDeviceCodeDialog
        open={awaitingGitHubSignIn}
        userCode={githubSignInMutation.data?.userCode ?? null}
        onOpenChange={(open) => {
          if (!open) setAwaitingGitHubSignIn(false);
        }}
      />
    </div>
  );
}

function OnboardingSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-7 text-center">
        <p className="mb-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function ThemePreview({ mode }: { mode: ThemeMode }) {
  const dark = mode !== "light";
  return (
    <span
      className={cn(
        "block h-20 overflow-hidden rounded-lg border p-2",
        dark ? "border-white/10 bg-[#111]" : "border-black/10 bg-[#f4f4f2]",
      )}
    >
      <span className="flex h-full gap-1.5">
        <span className={cn("w-[28%] rounded-sm", dark ? "bg-[#1d1d1d]" : "bg-[#dededb]")} />
        <span className={cn("flex-1 rounded-sm p-2", dark ? "bg-[#181818]" : "bg-white")}>
          <span className={cn("block h-1.5 w-3/4 rounded", dark ? "bg-white/16" : "bg-black/12")} />
          <span
            className={cn("mt-2 block h-1.5 w-1/2 rounded", dark ? "bg-white/10" : "bg-black/8")}
          />
        </span>
      </span>
    </span>
  );
}
