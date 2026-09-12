export type SlideTransition = "fade" | "slide" | "none";

const TRANSITION_LINE = /^transition:\s*(fade|slide|none)\s*$/im;

export function parseSlideTransition(frontMatter: string | null | undefined): SlideTransition {
  const match = frontMatter ? TRANSITION_LINE.exec(frontMatter) : null;
  const value = match?.[1]?.toLowerCase();
  if (value === "slide" || value === "none" || value === "fade") return value;
  return "fade";
}

export function setSlideTransitionFrontMatter(
  frontMatter: string | null | undefined,
  transition: SlideTransition,
): string {
  const existing = frontMatter?.trim() ?? "---\nmarp: true\n---";
  const withFence = existing.startsWith("---") ? existing : `---\n${existing}\n---`;
  if (TRANSITION_LINE.test(withFence)) {
    return withFence.replace(TRANSITION_LINE, `transition: ${transition}`);
  }
  return withFence.replace(/^---\s*\n/, `---\ntransition: ${transition}\n`);
}

export function slideTransitionStyle(transition: SlideTransition): string | undefined {
  if (transition === "none") return undefined;
  if (transition === "slide") return "studio-slide 320ms ease-out";
  return "studio-fade 280ms ease-out";
}
