/**
 * KimiDriver — Kimi Code CLI (`kimi acp`), driven through the shared
 * cursor-family ACP machinery. See `provider/cursorFamily.ts` for why Kimi
 * belongs to that family and `Drivers/CursorFamilyDriver.ts` for the driver
 * body every member shares.
 *
 * @module provider/Drivers/KimiDriver
 */
import { KimiSettings } from "@modesto/contracts";

import { KIMI_FAMILY_DESCRIPTOR } from "../cursorFamily.ts";
import { makeCursorFamilyDriver, type CursorFamilyDriverEnv } from "./CursorFamilyDriver.ts";

export type KimiDriverEnv = CursorFamilyDriverEnv;

export const KimiDriver = makeCursorFamilyDriver({
  descriptor: KIMI_FAMILY_DESCRIPTOR,
  configSchema: KimiSettings,
});
