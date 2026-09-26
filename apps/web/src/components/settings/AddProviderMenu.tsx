import { useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import type { ProviderDriverKind } from "@modesto/contracts";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { DRIVER_OPTIONS } from "./providerDriverMeta";

export function AddProviderMenu({ onSelect }: { onSelect: (driver: ProviderDriverKind) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = DRIVER_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger render={<Button size="xs" variant="outline" />}>
        <PlusIcon />
        Add provider
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-72 bg-popover!" viewportClassName="p-1">
        <label className="flex items-center gap-2 border-b border-border px-2 py-2">
          <SearchIcon className="size-3.5 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search providers"
            placeholder="Search providers…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        <div className="max-h-72 overflow-y-auto py-1">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-xs hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  onSelect(option.value);
                }}
              >
                <Icon className="size-4" />
                <span>{option.label}</span>
              </button>
            );
          })}
          {!options.length ? (
            <p role="status" className="p-3 text-xs text-muted-foreground">
              No matching providers.
            </p>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
