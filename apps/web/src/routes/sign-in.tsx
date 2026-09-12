import { createFileRoute } from "@tanstack/react-router";

import { AppSignInChooser } from "../components/auth/AppSignInChooser";
import { AuthSplitSurface } from "../components/auth/AuthSplitSurface";

export interface SignInSearch {
  readonly redirect?: string;
}

export const Route = createFileRoute("/sign-in")({
  validateSearch: (raw: Record<string, unknown>): SignInSearch => ({
    ...(typeof raw.redirect === "string" && raw.redirect
      ? { redirect: raw.redirect.slice(0, 2000) }
      : {}),
  }),
  component: SignInRouteView,
});

function SignInRouteView() {
  const { redirect } = Route.useSearch();

  return (
    <AuthSplitSurface>
      <AppSignInChooser {...(redirect ? { redirect } : {})} />
    </AuthSplitSurface>
  );
}
