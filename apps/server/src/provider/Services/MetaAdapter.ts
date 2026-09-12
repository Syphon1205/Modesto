/**
 * MetaAdapter — shape type for the Meta provider adapter.
 *
 * The driver model ({@link ../Drivers/MetaDriver}) bundles one adapter per
 * instance as a captured closure, so this module only retains the shape
 * interface as a naming anchor for the driver bundle.
 *
 * @module MetaAdapter
 */
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

/**
 * MetaAdapterShape — per-instance Meta adapter contract.
 */
export interface MetaAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}
