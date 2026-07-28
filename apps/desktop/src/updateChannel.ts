import type { DesktopUpdateChannel } from "@modesto/contracts";
import {
  MODESTO_DESKTOP_DEVELOPMENT_UPDATE_CHANNEL,
  MODESTO_DESKTOP_UPDATE_CHANNEL,
} from "@modesto/shared/desktopIdentity";

export const STABLE_UPDATE_CHANNEL_NAME = MODESTO_DESKTOP_UPDATE_CHANNEL;
export const DEVELOPMENT_UPDATE_CHANNEL_NAME = MODESTO_DESKTOP_DEVELOPMENT_UPDATE_CHANNEL;

export function resolveBuildUpdateChannel(version: string): DesktopUpdateChannel {
  return /-(?:dev|alpha|beta|canary|nightly|preview|rc)(?:[.-]|$)/i.test(version)
    ? "development"
    : "stable";
}

export function resolveUpdaterChannelName(channel: DesktopUpdateChannel): string {
  return channel === "development" ? DEVELOPMENT_UPDATE_CHANNEL_NAME : STABLE_UPDATE_CHANNEL_NAME;
}

export function normalizeDesktopUpdateChannel(
  value: unknown,
  fallback: DesktopUpdateChannel,
): DesktopUpdateChannel {
  return value === "stable" || value === "development" ? value : fallback;
}
