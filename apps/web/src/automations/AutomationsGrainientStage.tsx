import { useEffect, useState } from "react";

import { useTheme } from "~/hooks/useTheme";

import Grainient from "./Grainient";
import { readGrainientThemeColors, type GrainientThemeColors } from "./grainientThemeColors";

/**
 * React Bits Grainient for the Automations featured card.
 * https://reactbits.dev/backgrounds/grainient
 */
export function AutomationsGrainientStage({ className }: { readonly className?: string }) {
  const { resolvedTheme, theme, themeHalves } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [colors, setColors] = useState<GrainientThemeColors>(() =>
    readGrainientThemeColors(resolvedTheme),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    // Wait a frame so theme CSS variables have painted before we sample them.
    const frame = window.requestAnimationFrame(() => {
      setColors(readGrainientThemeColors(resolvedTheme));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resolvedTheme, theme, themeHalves]);

  return (
    <div
      aria-hidden
      data-automations-grainient=""
      className={
        className ??
        "relative size-full min-h-[14rem] overflow-hidden bg-background md:min-h-[18rem]"
      }
    >
      {reduceMotion ? (
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_45%_40%,color-mix(in_srgb,var(--primary)_32%,transparent),transparent_62%)]" />
      ) : (
        <Grainient
          className="absolute inset-0"
          timeSpeed={0.2}
          colorBalance={0.05}
          warpStrength={0.85}
          warpFrequency={4.5}
          warpSpeed={1.6}
          warpAmplitude={42}
          blendSoftness={0.08}
          rotationAmount={420}
          noiseScale={1.8}
          grainAmount={0.12}
          grainScale={2.2}
          grainAnimated={false}
          contrast={1.35}
          saturation={1.05}
          zoom={0.95}
          color1={colors.color1}
          color2={colors.color2}
          color3={colors.color3}
          lightMode={colors.lightMode}
        />
      )}
    </div>
  );
}
