import { useTheme } from "../../hooks/useTheme";
import { DESKTOP_RELEASES_PAGE_URL } from "../desktopUpdate.logic";
import { useSettingsDialogStore } from "../../settings/settingsDialogStore";
import { useAppNavigate } from "~/hooks/useAppNavigate";
import { useAtomValue } from "@effect/atom-react";
import { memo, useCallback, useEffect } from "react";
import {
  ArrowUpRightIcon,
  ClipboardCheckIcon,
  InfoIcon,
  KeyboardIcon,
  LifeBuoyIcon,
  Loader2Icon,
  LogOutIcon,
  MessageSquareTextIcon,
  PaletteIcon,
  PanelsTopLeftIcon,
  SettingsIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import { useInterfaceStyle } from "../../hooks/useSettings";
import { GitHubIcon } from "../Icons";
import { primaryEnvironmentIdAtom } from "../../state/primaryEnvironment";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { githubAuthStatus, githubSignOut } from "../../state/githubAccountAuth";
import { cn } from "../../lib/utils";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * The app's own GitHub identity row - sign-in status for the connected
 * primary environment. Unsigned users go to the in-app sign-in page.
 */
export const GitHubAccountRow = memo(function GitHubAccountRow({
  settingsHeader = false,
}: {
  settingsHeader?: boolean;
}) {
  const compact = useInterfaceStyle() === "github";
  const navigate = useAppNavigate();
  const { appearanceMode, setAppearanceMode } = useTheme();
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
    <div
      data-settings-account-header={settingsHeader ? "" : undefined}
      className="flex items-center gap-1"
    >
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
                className={cn(
                  "shrink-0 rounded-full bg-muted object-cover",
                  compact && !settingsHeader ? "size-5" : "size-7",
                )}
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
              <span
                className={cn(
                  "block truncate text-[10px] text-sidebar-muted-foreground",
                  compact && !settingsHeader && "hidden",
                )}
              >
                @{account.login}
              </span>
            </span>
          </MenuTrigger>
          <MenuPopup
            align="start"
            side={settingsHeader ? "bottom" : "top"}
            className={compact ? "copilot-account-menu w-72" : "w-64"}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="" className="size-9 rounded-full" />
              ) : (
                <GitHubIcon className="size-8" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">@{account.login}</p>
                <p className="text-xs text-muted-foreground">{account.name ?? "GitHub account"}</p>
              </div>
            </div>
            <MenuSeparator />
            <MenuItem onClick={() => void navigate({ to: "/settings/connections" })}>
              <UsersIcon />
              Manage accounts
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (compact) useSettingsDialogStore.getState().show("/settings/sessions");
                else void navigate({ to: "/settings/archived" });
              }}
            >
              <PanelsTopLeftIcon />
              Manage sessions
            </MenuItem>
            <MenuSeparator />
            <MenuSub>
              <MenuSubTrigger>
                <PaletteIcon />
                Theme
              </MenuSubTrigger>
              <MenuSubPopup className="copilot-account-menu w-44">
                <MenuRadioGroup
                  value={appearanceMode}
                  onValueChange={(value) => {
                    if (value === "system" || value === "light" || value === "dark")
                      setAppearanceMode(value);
                  }}
                >
                  <MenuRadioItem value="system">System</MenuRadioItem>
                  <MenuRadioItem value="light">Light</MenuRadioItem>
                  <MenuRadioItem value="dark">Dark</MenuRadioItem>
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuItem onClick={() => void navigate({ to: "/settings/appearance" })}>
                  Browse palettes…
                </MenuItem>
              </MenuSubPopup>
            </MenuSub>
            <MenuItem onClick={() => void navigate({ to: "/settings/keybindings" })}>
              <KeyboardIcon />
              Keyboard shortcuts
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => void navigate({ to: "/settings/diagnostics" })}>
              <ClipboardCheckIcon />
              Health check
            </MenuItem>
            <MenuItem
              onClick={() =>
                window.open(DESKTOP_RELEASES_PAGE_URL, "_blank", "noopener,noreferrer")
              }
            >
              <ZapIcon />
              What's new
              <ArrowUpRightIcon className="ms-auto!" />
            </MenuItem>
            <MenuItem onClick={() => void navigate({ to: "/settings/general", hash: "about" })}>
              <InfoIcon />
              About
            </MenuItem>
            <MenuItem
              onClick={() =>
                window.open(
                  "https://github.com/pingdotgg/modesto/issues",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <LifeBuoyIcon />
              Help center
              <ArrowUpRightIcon className="ms-auto!" />
            </MenuItem>
            <MenuSeparator />
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
      {!settingsHeader ? (
        <>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Share feedback"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
                  onClick={() => {
                    window.open(
                      "https://github.com/pingdotgg/modesto/issues/new",
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  <MessageSquareTextIcon className="size-4" />
                </button>
              }
            />
            <TooltipPopup side="top">Share feedback</TooltipPopup>
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
        </>
      ) : null}
    </div>
  );
});
