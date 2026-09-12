/**
 * QwenDriver — Qwen Code CLI (`qwen acp`), driven through the shared
 * cursor-family ACP machinery. See `provider/cursorFamily.ts` and
 * `Drivers/CursorFamilyDriver.ts`.
 *
 * @module provider/Drivers/QwenDriver
 */
import { QwenSettings } from "@modesto/contracts";

import { QWEN_FAMILY_DESCRIPTOR } from "../cursorFamily.ts";
import { makeCursorFamilyDriver, type CursorFamilyDriverEnv } from "./CursorFamilyDriver.ts";

export type QwenDriverEnv = CursorFamilyDriverEnv;

export const QwenDriver = makeCursorFamilyDriver({
  descriptor: QWEN_FAMILY_DESCRIPTOR,
  configSchema: QwenSettings,
});
