import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2Icon, MonitorIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { isElectron } from "../../env";
import { ensureLocalApi } from "../../localApi";
import { cn } from "../../lib/utils";
import { githubAuthStatus, githubSignIn } from "../../state/githubAccountAuth";
import { primaryEnvironmentIdAtom } from "../../state/primaryEnvironment";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { squashAtomCommandFailure } from "@modesto/client-runtime/state/runtime";
import { GitHubIcon } from "../Icons";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { resolveSafeSignInRedirect } from "./signInRedirect";

const GITHUB_AUTH_POLL_MS = 1_500;
const GITHUB_DEVICE_LOGIN_URL = "https://github.com/login/device";

function MethodButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("w-full justify-start gap-3 px-4", disabled && "cursor-wait")}
      size="xl"
      variant="outline"
    >
      {icon}
      {label}
    </Button>
  );
}

async function openGitHubDeviceAuthUrl(verificationUri: string): Promise<boolean> {
  try {
    await ensureLocalApi().shell.openExternal(verificationUri);
    return true;
  } catch (error) {
    toastManager.add(
      stackedThreadToast({
        type: "warning",
        title: "Could not open GitHub",
        description:
          error instanceof Error ? error.message : "Open the device link below and enter the code.",
      }),
    );
    return false;
  }
}

export function AppSignInChooser({ redirect }: { readonly redirect?: string }) {
  const navigate = useNavigate();
  const [pane, setPane] = useState<"choose" | "github">("choose");
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const githubStatus = useEnvironmentQuery(
    environmentId === null ? null : githubAuthStatus({ environmentId, input: {} }),
  );
  const signIn = useAtomCommand(githubSignIn, { reportFailure: false });
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState(GITHUB_DEVICE_LOGIN_URL);
  const [browserOpened, setBrowserOpened] = useState(false);
  const [githubPending, setGithubPending] = useState(false);
  const [githubPolling, setGithubPolling] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const completionStarted = useRef(false);
  const githubReady = environmentId !== null && githubStatus.data?.installed === true;

  const finishGitHubSignIn = useCallback(() => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    setGithubPolling(false);

    const continueUrl = resolveSafeSignInRedirect(redirect, window.location.origin);
    const opener = window.opener;
    if (opener && !opener.closed) {
      opener.postMessage({ type: "modesto:github-authenticated" }, window.location.origin);
      window.close();
      if (window.closed) return;
    }

    if (continueUrl) {
      window.location.assign(continueUrl);
      return;
    }
    void navigate({ to: "/", replace: true });
  }, [navigate, redirect]);

  // Keep polling until authenticated — even if the user briefly leaves the GitHub pane.
  useEffect(() => {
    if (environmentId === null || !githubPolling) return;

    githubStatus.refresh();
    const poll = window.setInterval(() => {
      githubStatus.refresh();
    }, GITHUB_AUTH_POLL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") githubStatus.refresh();
    };
    const refreshWhenFocused = () => {
      githubStatus.refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenFocused);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenFocused);
    };
  }, [environmentId, githubPolling, githubStatus.refresh]);

  useEffect(() => {
    if (githubPolling && githubStatus.data?.authenticated) {
      finishGitHubSignIn();
    }
  }, [finishGitHubSignIn, githubPolling, githubStatus.data?.authenticated]);

  const startGitHub = useCallback(async () => {
    if (environmentId === null || githubPending) return;
    if (githubStatus.data !== null && !githubStatus.data.installed) {
      void navigate({ to: "/settings/connections" });
      return;
    }
    if (githubStatus.data?.authenticated) {
      finishGitHubSignIn();
      return;
    }
    completionStarted.current = false;
    setPane("github");
    setGithubPending(true);
    setSignInError(null);
    setBrowserOpened(false);
    setDeviceCode(null);
    setVerificationUri(GITHUB_DEVICE_LOGIN_URL);
    try {
      const result = await signIn({ environmentId, input: {} });
      if (result._tag === "Success") {
        const nextUri = result.value.verificationUri || GITHUB_DEVICE_LOGIN_URL;
        setDeviceCode(result.value.userCode);
        setVerificationUri(nextUri);
        setGithubPolling(true);
        const opened = await openGitHubDeviceAuthUrl(nextUri);
        setBrowserOpened(opened);
        return;
      }
      const error = squashAtomCommandFailure(result);
      const detail = error instanceof Error ? error.message : "GitHub sign-in failed to start.";
      setSignInError(detail);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "GitHub sign-in failed",
          description: detail,
        }),
      );
    } finally {
      setGithubPending(false);
    }
  }, [environmentId, finishGitHubSignIn, githubPending, githubStatus.data, navigate, signIn]);

  if (pane === "github") {
    return (
      <div className="space-y-5">
        <button
          type="button"
          className="rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setPane("choose");
          }}
        >
          All sign-in options
        </button>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Sign in with GitHub</h1>
        <p className="text-sm text-muted-foreground">
          {browserOpened
            ? "A browser tab opened to finish sign-in. Approve access there, then return here — this page updates automatically."
            : "Open GitHub to finish sign-in, then return here — this page updates automatically."}{" "}
          If needed, open{" "}
          <a
            className="text-primary underline underline-offset-2"
            href={verificationUri}
            rel="noreferrer"
            target="_blank"
            onClick={(event) => {
              event.preventDefault();
              void openGitHubDeviceAuthUrl(verificationUri).then(setBrowserOpened);
            }}
          >
            github.com/login/device
          </a>
          {deviceCode ? " and confirm this code." : "."}
        </p>
        <div className="flex justify-center py-2">
          {githubPending && deviceCode === null ? (
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <span className="rounded-lg bg-secondary px-4 py-2 font-mono text-lg tracking-[0.28em]">
              {deviceCode ?? "————"}
            </span>
          )}
        </div>
        {signInError ? <p className="text-center text-xs text-destructive">{signInError}</p> : null}
        {githubPolling ? (
          <p className="text-center text-xs text-muted-foreground">
            Waiting for GitHub approval… You’ll continue automatically once signed in.
          </p>
        ) : null}
        {!browserOpened && !githubPending ? (
          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={() => {
              void openGitHubDeviceAuthUrl(verificationUri).then(setBrowserOpened);
            }}
          >
            Open GitHub
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Choose how you want to continue.
        </p>
      </div>
      <div className="space-y-2.5">
        <MethodButton
          icon={
            githubPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <GitHubIcon className="size-4" />
            )
          }
          label={
            !githubReady && environmentId !== null && githubStatus.data !== null
              ? "Set up GitHub"
              : githubPolling
                ? "Waiting for GitHub…"
                : "Sign in with GitHub"
          }
          disabled={githubStatus.isPending || githubPending}
          onClick={() => {
            if (githubPolling) {
              setPane("github");
              return;
            }
            void startGitHub();
          }}
        />
        <MethodButton
          icon={<MonitorIcon className="size-4" />}
          label="Use a local user"
          onClick={() => {
            void navigate({ to: isElectron ? "/" : "/pair" });
          }}
        />
      </div>
      {environmentId === null && !isElectron ? (
        <p className="text-xs text-muted-foreground">
          GitHub sign-in needs a connected environment. Use a local user first, or add one in
          Connections.
        </p>
      ) : null}
      {githubPolling ? (
        <p className="text-xs text-muted-foreground">
          Still waiting for GitHub approval in your browser…
        </p>
      ) : null}
    </div>
  );
}
