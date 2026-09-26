import { DesktopPlaySystemSoundInputSchema, type DesktopSystemSound } from "@modesto/contracts";
import { execFile, type ChildProcess } from "node:child_process";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Electron from "electron";

import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

const MAC_SYSTEM_SOUND_NAMES = {
  basso: "Basso",
  funk: "Funk",
  glass: "Glass",
  hero: "Hero",
  ping: "Ping",
  pop: "Pop",
  purr: "Purr",
  sosumi: "Sosumi",
  submarine: "Submarine",
  tink: "Tink",
} as const satisfies Record<DesktopSystemSound, string>;
let playingSystemSound: ChildProcess | undefined;

export function resolveMacSystemSoundPath(sound: DesktopSystemSound): string {
  return `/System/Library/Sounds/${MAC_SYSTEM_SOUND_NAMES[sound]}.aiff`;
}

export const playSystemSound = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.PLAY_SYSTEM_SOUND_CHANNEL,
  payload: DesktopPlaySystemSoundInputSchema,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.playSystemSound")(function* ({ sound, volume }) {
    if (volume <= 0) return false;
    if (process.platform !== "darwin") {
      Electron.shell.beep();
      return true;
    }
    return yield* Effect.sync(() => {
      playingSystemSound?.kill();
      try {
        const process = execFile(
          "/usr/bin/afplay",
          ["-v", String(Math.min(1, Math.max(0, volume / 100))), resolveMacSystemSoundPath(sound)],
          { timeout: 10_000 },
          () => {
            if (playingSystemSound === process) playingSystemSound = undefined;
          },
        );
        playingSystemSound = process;
        return true;
      } catch {
        return false;
      }
    });
  }),
});
