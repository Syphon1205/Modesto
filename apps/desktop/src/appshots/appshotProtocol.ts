// FILE: appshotProtocol.ts
// Purpose: Decode JSON lines emitted by modesto-appshot-helper.
// Layer: Desktop appshots

import * as Schema from "effect/Schema";

export const AppshotHelperAppshotEventSchema = Schema.Struct({
  type: Schema.Literal("appshot"),
  appName: Schema.String,
  windowTitle: Schema.String,
  accessibilityText: Schema.String,
  pngBase64: Schema.String,
  capturedAt: Schema.String,
});
export type AppshotHelperAppshotEvent = typeof AppshotHelperAppshotEventSchema.Type;

export const AppshotHelperErrorEventSchema = Schema.Struct({
  type: Schema.Literal("error"),
  message: Schema.String,
});
export type AppshotHelperErrorEvent = typeof AppshotHelperErrorEventSchema.Type;

export const AppshotHelperEventSchema = Schema.Union([
  AppshotHelperAppshotEventSchema,
  AppshotHelperErrorEventSchema,
]);
export type AppshotHelperEvent = typeof AppshotHelperEventSchema.Type;

const decodeHelperEvent = Schema.decodeUnknownSync(AppshotHelperEventSchema);

export function parseAppshotHelperLine(line: string): AppshotHelperEvent | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  try {
    return decodeHelperEvent(JSON.parse(trimmed) as unknown);
  } catch {
    return null;
  }
}
