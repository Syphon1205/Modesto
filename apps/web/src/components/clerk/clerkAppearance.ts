import type { ClerkProviderProps } from "@clerk/react";

/** Keeps Clerk's stock component structure while binding its color system to
 * the live Modesto palette. CSS variables make theme changes propagate to
 * portaled sign-in and profile surfaces without remounting Clerk. */
export const clerkAppearance = {
  variables: {
    // Clerk reuses its primary color for filled buttons and bare links. The
    // app's update foreground is the palette's action hue cast for readable
    // text, while the card surface provides the inverse filled-control pair.
    colorPrimary: "var(--update-foreground)",
    colorPrimaryForeground: "var(--card)",
    colorDanger: "var(--error)",
    colorSuccess: "var(--success)",
    colorWarning: "var(--warning)",
    colorNeutral: "var(--contrast-foreground)",
    colorForeground: "var(--contrast-foreground)",
    // The stock dark theme's muted token is translucent. Clerk uses this as
    // the footer's background, so derive an opaque muted surface from the card.
    colorMuted: "color-mix(in srgb, var(--card) 98%, var(--contrast-foreground))",
    colorMutedForeground: "var(--contrast-muted-foreground)",
    colorBackground: "var(--card)",
    colorInputForeground: "var(--contrast-foreground)",
    colorInput: "var(--secondary)",
    colorRing: "var(--ring)",
    fontFamily: "var(--font-sans)",
    fontFamilyButtons: "var(--font-sans)",
    borderRadius: "0.5rem",
  },
  elements: {
    formFieldErrorText: { color: "var(--error-foreground)" },
    formFieldWarningText: { color: "var(--warning-foreground)" },
    formFieldSuccessText: { color: "var(--success-foreground)" },
    otpCodeFieldErrorText: { color: "var(--error-foreground)" },
    otpCodeFieldSuccessText: { color: "var(--success-foreground)" },
  },
} satisfies NonNullable<ClerkProviderProps["appearance"]>;

/** Dedicated /sign-in page: drop Clerk's card so the split layout is the chrome. */
export const clerkSignInPageAppearance = {
  ...clerkAppearance,
  variables: {
    ...clerkAppearance.variables,
    colorBackground: "transparent",
    colorMuted: "transparent",
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
  },
  elements: {
    ...clerkAppearance.elements,
    rootBox: "w-full",
    cardBox: "w-full bg-transparent shadow-none",
    card: "bg-transparent shadow-none border-0 p-0",
    headerTitle: "text-[1.75rem] font-semibold tracking-tight text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtonsBlockButton:
      "h-10 rounded-[var(--control-radius)] border border-input bg-popover text-foreground shadow-xs/5 hover:bg-accent/50",
    socialButtonsBlockButtonText: "font-medium text-foreground",
    dividerLine: "bg-border/70",
    dividerText: "text-muted-foreground text-[11px]",
    formFieldLabel: "font-medium text-foreground",
    formFieldInput:
      "h-10 rounded-[var(--control-radius)] border-input bg-popover text-foreground shadow-xs/5 placeholder:text-placeholder focus:border-ring focus:ring-ring",
    formFieldInputShowPasswordButton: "text-muted-foreground hover:text-foreground",
    formFieldAction: "text-primary hover:text-primary/80",
    formButtonPrimary:
      "h-10 rounded-[var(--control-radius)] border border-primary bg-primary font-medium text-primary-foreground shadow-xs shadow-primary/24 hover:bg-primary/90",
    identityPreview: "rounded-[var(--control-radius)] border border-border bg-muted/60",
    identityPreviewText: "text-foreground",
    identityPreviewEditButton: "text-primary",
    alternativeMethodsBlockButton:
      "rounded-[var(--control-radius)] border border-input bg-popover text-foreground hover:bg-accent/50",
    formResendCodeLink: "text-primary",
    backLink: "text-primary",
    footer: "bg-transparent",
    footerAction: "bg-transparent",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary",
  },
} satisfies NonNullable<ClerkProviderProps["appearance"]>;
