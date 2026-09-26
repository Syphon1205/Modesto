import { useEffect, useState } from "react";
import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { usePrimarySettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import {
  playNotificationSound,
  preloadNotificationSound,
  primeNotificationAudio,
  SOUND_OPTION_GROUPS,
  stopNotificationSound,
} from "../../lib/notificationSounds";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { SettingsRow, SettingsSection } from "./settingsLayout";

export function NotificationSoundSettings() {
  const settings = usePrimarySettings();
  const update = useUpdatePrimarySettings();
  const [previewError, setPreviewError] = useState(false);
  useEffect(() => stopNotificationSound, []);
  useEffect(() => {
    for (const id of [
      settings.startSound,
      settings.completionSound,
      settings.attentionSound,
      settings.interruptionSound,
      settings.errorSound,
    ])
      preloadNotificationSound(id);
  }, [
    settings.startSound,
    settings.completionSound,
    settings.attentionSound,
    settings.interruptionSound,
    settings.errorSound,
  ]);
  return (
    <SettingsSection title="Sounds">
      <SettingsRow
        id="notification-sounds"
        title="Notification sounds"
        description="Play a sound when a session starts, finishes, needs input, stops, or encounters an error."
        control={
          <Switch
            aria-label="Notification sounds"
            checked={settings.notificationSoundsEnabled}
            onCheckedChange={(checked) => {
              if (checked) void primeNotificationAudio();
              update({ notificationSoundsEnabled: checked });
            }}
          />
        }
      />
      {(
        [
          ["startSound", "Session started", "When an agent begins a new turn."],
          ["completionSound", "Session complete", "When an agent finishes a turn."],
          ["attentionSound", "Needs input", "When an agent requests approval or an answer."],
          ["interruptionSound", "Session interrupted", "When a running turn is stopped."],
          ["errorSound", "Session error", "When a running turn fails."],
        ] as const
      ).map(([key, title, description]) => (
        <SettingsRow
          key={key}
          title={title}
          description={description}
          control={
            <div className="flex min-w-0 items-center gap-2">
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Preview ${title.toLowerCase()} sound`}
                disabled={settings[key] === "none" || settings.notificationSoundVolume === 0}
                onClick={() => {
                  void playNotificationSound(settings[key], settings.notificationSoundVolume).then(
                    (played) => setPreviewError(!played),
                  );
                }}
              >
                <PlayIcon />
              </Button>
              <select
                aria-label={`${title} sound`}
                className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                value={settings[key]}
                onChange={(event) => update({ [key]: event.target.value })}
              >
                <option value="none">None</option>
                {SOUND_OPTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((sound) => (
                      <option key={sound.id} value={sound.id}>
                        {sound.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          }
        />
      ))}
      <SettingsRow
        title="Volume"
        description="Adjust notification and preview volume."
        control={
          <div className="flex items-center gap-2">
            <output className="text-xs text-muted-foreground">
              {settings.notificationSoundVolume}%
            </output>
            <input
              aria-label="Notification volume"
              type="range"
              min="0"
              max="100"
              value={settings.notificationSoundVolume}
              onChange={(event) => update({ notificationSoundVolume: Number(event.target.value) })}
              className="w-28 accent-primary"
            />
          </div>
        }
      />
      {previewError ? (
        <p role="status" className="px-4 text-xs text-muted-foreground">
          Sound could not play. Check your browser’s audio permissions and try again.
        </p>
      ) : null}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-muted-foreground">
          Five tailored Modesto sounds for every session event, plus OpenCode and native system
          sounds
        </span>
        <Button
          size="xs"
          variant="ghost"
          onClick={() =>
            update({
              notificationSoundsEnabled: false,
              notificationSoundVolume: 50,
              startSound: "modesto-start",
              completionSound: "modesto-complete",
              attentionSound: "modesto-attention",
              interruptionSound: "modesto-interrupted",
              errorSound: "modesto-error",
            })
          }
        >
          <RotateCcwIcon />
          Reset sounds
        </Button>
      </div>
    </SettingsSection>
  );
}
