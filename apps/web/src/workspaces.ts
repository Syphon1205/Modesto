import { TelescopeIcon, TerminalIcon, UsersIcon, type LucideIcon } from "~/lib/icons";

export type ModestoWorkspaceId = "code" | "teams" | "research";

export interface ModestoWorkspace {
  readonly id: ModestoWorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly path: "/" | "/teams" | "/research";
  readonly icon: LucideIcon;
  readonly comingSoon?: boolean;
}

export const MODESTO_WORKSPACES: readonly ModestoWorkspace[] = [
  {
    id: "code",
    name: "Code",
    description: "Build, debug, and ship",
    path: "/",
    icon: TerminalIcon,
  },
  {
    id: "teams",
    name: "Teams",
    description: "Create, operate, and coordinate agents",
    path: "/teams",
    icon: UsersIcon,
  },
  {
    id: "research",
    name: "Research",
    description: "Investigate and bring back evidence",
    path: "/research",
    icon: TelescopeIcon,
    comingSoon: true,
  },
] as const;

export const MODESTO_WORKSPACE_STORAGE_KEY = "modesto.workspace.v1";

export function workspaceIdForPath(pathname: string): ModestoWorkspaceId {
  if (pathname === "/teams" || pathname.startsWith("/teams/")) return "teams";
  if (pathname === "/research" || pathname.startsWith("/research/")) return "research";
  return "code";
}

export function persistSelectedWorkspace(id: ModestoWorkspaceId): void {
  try {
    globalThis.localStorage?.setItem(MODESTO_WORKSPACE_STORAGE_KEY, id);
  } catch {
    // Workspace selection remains route-driven when browser storage is unavailable.
  }
}
