import { Disc3Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "~/lib/utils";

export function AlbumCover({
  url,
  className,
}: {
  readonly url: string | null | undefined;
  readonly className: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  if (!url || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/25 text-muted-foreground",
          className,
        )}
      >
        <Disc3Icon className="size-[42%] max-h-8 max-w-8" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn("shrink-0 bg-muted object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
