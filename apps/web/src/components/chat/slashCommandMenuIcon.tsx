import type { SVGProps } from "react";

import { FramerIcon } from "~/components/WebAppIcons";

import {
  normalizeSlashCommandName,
  slashCommandHasBrandMark,
  slashCommandLucideIcon,
} from "./composerSlashCommandIcon";

/** Simple Icons `figma` (CC0), kept in brand colors so it reads at 16px. */
function FigmaMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path d="M8 24c2.21 0 4-1.79 4-4v-4H8c-2.21 0-4 1.79-4 4s1.79 4 4 4Z" fill="#0ACF83" />
      <path d="M4 12c0-2.21 1.79-4 4-4h4v8H8c-2.21 0-4-1.79-4-4Z" fill="#A259FF" />
      <path d="M4 4c0-2.21 1.79-4 4-4h4v8H8C5.79 8 4 6.21 4 4Z" fill="#F24E1E" />
      <path d="M12 0h4c2.21 0 4 1.79 4 4s-1.79 4-4 4h-4V0Z" fill="#FF7262" />
      <path d="M20 12c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4Z" fill="#1ABCFE" />
    </svg>
  );
}

export function ComposerSlashCommandIcon({ name }: { readonly name: string }) {
  if (slashCommandHasBrandMark(name)) {
    return normalizeSlashCommandName(name) === "framer" ? (
      <FramerIcon className="size-4 shrink-0" />
    ) : (
      <FigmaMark className="size-4 shrink-0" />
    );
  }
  const Icon = slashCommandLucideIcon(name);
  return <Icon aria-hidden className="size-4 shrink-0 text-icon-muted" />;
}
