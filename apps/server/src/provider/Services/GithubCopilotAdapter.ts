/**
 * GithubCopilotAdapter — shape type for the GitHub Copilot provider adapter.
 *
 * The driver model ({@link ../Drivers/GithubCopilotDriver}) bundles one
 * adapter per instance as a captured closure, so this module only retains
 * the shape interface as a naming anchor for the driver bundle.
 *
 * @module GithubCopilotAdapter
 */
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

/**
 * GithubCopilotAdapterShape — per-instance GitHub Copilot adapter contract.
 */
export interface GithubCopilotAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}
