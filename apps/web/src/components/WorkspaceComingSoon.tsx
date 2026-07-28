import { cn } from "~/lib/utils";

export function WorkspaceComingSoon({
  name,
  heading,
  description,
  tone,
}: {
  readonly name: string;
  readonly heading: string;
  readonly description: string;
  readonly tone: "blue" | "violet";
}) {
  const accentClassName =
    tone === "violet"
      ? "border-violet-400/20 bg-violet-400/10 text-violet-400"
      : "border-blue-400/20 bg-blue-400/10 text-blue-400";
  const glowClassName = tone === "violet" ? "bg-violet-500/10" : "bg-blue-500/10";

  return (
    <section className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-border/55 bg-card/30 px-7 py-10 text-center shadow-[0_18px_60px_-45px_color-mix(in_srgb,var(--color-foreground)_32%,transparent)] sm:px-12 sm:py-14">
      <div
        className={cn(
          "pointer-events-none absolute -right-24 -top-28 size-72 rounded-full blur-3xl",
          glowClassName,
        )}
      />
      <div className="relative mx-auto flex max-w-xl flex-col items-center">
        <div
          className={cn(
            "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
            accentClassName,
          )}
        >
          {name} · Coming soon
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-[2.15rem]">
          {heading}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
