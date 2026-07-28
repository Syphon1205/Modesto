import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { ChevronDownIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "~/components/ui/menu";
import {
  MODESTO_WORKSPACES,
  persistSelectedWorkspace,
  workspaceIdForPath,
  type ModestoWorkspaceId,
} from "~/workspaces";

export function WorkspaceSwitcher({ className }: { readonly className?: string }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const activeId = workspaceIdForPath(pathname);
  const activeWorkspace =
    MODESTO_WORKSPACES.find((workspace) => workspace.id === activeId) ?? MODESTO_WORKSPACES[0]!;

  useEffect(() => {
    persistSelectedWorkspace(activeId);
  }, [activeId]);

  const selectWorkspace = (id: ModestoWorkspaceId) => {
    const workspace = MODESTO_WORKSPACES.find((candidate) => candidate.id === id);
    if (!workspace) return;
    persistSelectedWorkspace(id);
    void navigate({ to: workspace.path });
  };

  return (
    <Menu>
      <MenuTrigger
        aria-label="Switch Modesto workspace"
        className={cn(
          "group flex min-w-0 max-w-full items-center gap-2 rounded-md px-2 py-1 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.055] focus-visible:ring-1 focus-visible:ring-ring data-popup-open:bg-foreground/[0.055] [-webkit-app-region:no-drag]",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium tracking-[-0.01em] text-foreground">
          {activeWorkspace.name}
        </span>
        <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/65 transition-transform duration-150 group-data-popup-open:rotate-180" />
      </MenuTrigger>
      <MenuPopup
        align="start"
        side="bottom"
        sideOffset={5}
        className="w-[260px] rounded-lg border border-border bg-popover shadow-lg"
      >
        <MenuRadioGroup
          value={activeId}
          onValueChange={(value) => selectWorkspace(value as ModestoWorkspaceId)}
        >
          {MODESTO_WORKSPACES.map((workspace) => (
            <MenuRadioItem
              key={workspace.id}
              value={workspace.id}
              preserveChildLayout
              className="min-h-11 rounded-md px-3 py-1.5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 truncate text-xs font-medium text-foreground">
                  <span className="truncate">{workspace.name}</span>
                  {workspace.comingSoon ? (
                    <span className="shrink-0 rounded-full border border-blue-400/20 bg-blue-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-blue-400">
                      Coming soon
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[10px] leading-tight text-muted-foreground">
                  {workspace.description}
                </span>
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
