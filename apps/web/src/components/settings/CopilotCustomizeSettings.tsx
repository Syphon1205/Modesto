import { BlocksIcon, HouseIcon, ListTodoIcon, SearchIcon, ZapIcon } from "lucide-react";
import { useAppNavigate } from "../../hooks/useAppNavigate";
import { Button } from "../ui/button";

export default function CopilotCustomizeSettings() {
  const navigate = useAppNavigate();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-auto px-5 pt-12 text-center">
      <div aria-hidden className="mb-8 w-52 rounded-xl border border-border p-2 text-left text-xs">
        {[
          [HouseIcon, "Home"],
          [ListTodoIcon, "My work"],
          [ZapIcon, "Automations"],
          [BlocksIcon, "Customize"],
          [SearchIcon, "Search"],
        ].map(([Icon, label]) => {
          const ItemIcon = Icon as typeof HouseIcon;
          return (
            <div
              key={String(label)}
              className={`flex items-center gap-2 rounded-md px-2 py-2 ${label === "Customize" ? "bg-muted" : ""}`}
            >
              <ItemIcon className="size-4 text-muted-foreground" />
              {String(label)}
            </div>
          );
        })}
      </div>
      <h2 className="text-sm font-semibold">Customization moved to the sidebar</h2>
      <p className="mb-4 mt-2 text-xs text-muted-foreground">
        Manage integrations, skills, and extensions from Customize.
      </p>
      <Button size="sm" onClick={() => void navigate({ to: "/plugins" })}>
        <BlocksIcon />
        Go to Customize
      </Button>
    </div>
  );
}
