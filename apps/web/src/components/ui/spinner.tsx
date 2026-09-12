import type { ComponentProps } from "react";
import { FlickerLoadingIcon } from "~/components/ui/FlickerLoadingIcon";
import { SEARCHING_GRIDS } from "~/lib/flickerGrids";
import { cn } from "~/lib/utils";

// Render size lives on its own `size` prop (matching FlickerLoadingIcon) rather
// than being read off `className` - a dot-grid spinner sizes from its `size`
// prop, not CSS box dimensions, so a wrapping span carries className/aria/data
// attributes while the grid itself gets an explicit pixel size.
function Spinner({
  className,
  size = 14,
  ...rest
}: { className?: string; size?: number } & Omit<ComponentProps<"span">, "className">) {
  return (
    <span {...rest} className={cn("inline-flex shrink-0", className)}>
      <FlickerLoadingIcon grids={SEARCHING_GRIDS} variant="5x5" size={size} title="Loading" />
    </span>
  );
}

export { Spinner };
