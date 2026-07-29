// FILE: LanguageFileIcon.tsx
// Purpose: Small branded language glyphs missing from the Central icon asset set.
// Layer: Chat/shared UI

import { memo } from "react";
import { cn } from "~/lib/utils";

export type LanguageFileIconName = "language-go" | "language-ruby" | "language-swift";

export function isLanguageFileIconName(iconName: string): iconName is LanguageFileIconName {
  return iconName === "language-go" || iconName === "language-ruby" || iconName === "language-swift";
}

export const LanguageFileIcon = memo(function LanguageFileIcon(props: {
  name: LanguageFileIconName;
  className?: string;
  monochrome?: boolean;
}) {
  const commonProps = {
    "aria-hidden": true,
    className: cn("size-4 shrink-0", props.className),
    viewBox: "0 0 24 24",
  };

  if (props.name === "language-swift") {
    return (
      <svg {...commonProps} data-language-icon="swift">
        <rect
          width="22"
          height="22"
          x="1"
          y="1"
          rx="5"
          fill={props.monochrome ? "currentColor" : "#F05138"}
        />
        <path
          fill={props.monochrome ? "var(--color-background-surface)" : "white"}
          d="M5.1 6.1c3.5 2.4 5.9 4 7.2 4.8-1.2-1.2-2.6-2.8-4.1-4.9 3.1 2.2 5.5 4.3 7.3 6.3.4-1.2.2-2.7-.5-4.4 2.8 2.9 3.9 6.1 2.7 8.1-1.5 2.4-4.8 1.7-6.8.7-1.5-.7-2.9-1.7-4.1-3 2.3 1.5 4.5 2.1 6.4 1.8-2.8-2-5.5-5.1-8.1-9.4Z"
        />
      </svg>
    );
  }

  if (props.name === "language-go") {
    return (
      <svg {...commonProps} data-language-icon="go">
        <path
          fill={props.monochrome ? "currentColor" : "#00ADD8"}
          d="M8.3 6.2h8.4c3.3 0 5.3 2 5.3 5.2 0 3.8-2.3 6.4-6.5 6.4H8.1c-3.7 0-6.1-2.1-6.1-5.7 0-3.4 2.5-5.9 6.3-5.9Zm.2 3.1c-1.8 0-3 .9-3 2.8 0 1.7 1.1 2.6 2.9 2.6h7.1c1.9 0 3-1 3-3 0-1.6-.9-2.4-2.6-2.4H8.5Z"
        />
        <circle
          cx="9.2"
          cy="11.9"
          r="1.15"
          fill={props.monochrome ? "var(--color-background-surface)" : "white"}
        />
        <circle
          cx="16.4"
          cy="11.9"
          r="1.15"
          fill={props.monochrome ? "var(--color-background-surface)" : "white"}
        />
      </svg>
    );
  }

  return (
    <svg {...commonProps} data-language-icon="ruby">
      <path
        fill={props.monochrome ? "currentColor" : "#CC342D"}
        d="m12 2.4 7.4 3.7 2.1 6.1-9.5 9.4-9.5-9.4 2.1-6.1L12 2.4Z"
      />
      <path
        fill={props.monochrome ? "var(--color-background-surface)" : "#FF5A4F"}
        d="m12 4.8 4.8 2.4-1.9 2.2H9.1L7.2 7.2 12 4.8Zm-3 6.1h6L12 18.2 9 10.9Z"
      />
    </svg>
  );
});
