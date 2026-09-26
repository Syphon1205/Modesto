import type { EnvironmentId } from "@modesto/contracts";

import { ProjectFavicon } from "./ProjectFavicon";

const OPEN_CODE_AVATAR_COLORS = [
  "#7657d6",
  "#b8643f",
  "#3d8b57",
  "#3f7f8d",
  "#687078",
  "#9a6b45",
] as const;

function avatarColor(label: string): string {
  let hash = 0;
  for (const character of label) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return OPEN_CODE_AVATAR_COLORS[Math.abs(hash) % OPEN_CODE_AVATAR_COLORS.length]!;
}

export function OpenCodeProjectAvatar({
  cwd,
  environmentId,
  faviconPath,
  label,
}: {
  readonly cwd: string | null;
  readonly environmentId: EnvironmentId;
  readonly faviconPath: string | null;
  readonly label: string;
}) {
  if (faviconPath && cwd) {
    return <ProjectFavicon environmentId={environmentId} cwd={cwd} faviconPath={faviconPath} />;
  }

  return (
    <span
      data-opencode-project-avatar=""
      aria-hidden="true"
      style={{ backgroundColor: avatarColor(label) }}
    >
      {label.trim().charAt(0).toLocaleUpperCase() || "·"}
    </span>
  );
}
