import {
  BookmarkIcon,
  CheckIcon,
  CircleDotIcon,
  EyeIcon,
  FlameIcon,
  InboxIcon,
  MessageCircleIcon,
  PinIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "~/components/ui/menu";

import type {
  PullRequestInboxGroup,
  PullRequestInboxReason,
  PullRequestInboxSort,
  PullRequestInboxTray,
} from "./pullRequestInbox.logic";

function Count({ value }: { readonly value: number }) {
  if (value <= 0) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-sky-600 px-1.5 text-center text-[10px] font-medium tabular-nums text-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  readonly active: boolean;
  readonly icon: typeof InboxIcon;
  readonly label: string;
  readonly count?: number;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      {count !== undefined ? <Count value={count} /> : null}
    </button>
  );
}

export function PullRequestInboxSidebar({
  tray,
  reason,
  repository,
  inboxUnread,
  participatingUnread,
  repositories,
  onInbox,
  onTray,
  onReason,
  onRepository,
}: {
  readonly tray: PullRequestInboxTray;
  readonly reason: PullRequestInboxReason | undefined;
  readonly repository: string | undefined;
  readonly inboxUnread: number;
  readonly participatingUnread: number;
  readonly repositories: ReadonlyArray<{ readonly repository: string; readonly unread: number }>;
  readonly onInbox: () => void;
  readonly onTray: (tray: PullRequestInboxTray) => void;
  readonly onReason: (reason: PullRequestInboxReason | undefined) => void;
  readonly onRepository: (repository: string | undefined) => void;
}) {
  return (
    <aside className="flex h-full w-[15.5rem] shrink-0 flex-col border-r border-border/60 bg-background">
      <div className="flex flex-col gap-0.5 p-2">
        <NavButton
          active={tray === "inbox" && reason === undefined && repository === undefined}
          icon={InboxIcon}
          label="Inbox"
          count={inboxUnread}
          onClick={onInbox}
        />
        <NavButton
          active={tray === "saved"}
          icon={BookmarkIcon}
          label="Saved"
          onClick={() => onTray("saved")}
        />
        <NavButton
          active={tray === "done"}
          icon={CheckIcon}
          label="Done"
          onClick={() => onTray("done")}
        />
      </div>
      <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">Filters</div>
      <div className="flex flex-col gap-0.5 px-2">
        <NavButton
          active={reason === "assigned"}
          icon={PinIcon}
          label="Assigned"
          onClick={() => onReason(reason === "assigned" ? undefined : "assigned")}
        />
        <NavButton
          active={reason === "participating"}
          icon={MessageCircleIcon}
          label="Participating"
          count={participatingUnread}
          onClick={() => onReason(reason === "participating" ? undefined : "participating")}
        />
        <NavButton
          active={reason === "mentioned"}
          icon={FlameIcon}
          label="Mentioned"
          onClick={() => onReason(reason === "mentioned" ? undefined : "mentioned")}
        />
        <NavButton
          active={reason === "review-requested"}
          icon={EyeIcon}
          label="Review requested"
          onClick={() => onReason(reason === "review-requested" ? undefined : "review-requested")}
        />
        <NavButton
          active={reason === "authored"}
          icon={UsersIcon}
          label="Authored"
          onClick={() => onReason(reason === "authored" ? undefined : "authored")}
        />
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="justify-start text-muted-foreground"
          disabled
        >
          <PlusIcon />
          Add new filter
        </Button>
      </div>
      {repositories.length > 0 ? (
        <>
          <div className="px-3 pb-1 pt-4 text-[11px] font-medium text-muted-foreground">
            Repositories
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
            {repositories.map((repo) => (
              <NavButton
                key={repo.repository}
                active={repository === repo.repository}
                icon={CircleDotIcon}
                label={repo.repository}
                count={repo.unread}
                onClick={() =>
                  onRepository(repository === repo.repository ? undefined : repo.repository)
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </aside>
  );
}

export function PullRequestInboxToolbar({
  unreadOnly,
  sort,
  group,
  onUnreadOnly,
  onSort,
  onGroup,
}: {
  readonly unreadOnly: boolean;
  readonly sort: PullRequestInboxSort;
  readonly group: PullRequestInboxGroup;
  readonly onUnreadOnly: (unreadOnly: boolean) => void;
  readonly onSort: (sort: PullRequestInboxSort) => void;
  readonly onGroup: (group: PullRequestInboxGroup) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <div className="flex items-center rounded-md border border-border/70 p-0.5">
        <Button
          type="button"
          size="xs"
          variant={unreadOnly ? "ghost" : "secondary"}
          onClick={() => onUnreadOnly(false)}
        >
          All
        </Button>
        <Button
          type="button"
          size="xs"
          variant={unreadOnly ? "secondary" : "ghost"}
          onClick={() => onUnreadOnly(true)}
        >
          Unread
        </Button>
      </div>
      <Menu>
        <MenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          Sort by: {sort === "oldest" ? "Oldest to newest" : "Newest to oldest"}
        </MenuTrigger>
        <MenuPopup align="end" side="bottom" className="min-w-48">
          <MenuRadioGroup
            value={sort}
            onValueChange={(next) => onSort(next as PullRequestInboxSort)}
          >
            <MenuRadioItem value="newest">Newest to oldest</MenuRadioItem>
            <MenuRadioItem value="oldest">Oldest to newest</MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      <Menu>
        <MenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          Group by: {group === "date" ? "Date" : "None"}
        </MenuTrigger>
        <MenuPopup align="end" side="bottom" className="min-w-36">
          <MenuRadioGroup
            value={group}
            onValueChange={(next) => onGroup(next as PullRequestInboxGroup)}
          >
            <MenuRadioItem value="date">Date</MenuRadioItem>
            <MenuRadioItem value="none">None</MenuRadioItem>
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </div>
  );
}
