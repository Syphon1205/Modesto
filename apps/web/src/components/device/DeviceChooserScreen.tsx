import { ChevronRight, LoaderCircle } from "lucide-react";

import { cn } from "~/lib/utils";

export function DeviceChooserScreen(props: {
  title: string;
  description: string;
  options: readonly {
    readonly id: string;
    readonly label: string;
    readonly detail: string;
  }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-black px-5 py-7 text-left text-white">
      <h2 className="text-[17px] font-semibold tracking-tight text-white">{props.title}</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">{props.description}</p>
      <div className="mt-5 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {props.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="flex w-full items-center gap-2 rounded-2xl bg-white/[0.07] px-3.5 py-3 text-left ring-1 ring-transparent hover:bg-white/[0.11] hover:ring-white/20"
            onClick={() => props.onPick(option.id)}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-white">{option.label}</span>
              <span className="mt-0.5 block text-[11px] text-white/45">{option.detail}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-white/35" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function DeviceStatusScreen(props: {
  title: string;
  description: string;
  checking?: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-black px-8 text-center text-white">
      {props.checking ? (
        <LoaderCircle className={cn("mb-3 size-4 animate-spin text-white/50")} />
      ) : null}
      <p className="text-[15px] font-medium text-white">{props.title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">{props.description}</p>
    </div>
  );
}
