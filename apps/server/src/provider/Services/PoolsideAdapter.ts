/**
 * PoolsideAdapter - Poolside Agent CLI ACP implementation of the generic provider contract.
 *
 * @module PoolsideAdapter
 */
import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface PoolsideAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "poolside";
}

export class PoolsideAdapter extends ServiceMap.Service<PoolsideAdapter, PoolsideAdapterShape>()(
  "modesto/provider/Services/PoolsideAdapter",
) {}
