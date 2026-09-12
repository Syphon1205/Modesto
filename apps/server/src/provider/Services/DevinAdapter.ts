/**
 * DevinAdapter — shape type for the Devin provider adapter.
 *
 * Like every other adapter in this tree the driver bundles one adapter per
 * instance as a captured closure, so there is no Context tag here — only the
 * shape interface as a naming anchor.
 *
 * @module DevinAdapter
 */
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface DevinAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}
