import { useId } from "react";

export function ModestoWordmark() {
  const maskId = useId();
  const gradientId = useId();

  return (
    <svg
      data-opencode-wordmark=""
      aria-label="Modesto"
      role="img"
      viewBox="0 0 644 129"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.6" mask={`url(#${maskId})`}>
        <g opacity="0.16" fill="currentColor">
          <path d="M0 18H92V110H73.5V36.5H55V110H36.5V36.5H18.5V110H0V18Z" />
          <path d="M165.5 36.5H128.5V91.5H165.5V36.5ZM184 18V110H110V18H184Z" />
          <path d="M257.5 36.5H220.5V91.5H257.5V36.5ZM276 0V110H202V18H257.5V0H276Z" />
          <path d="M368 18V73.5H312.5V91.5H368V110H294V18H368ZM312.5 36.5V55H349.5V36.5H312.5Z" />
          <path d="M386 18H460V36.5H404.5V55H460V110H386V91.5H441.5V73.5H386V18Z" />
          <path d="M478 18H552V36.5H524.25V110H505.75V36.5H478V18Z" />
          <path d="M625.5 36.5H588.5V91.5H625.5V36.5ZM644 18V110H570V18H644Z" />
        </g>
      </g>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="644" height="129">
          <rect width="644" height="129" fill={`url(#${gradientId})`} />
        </mask>
        <linearGradient
          id={gradientId}
          x1="322"
          y1="68"
          x2="322"
          y2="129"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.7" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
