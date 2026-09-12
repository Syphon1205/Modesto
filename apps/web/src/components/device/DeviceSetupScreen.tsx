import { Check, Copy, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";

import type { PresentedDeviceSetupStep } from "../DevicePanel.logic";

export function DeviceSetupScreen(props: {
  title: string;
  description: string;
  trademark: string;
  cards: readonly PresentedDeviceSetupStep[];
  checking: string | null;
  actionLabel: string | null;
  onAction: (() => void) | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-black px-5 py-7 text-left text-white">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <h2 className="text-[17px] font-semibold tracking-tight text-white">{props.title}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">{props.description}</p>
        <div className="mt-5 space-y-2.5">
          {props.cards.map((card) => (
            <SetupStepCard key={card.id} card={card} />
          ))}
        </div>
        {props.checking ? (
          <div className="mt-4 flex items-center gap-2 text-[11px] text-white/50">
            <LoaderCircle className="size-3.5 animate-spin" />
            {props.checking}
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-center text-[9px] leading-relaxed text-white/30">{props.trademark}</p>
      {props.actionLabel && props.onAction ? (
        <button
          type="button"
          className="mt-3 h-11 w-full rounded-full bg-white text-sm font-semibold text-black hover:bg-white/92"
          onClick={props.onAction}
        >
          {props.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function SetupStepCard({ card }: { card: PresentedDeviceSetupStep }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/[0.07] px-3.5 py-3",
        card.active && "ring-1 ring-white/70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <SetupGlyph done={card.done} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[13px] font-medium",
              card.done ? "text-emerald-400/85" : "text-white",
            )}
          >
            {card.title}
          </p>
          {card.status ? <p className="mt-0.5 text-[11px] text-white/45">{card.status}</p> : null}
          {card.body ? (
            <p className="mt-2 text-[11px] leading-relaxed text-white/55">{card.body}</p>
          ) : null}
          {card.command ? <SetupCommand command={card.command} /> : null}
        </div>
      </div>
    </div>
  );
}

function SetupGlyph({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
        done ? "bg-emerald-500 text-white" : "border border-white/35",
      )}
      aria-hidden
    >
      {done ? <Check className="size-3 stroke-[3]" /> : null}
    </span>
  );
}

function SetupCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-black/45 px-2.5 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/80">{command}</code>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-white/12 px-2 py-1 text-[10px] font-medium text-white/80 hover:bg-white/18 hover:text-white"
        onClick={() => {
          void writeTextToClipboard(command, "setup command").then((ok) => {
            if (!ok) return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          });
        }}
      >
        {copied ? (
          "Copied"
        ) : (
          <span className="inline-flex items-center gap-1">
            <Copy className="size-3" />
            Copy
          </span>
        )}
      </button>
    </div>
  );
}
