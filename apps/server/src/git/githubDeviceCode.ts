const GITHUB_DEVICE_CODE_PATTERN = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/i;
const GITHUB_DEVICE_URL_PATTERN = /https:\/\/github\.com\/login\/device(?:\?[A-Za-z0-9_.=&%-]*)?/i;
export const GITHUB_DEVICE_LOGIN_URL = "https://github.com/login/device";

export function parseGitHubDeviceCode(output: string): string | null {
  return GITHUB_DEVICE_CODE_PATTERN.exec(output)?.[1]?.toUpperCase() ?? null;
}

export function parseGitHubVerificationUri(output: string): string | null {
  const match = GITHUB_DEVICE_URL_PATTERN.exec(output)?.[0];
  if (!match) return null;
  try {
    const url = new URL(match);
    if (url.hostname !== "github.com" || url.pathname !== "/login/device") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Prefer the URL printed by `gh`, then fall back to the public device page.
 * When a user code is known, attach it so the browser can skip the manual entry step.
 */
export function buildGitHubDeviceAuthUrl(input: {
  readonly userCode: string | null;
  readonly verificationUri?: string | null;
}): string {
  const rawBase = input.verificationUri?.trim() || GITHUB_DEVICE_LOGIN_URL;
  let url: URL;
  try {
    url = new URL(rawBase);
  } catch {
    url = new URL(GITHUB_DEVICE_LOGIN_URL);
  }
  if (url.hostname !== "github.com" || url.pathname !== "/login/device") {
    url = new URL(GITHUB_DEVICE_LOGIN_URL);
  }
  const code = input.userCode?.trim();
  if (code && !url.searchParams.has("user_code")) {
    url.searchParams.set("user_code", code.toUpperCase());
  }
  return url.toString();
}
