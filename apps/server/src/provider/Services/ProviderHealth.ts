/**
 * ProviderHealth - Provider readiness snapshot service.
 *
 * Owns provider health checks, cache-backed snapshots, and change streaming
 * for transport layers that need provider install/auth status.
 *
 * @module ProviderHealth
 */
import type {
  ServerProviderStatus,
  ServerProviderUpdateInput,
  ServerProviderUpdateResult,
  ServerProviderUpdateError,
  ServerClearProviderApiKeyInput,
  ServerProviderCredentialError,
  ServerProviderSignInInput,
  ServerProviderSignInResult,
  ServerSetProviderApiKeyInput,
} from "@modesto/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

export interface ProviderHealthShape {
  /**
   * Read the latest provider health statuses.
   */
  readonly getStatuses: Effect.Effect<ReadonlyArray<ServerProviderStatus>>;

  /**
   * Force a foreground refresh of provider health snapshots.
   */
  readonly refresh: Effect.Effect<ReadonlyArray<ServerProviderStatus>>;

  /**
   * Run the allowlisted update command for a provider and publish the
   * resulting provider snapshots.
   */
  readonly updateProvider: (
    input: ServerProviderUpdateInput,
  ) => Effect.Effect<ServerProviderUpdateResult, ServerProviderUpdateError>;

  /**
   * Store a Modesto-managed API key for a provider and refresh its status.
   * The raw key is never included in the returned snapshot.
   */
  readonly setApiKey: (
    input: ServerSetProviderApiKeyInput,
  ) => Effect.Effect<ServerProviderUpdateResult, ServerProviderCredentialError>;

  /**
   * Remove a previously-stored API key for a provider and refresh its status.
   */
  readonly clearApiKey: (
    input: ServerClearProviderApiKeyInput,
  ) => Effect.Effect<ServerProviderUpdateResult, ServerProviderCredentialError>;

  /**
   * Trigger the provider's own CLI login flow (detached, browser-based). Resolves
   * once the child process has spawned, not once login completes — callers poll
   * `refresh`/`getStatuses` to observe completion.
   */
  readonly signIn: (
    input: ServerProviderSignInInput,
  ) => Effect.Effect<ServerProviderSignInResult, ServerProviderCredentialError>;

  /**
   * Stream of provider snapshot changes for config consumers.
   */
  readonly streamChanges: Stream.Stream<ReadonlyArray<ServerProviderStatus>>;
}

export class ProviderHealth extends ServiceMap.Service<ProviderHealth, ProviderHealthShape>()(
  "modesto/provider/Services/ProviderHealth",
) {}
