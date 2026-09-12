// FILE: SpeakingPresenceChip.tsx
// Purpose: The only "assistant is being read aloud" indicator. Used to be a
//          fallback shown only when the ambient orb was off (the orb itself
//          used to show a waveform for the speaking thread); the orb dropped
//          all voice/speaking behavior - it is a status and navigation layer,
//          unrelated to speech - so this chip is now unconditional whenever
//          TTS is actually speaking.
// Layer: Voice UI

import { useVoiceSpeakingStore } from "../../voiceSpeakingStore";
import { SpeakingWaveform } from "./SpeakingWaveform";

export function SpeakingPresenceChip() {
  const speaking = useVoiceSpeakingStore((state) => state.speaking);
  if (!speaking) return null;

  return (
    <div
      className="pointer-events-none fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-foreground shadow-sm backdrop-blur-sm"
      data-speaking-presence-chip
    >
      <SpeakingWaveform className="text-foreground" />
      <span className="text-xs text-muted-foreground">Speaking</span>
    </div>
  );
}
