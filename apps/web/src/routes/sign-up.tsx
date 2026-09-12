import { SignUp, useAuth } from "@clerk/react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { hasCloudPublicConfig } from "../cloud/publicConfig";
import { AuthSplitSurface } from "../components/auth/AuthSplitSurface";
import { resolveSafeSignInRedirect } from "../components/auth/signInRedirect";
import { clerkSignInPageAppearance } from "../components/clerk/clerkAppearance";

export interface SignUpSearch {
  readonly redirect?: string;
}

export const Route = createFileRoute("/sign-up")({
  validateSearch: (raw: Record<string, unknown>): SignUpSearch => ({
    ...(typeof raw.redirect === "string" && raw.redirect
      ? { redirect: raw.redirect.slice(0, 2000) }
      : {}),
  }),
  beforeLoad: () => {
    if (!hasCloudPublicConfig()) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: SignUpRouteView,
});

function SignUpRouteView() {
  const { redirect: redirectParam } = Route.useSearch();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const continueUrl =
    typeof window === "undefined"
      ? undefined
      : resolveSafeSignInRedirect(redirectParam, window.location.origin);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (continueUrl) {
      window.location.assign(continueUrl);
      return;
    }
    void navigate({ to: "/", replace: true });
  }, [continueUrl, isLoaded, isSignedIn, navigate]);

  return (
    <AuthSplitSurface>
      {isLoaded && !isSignedIn ? (
        <SignUp
          routing="hash"
          signInUrl={
            redirectParam ? `/sign-in?redirect=${encodeURIComponent(redirectParam)}` : "/sign-in"
          }
          appearance={clerkSignInPageAppearance}
          {...(continueUrl
            ? { forceRedirectUrl: continueUrl, signInForceRedirectUrl: continueUrl }
            : {})}
        />
      ) : null}
    </AuthSplitSurface>
  );
}
