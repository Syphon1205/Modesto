import { useEffect, useRef } from "react";
import { useClientSettings } from "../hooks/useSettings";
import { useAllEnvironmentShellsBootstrapped, useThreadShells } from "../state/entities";
import {
  notificationSoundTransition,
  type SoundEvent,
  type SoundThreadState,
} from "../lib/notificationSoundTransitions";
import { playNotificationSound, stopNotificationSound } from "../lib/notificationSounds";

export function NotificationSoundCoordinator() {
  const threads = useThreadShells();
  const hydrated = useAllEnvironmentShellsBootstrapped();
  const settings = useClientSettings();
  const previous = useRef(new Map<string, SoundThreadState>());
  useEffect(() => {
    if (!hydrated) {
      previous.current.clear();
      return;
    }
    const nextStates = new Map<string, SoundThreadState>();
    const events = new Set<SoundEvent>();
    for (const thread of threads) {
      const next: SoundThreadState = {
        key: `${thread.environmentId}:${thread.id}`,
        turnId: thread.latestTurn?.turnId ?? null,
        state: thread.latestTurn?.state ?? null,
        attention: thread.hasPendingApprovals || thread.hasPendingUserInput,
      };
      const event = notificationSoundTransition(previous.current.get(next.key), next);
      if (event && !thread.archivedAt) events.add(event);
      nextStates.set(next.key, next);
    }
    previous.current = nextStates;
    if (!settings.notificationSoundsEnabled) {
      stopNotificationSound();
      return;
    }
    const sound = events.has("error")
      ? settings.errorSound
      : events.has("attention")
        ? settings.attentionSound
        : events.has("completion")
          ? settings.completionSound
          : events.has("interruption")
            ? settings.interruptionSound
            : events.has("started")
              ? settings.startSound
              : null;
    if (sound) void playNotificationSound(sound, settings.notificationSoundVolume);
  }, [
    threads,
    hydrated,
    settings.notificationSoundsEnabled,
    settings.notificationSoundVolume,
    settings.startSound,
    settings.completionSound,
    settings.attentionSound,
    settings.interruptionSound,
    settings.errorSound,
  ]);
  useEffect(() => stopNotificationSound, []);
  return null;
}
