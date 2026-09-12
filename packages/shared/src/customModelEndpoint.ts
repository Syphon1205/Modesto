/**
 * customModelEndpoint - the `router:<endpointId>:<modelId>` model-slug
 * scheme shared between server and web for Codex custom/self-hosted model
 * endpoints (Settings > Providers > Custom endpoints).
 *
 * The server (`apps/server/src/provider/customModelEndpoints.ts`) owns
 * encoding/decoding a full slug (it has the endpoint list to disambiguate a
 * model id that itself contains a colon). The web client only ever needs to
 * recognize whether a slug came from a custom endpoint at all - to group
 * such models into a dedicated "custom endpoints" rail entry in the model
 * picker, alongside the real providers - so it only needs the prefix.
 * Both sides import this one constant so the scheme can't drift out of sync.
 *
 * @module customModelEndpoint
 */
export const CUSTOM_MODEL_ENDPOINT_MODEL_SLUG_PREFIX = "router:";

export function isCustomModelEndpointModelSlug(slug: string): boolean {
  return slug.startsWith(CUSTOM_MODEL_ENDPOINT_MODEL_SLUG_PREFIX);
}
