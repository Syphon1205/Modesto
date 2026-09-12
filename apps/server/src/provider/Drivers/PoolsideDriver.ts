/**
 * PoolsideDriver — Poolside Agent CLI (`pool acp`), driven through the shared
 * cursor-family ACP machinery. See `provider/cursorFamily.ts` and
 * `Drivers/CursorFamilyDriver.ts`.
 *
 * @module provider/Drivers/PoolsideDriver
 */
import { PoolsideSettings } from "@modesto/contracts";

import { POOLSIDE_FAMILY_DESCRIPTOR } from "../cursorFamily.ts";
import { makeCursorFamilyDriver, type CursorFamilyDriverEnv } from "./CursorFamilyDriver.ts";

export type PoolsideDriverEnv = CursorFamilyDriverEnv;

export const PoolsideDriver = makeCursorFamilyDriver({
  descriptor: POOLSIDE_FAMILY_DESCRIPTOR,
  configSchema: PoolsideSettings,
});
