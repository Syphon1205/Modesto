import { usePrimarySettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import { SettingsRow } from "./settingsLayout";

export function TerminalAppearanceSettings() {
  const settings = usePrimarySettings();
  const update = useUpdatePrimarySettings();
  return (
    <div className="pb-3">
      <SettingsRow
        title="Terminal"
        description="Customize the terminal’s appearance independently from the app."
        control={
          <div
            role="group"
            aria-label="Terminal appearance"
            className="inline-flex rounded-md bg-muted/40 p-0.5"
          >
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={settings.terminalAppearance === mode}
                aria-label={`Use ${mode} terminal appearance`}
                className={`rounded px-2 py-1 text-xs ${settings.terminalAppearance === mode ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => update({ terminalAppearance: mode })}
              >
                {mode === "system" ? "System" : mode === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        }
      />
      <SettingsRow
        title="Font"
        description="Set the font used for embedded terminals."
        control={
          <input
            aria-label="Terminal font"
            className="w-36 rounded-md border border-input bg-background px-2 py-1 text-xs"
            placeholder="Default"
            defaultValue={settings.fontFamilyTerminal}
            onBlur={(event) => {
              if (event.target.value !== settings.fontFamilyTerminal)
                update({ fontFamilyTerminal: event.target.value });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        }
      />
    </div>
  );
}
