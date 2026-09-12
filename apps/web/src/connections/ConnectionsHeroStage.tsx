// FILE: ConnectionsHeroStage.tsx
// Purpose: Coverflow of real brand marks for the Connections hero. The marks
//          sit in open space - no tile, slab, or card - so the 3D pose is the
//          only frame. A drop-shadow on the glyph itself gives lift; never
//          ghost a full-colour logo behind itself (that smears the brand).
// Layer: Connections UI

import { useEffect, useState } from "react";

import { webAppBrandHex, webAppIcon } from "~/components/WebAppIcons";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { MOTION_EASE_CSS, MOTION_MS } from "~/lib/motion";

import {
  CONNECTIONS_HERO_LOGO_IDS,
  HERO_VISIBLE_SLOTS,
  type ConnectionsHeroLogoId,
  heroCarouselOffset,
  heroCarouselSlotDepthIndex,
  heroCarouselSlotOpacity,
  heroCarouselSlotTransform,
} from "./ConnectionsHeroStage.logic";

const ROTATE_MS = 3200;
const TILE_REM = 6.25;

/** Bare mark. The coverflow pose is the only frame. */
function LogoMark({ id, featured }: { readonly id: string; readonly featured: boolean }) {
  const Icon = webAppIcon(id);
  const hex = webAppBrandHex(id);

  return (
    <span className="absolute inset-0 grid place-items-center">
      <span
        aria-hidden
        className="pointer-events-none absolute size-[78%] rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${hex} ${featured ? 28 : 14}%, transparent), transparent 72%)`,
        }}
      />
      <Icon
        aria-hidden
        className="relative size-[72%] text-foreground"
        style={{
          filter: featured
            ? "drop-shadow(0 16px 18px color-mix(in srgb, var(--foreground) 28%, transparent))"
            : "drop-shadow(0 8px 12px color-mix(in srgb, var(--foreground) 16%, transparent))",
        }}
      />
    </span>
  );
}

export function ConnectionsHeroStage({
  onFeaturedChange,
}: {
  /** Fired with the id of the tile now facing front, so hero copy can follow it. */
  readonly onFeaturedChange?: (id: ConnectionsHeroLogoId) => void;
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = CONNECTIONS_HERO_LOGO_IDS.length;

  useEffect(() => {
    if (reduceMotion || paused) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, reduceMotion]);

  useEffect(() => {
    const featured = CONNECTIONS_HERO_LOGO_IDS[active];
    if (featured) onFeaturedChange?.(featured);
  }, [active, onFeaturedChange]);

  return (
    <div
      aria-hidden
      className="relative mx-auto h-[13rem] w-full shrink-0"
      style={{
        // The arc reaches past any column this hero can spare, so its outer
        // tiles fade out at the edges. A hard clip would slice a tile in half
        // and read as a layout bug.
        maskImage: "linear-gradient(90deg, transparent, #000 13%, #000 87%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 13%, #000 87%, transparent)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute inset-x-10 bottom-6 h-6 rounded-[100%] blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--primary) 34%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{ perspective: "46rem", perspectiveOrigin: "50% 50%" }}
      >
        <div
          className="relative size-full"
          style={{ transformStyle: "preserve-3d", transform: "rotateX(7deg)" }}
        >
          {CONNECTIONS_HERO_LOGO_IDS.map((id, index) => {
            const offset = heroCarouselOffset(index, active, count);
            const featured = offset === 0;
            return (
              <div
                key={id}
                className="absolute top-[3.05rem] left-1/2 motion-reduce:transition-none"
                style={{
                  width: `${TILE_REM}rem`,
                  height: `${TILE_REM}rem`,
                  marginLeft: `-${TILE_REM / 2}rem`,
                  transformStyle: "preserve-3d",
                  transform: heroCarouselSlotTransform(offset),
                  opacity: heroCarouselSlotOpacity(offset),
                  visibility: Math.abs(offset) > HERO_VISIBLE_SLOTS ? "hidden" : "visible",
                  zIndex: heroCarouselSlotDepthIndex(offset),
                  transitionProperty: "transform, opacity",
                  transitionDuration: reduceMotion ? "0ms" : `${MOTION_MS.deliberate}ms`,
                  transitionTimingFunction: MOTION_EASE_CSS.entrance,
                  pointerEvents: "none",
                }}
              >
                <LogoMark id={id} featured={featured} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
