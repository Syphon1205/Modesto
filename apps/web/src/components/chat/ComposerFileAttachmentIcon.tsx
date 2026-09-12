import { FileSpreadsheetIcon, FileTextIcon, PencilRulerIcon } from "lucide-react";

import { composerFileAttachmentKind } from "../../lib/attachmentDisplay";
import { cn } from "~/lib/utils";

export function ComposerFileAttachmentIcon({
  name,
  mimeType,
  className,
}: {
  readonly name: string;
  readonly mimeType: string;
  readonly className?: string;
}) {
  const kind = composerFileAttachmentKind(name, mimeType);
  const Icon =
    kind === "spreadsheet"
      ? FileSpreadsheetIcon
      : kind === "design"
        ? PencilRulerIcon
        : FileTextIcon;
  return <Icon className={cn("shrink-0 text-secondary-label", className)} aria-hidden="true" />;
}
