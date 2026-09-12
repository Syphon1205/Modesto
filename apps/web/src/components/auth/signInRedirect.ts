/** Same-origin only: a sign-in redirect is a place in this app, not a free URL. */
export function resolveSafeSignInRedirect(raw: unknown, origin: string): string | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== new URL(origin).origin) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
