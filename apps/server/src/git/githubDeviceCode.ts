const GITHUB_DEVICE_CODE_PATTERN = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/i;

export function parseGitHubDeviceCode(output: string): string | null {
  return GITHUB_DEVICE_CODE_PATTERN.exec(output)?.[1]?.toUpperCase() ?? null;
}
