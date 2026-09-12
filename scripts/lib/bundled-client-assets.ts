/**
 * Helpers for validating the desktop-packaged web client.
 *
 * Entry HTML only names the main bundles. Release packaging must also ship
 * every lazy chunk those bundles reference, or the desktop renderer fails
 * dynamic imports (e.g. PreviewPanel) at runtime.
 */

export const BUNDLED_CLIENT_ASSET_REF_PATTERN =
  /(?:\b(?:src|href)=["']([^"']+)["']|["'](assets\/[^"']+\.(?:js|css|wasm))["'])/g;

export function collectBundledClientAssetRefs(source: string): string[] {
  const refs: string[] = [];
  for (const match of source.matchAll(BUNDLED_CLIENT_ASSET_REF_PATTERN)) {
    const ref = match[1] ?? match[2];
    if (ref) refs.push(ref);
  }
  return refs;
}
