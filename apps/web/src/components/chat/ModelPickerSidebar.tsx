import { type ProviderInstanceId } from "@modesto/contracts";
import { apiKeyProviderPresetForLabel } from "@modesto/shared/apiKeyProviders";
import { memo } from "react";
import { DatabaseZapIcon, StarIcon } from "lucide-react";
import { apiProviderIcon } from "../ApiProviderIcons";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";
import {
  isProviderInstancePickerReady,
  shouldShowInstanceBadge,
  type ProviderInstanceEntry,
} from "../../providerInstances";

function describeUnavailableInstance(entry: ProviderInstanceEntry): string {
  const label = entry.displayName;
  if (!entry.enabled || entry.status === "disabled") {
    return `${label} — Disabled in settings.`;
  }
  if (entry.status === "ready" && entry.isAvailable) {
    return label;
  }
  const kind =
    entry.status === "error" ? "Unavailable" : entry.status === "warning" ? "Limited" : "Not ready";
  const msg = entry.snapshot.message?.trim();
  return msg ? `${label} — ${kind}. ${msg}` : `${label} — ${kind}.`;
}

export interface ModelPickerCustomEndpointEntry {
  readonly id: string;
  readonly label: string;
}

function CustomEndpointIcon({ label }: { readonly label: string }) {
  const BrandIcon = apiProviderIcon(apiKeyProviderPresetForLabel(label)?.id);
  if (BrandIcon) {
    return <BrandIcon aria-hidden className="size-4 shrink-0" />;
  }
  const normalized = label.toLocaleLowerCase();
  const monogram = normalized.includes("vllm")
    ? "vL"
    : normalized.includes("ollama")
      ? "OL"
      : normalized.includes("lm studio")
        ? "LM"
        : null;
  return monogram ? (
    <span className="grid size-4 shrink-0 place-items-center rounded bg-foreground text-[8px] font-bold tracking-tighter text-background">
      {monogram}
    </span>
  ) : (
    <DatabaseZapIcon className="size-3.5" />
  );
}

export const ModelPickerSidebar = memo(function ModelPickerSidebar(props: {
  selectedInstanceId: ProviderInstanceId | "favorites";
  onSelectInstance: (instanceId: ProviderInstanceId | "favorites") => void;
  /**
   * Instance entries to render as rail buttons. Each entry becomes one icon
   * keyed by `instanceId`, so the default built-in Codex and a user-authored
   * `codex_personal` appear as two distinct rail items, each routing to
   * their own model list.
   */
  instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  /** Render the favorites rail entry. Hidden for locked-provider instance switching. */
  showFavorites?: boolean;
  /** Instance ids shown in the rail but unavailable for the current picker context. */
  disabledInstanceIds?: ReadonlySet<ProviderInstanceId>;
  getDisabledInstanceTooltip?: (entry: ProviderInstanceEntry) => string;
  /**
   * Instance id values that should render the "new" sparkle badge. Callers
   * pass the subset of default built-in ids they want flagged (custom
   * instances are never flagged — the user just made them).
   */
  newBadgeInstanceIds?: ReadonlySet<ProviderInstanceId>;
  /** Custom-endpoint rail entries, rendered after the instance buttons. */
  customEndpointEntries?: ReadonlyArray<ModelPickerCustomEndpointEntry>;
  selectedCustomEndpointId?: string | null;
  onSelectCustomEndpoint?: (id: string) => void;
}) {
  const selectedEndpoint = props.selectedCustomEndpointId ?? null;
  const providerButtonClassName = (selected: boolean) =>
    cn(
      "flex min-h-9 w-full min-w-0 shrink-0 items-center gap-2 rounded-lg px-2.5 text-xs font-medium transition-[background-color,color,box-shadow,opacity] duration-150 ease-[var(--ease-fluid)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
      selected
        ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
        : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
    );

  return (
    <div
      className="flex w-[34%] min-w-24 max-w-40 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/50 bg-muted/25 p-2 overscroll-y-contain"
      data-model-picker-sidebar="true"
      aria-label="Providers"
    >
      <div className="px-2.5 pt-1 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        Providers
      </div>
      {(props.showFavorites ?? true) && (
        <button
          type="button"
          className={providerButtonClassName(
            !selectedEndpoint && props.selectedInstanceId === "favorites",
          )}
          aria-pressed={!selectedEndpoint && props.selectedInstanceId === "favorites"}
          onClick={() => props.onSelectInstance("favorites")}
        >
          <StarIcon className="size-3" />
          Favorites
        </button>
      )}
      {props.instanceEntries.map((entry) => {
        const unavailable = !isProviderInstancePickerReady(entry);
        const contextDisabled = props.disabledInstanceIds?.has(entry.instanceId) ?? false;
        const disabled = unavailable || contextDisabled;
        const selected = !selectedEndpoint && props.selectedInstanceId === entry.instanceId;
        const description = unavailable
          ? describeUnavailableInstance(entry)
          : contextDisabled
            ? (props.getDisabledInstanceTooltip?.(entry) ?? entry.displayName)
            : entry.displayName;
        return (
          <Tooltip key={entry.instanceId}>
            <TooltipTrigger render={<span className="flex min-w-0 shrink-0" />}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={description}
                className={providerButtonClassName(selected)}
                onClick={() => props.onSelectInstance(entry.instanceId)}
              >
                <ProviderInstanceIcon
                  driverKind={entry.driverKind}
                  displayName={entry.displayName}
                  accentColor={entry.accentColor}
                  showBadge={shouldShowInstanceBadge(entry, props.instanceEntries)}
                  className="size-3.5"
                  iconClassName="size-3.5"
                  indicatorBackground="var(--popover)"
                />
                <span className="truncate">{entry.displayName}</span>
                {props.newBadgeInstanceIds?.has(entry.instanceId) && (
                  <span
                    className="size-1 rounded-full bg-update-foreground"
                    aria-label="New models"
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipPopup side="top" className="max-w-64">
              {description}
            </TooltipPopup>
          </Tooltip>
        );
      })}
      {props.customEndpointEntries?.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={providerButtonClassName(selectedEndpoint === entry.id)}
          aria-pressed={selectedEndpoint === entry.id}
          onClick={() => props.onSelectCustomEndpoint?.(entry.id)}
        >
          <CustomEndpointIcon label={entry.label} />
          <span className="truncate">{entry.label}</span>
        </button>
      ))}
    </div>
  );
});
