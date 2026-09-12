/**
 * GeminiAdapter — shape type for the Gemini provider adapter.
 *
 * The driver model ({@link ../Drivers/GeminiDriver}) bundles one adapter per
 * instance as a captured closure, so this module only retains the shape
 * interface as a naming anchor for the driver bundle.
 *
 * @module GeminiAdapter
 */
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

/**
 * GeminiAdapterShape — per-instance Gemini adapter contract.
 */
export interface GeminiAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}
