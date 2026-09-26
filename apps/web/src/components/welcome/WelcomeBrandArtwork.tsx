import { cn } from "~/lib/utils";

import "./welcomeHero.css";

const HERO_CARDS = [
  {
    name: "Codex",
    state: "Ready to build",
    mark: "/brand/marks/codex.svg",
    className: "z-[2] bg-[#d5f995] text-[#14180f] [transform:translate(-54%,-30%)_rotate(-10deg)]",
  },
  {
    name: "Claude",
    state: "Ready to think",
    mark: "/brand/marks/claude.svg",
    className:
      "z-[1] border border-white/12 bg-[linear-gradient(155deg,#232922,#14180f)] text-[#eceee6] [transform:translate(56%,-26%)_rotate(8deg)]",
  },
  {
    name: "Cursor",
    state: "Ready to ship",
    mark: "/brand/marks/cursor.svg",
    className: "z-[3] bg-[#efe7d6] text-[#14180f] [transform:translate(-6%,44%)_rotate(2deg)]",
  },
] as const;

/**
 * The marketing hero cluster: clean CSS presentation without 3D WebGL overhead.
 */
export function WelcomeHeroCluster() {
  return (
    <div
      aria-hidden
      className="relative mx-auto grid aspect-square w-full max-w-[520px] place-items-center lg:max-w-none"
    >
      <span className="welcome-hero-orbit absolute size-[78%] rounded-full border border-border/70 [animation:welcome-orbit_26s_linear_infinite] [transform:rotate(-18deg)] opacity-55" />
      <span className="welcome-hero-orbit absolute h-[62%] w-[92%] rounded-full border border-border/40 [animation:welcome-orbit_34s_linear_infinite_reverse] [transform:rotate(26deg)] opacity-30" />
      {HERO_CARDS.map((card, index) => (
        <article
          key={card.name}
          className={cn(
            "welcome-hero-card absolute flex aspect-[3/3.8] w-[min(41%,194px)] flex-col rounded-[22px] p-[18px] shadow-[0_28px_60px_rgba(0,0,0,0.45)] transition-opacity duration-500 [animation:welcome-card-float_9s_ease-in-out_infinite]",
            card.className,
          )}
          style={{ animationDelay: `${-index * 3}s` }}
        >
          <span
            className="size-7 bg-current"
            style={{
              WebkitMask: `url(${card.mark}) center / contain no-repeat`,
              mask: `url(${card.mark}) center / contain no-repeat`,
            }}
          />
          <div className="mt-auto text-[clamp(17px,1.7vw,22px)] font-semibold tracking-[-0.02em]">
            {card.name}
          </div>
          <div className="mt-1 text-[9px] font-semibold tracking-[0.14em] uppercase opacity-[0.62]">
            {card.state}
          </div>
          <footer className="mt-4 border-t border-current pt-2.5 text-[8px] tracking-[0.12em] uppercase opacity-[0.42]">
            Modesto / Provider 0{index + 1}
          </footer>
        </article>
      ))}
    </div>
  );
}
