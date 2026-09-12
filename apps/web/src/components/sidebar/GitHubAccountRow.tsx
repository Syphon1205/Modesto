import { useAtomValue } from "@effect/atom-react";
import { memo, useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChartNoAxesColumnIcon, Loader2Icon, LogOutIcon, SettingsIcon } from "lucide-react";

import { GitHubIcon } from "../Icons";
import { primaryEnvironmentIdAtom } from "../../state/primaryEnvironment";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { githubAuthStatus, githubSignOut } from "../../state/githubAccountAuth";
import { cn } from "../../lib/utils";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * The app's own GitHub identity row - sign-in status for the connected
 * primary environment. Unsigned users go to the in-app sign-in page.
 */
export const GitHubAccountRow = memo(function GitHubAccountRow() {
  const navigate = useNavigate();
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const status = useEnvironmentQuery(
    environmentId === null ? null : githubAuthStatus({ environmentId, input: {} }),
  );
  const signOut = useAtomCommand(githubSignOut, { reportFailure: false });

  // When the user returns from the GitHub device browser tab, refresh so the
  // sidebar reflects the new CLI auth state without requiring a remount.
  useEffect(() => {
    if (environmentId === null) return;
    const refresh = () => {
      if (document.visibilityState === "visible") status.refresh();
    };
    const refreshOnFocus = () => {
      status.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [environmentId, status.refresh]);

  const handleSignOut = useCallback(() => {
    if (environmentId === null) return;
    void signOut({ environmentId, input: {} });
  }, [environmentId, signOut]);

  if (environmentId === null) {
    return null;
  }

  const account = status.data;
  const notInstalled = account !== null && !account.installed;

  return (
    <div className="flex items-center gap-1">
      {account?.authenticated ? (
        <Menu>
          <MenuTrigger
            render={
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-sidebar-row-hover"
              />
            }
          >
            {account.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt=""
                className="size-7 shrink-0 rounded-full bg-muted object-cover"
              />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <GitHubIcon className="size-3.5" />
              </span>
            )}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs font-medium text-sidebar-foreground">
                {account.name ?? account.login}
              </span>
              <span className="block truncate text-[10px] text-sidebar-muted-foreground">
                @{account.login}
              </span>
            </span>
          </MenuTrigger>
          <MenuPopup align="start" side="top">
            <MenuItem
              onClick={() => {
                void navigate({
                  to: "/pull-requests",
                  search: { involvement: "all", state: "open" },
                });
              }}
            >
              Pull requests
            </MenuItem>
            <MenuItem variant="destructive" onClick={handleSignOut}>
              <LogOutIcon className="size-4" />
              Sign out
            </MenuItem>
          </MenuPopup>
        </Menu>
      ) : (
        <button
          type="button"
          disabled={status.isPending}
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-row-hover disabled:opacity-60",
          )}
          onClick={() => {
            if (notInstalled) {
              void navigate({ to: "/settings/connections" });
              return;
            }
            void navigate({ to: "/sign-in" });
          }}
        >
          {status.isPending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <GitHubIcon className="size-3.5" />
          )}
          {notInstalled ? "Set up GitHub" : "Sign in with GitHub"}
        </button>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Usage"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
              onClick={() => {
                void navigate({ to: "/usage" });
              }}
            >
              <ChartNoAxesColumnIcon className="size-4" />
            </button>
          }
        />
        <TooltipPopup side="top">Usage</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Settings"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
              onClick={() => {
                void navigate({ to: "/settings" });
              }}
            >
              <SettingsIcon className="size-4" />
            </button>
          }
        />
        <TooltipPopup side="top">Settings</TooltipPopup>
      </Tooltip>
    </div>
  );
});
