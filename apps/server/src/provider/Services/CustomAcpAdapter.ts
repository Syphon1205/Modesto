/**
 * CustomAcpAdapter — shape type for the Custom ACP Agent provider adapter.
 *
 * The driver model ({@link ../Drivers/CustomAcpDriver}) bundles one adapter
 * per instance as a captured closure, so this module only retains the shape
 * interface as a naming anchor for the driver bundle.
 *
 * @module CustomAcpAdapter
 */
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

/**
 * CustomAcpAdapterShape — per-instance Custom ACP Agent adapter contract.
 */
export interface CustomAcpAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}
