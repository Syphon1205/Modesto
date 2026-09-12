import type { ReactNode } from "react";

import { APP_DISPLAY_NAME } from "../../branding";
import { SignInCrtStage } from "./SignInCrtStage";

export function AuthSplitSurface({
  children,
  legal,
}: {
  readonly children: ReactNode;
  readonly legal?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground selection:bg-primary/20">
      <div className="mx-auto grid min-h-dvh w-full max-w-[90rem] grid-cols-1 gap-2 p-2 sm:gap-4 sm:p-3 md:grid-cols-[minmax(0,1.15fr)_minmax(22rem,28rem)] md:gap-6 md:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(24rem,32rem)]">
        <div className="min-h-44 md:min-h-0">
          <SignInCrtStage />
        </div>
        <section className="flex min-h-0 flex-col justify-center px-5 py-8 sm:px-8 md:px-6 lg:px-10">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {APP_DISPLAY_NAME}
          </p>
          <div className="mt-5 w-full max-w-sm">{children}</div>
          {legal ? (
            <p className="mt-10 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
              {legal}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
