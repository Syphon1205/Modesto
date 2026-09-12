import { DEFAULT_VOICE_MODEL_ID, type VoiceModelId } from "@modesto/contracts";

export interface VoiceModelOption {
  readonly id: VoiceModelId;
  readonly label: string;
  readonly description: string;
  readonly englishOnly: boolean;
}

export const VOICE_MODEL_OPTIONS: ReadonlyArray<VoiceModelOption> = [
  {
    id: "tiny.en",
    label: "Tiny (English)",
    description: "Fastest, roughest. Good on a slow machine.",
    englishOnly: true,
  },
  {
    id: "base.en",
    label: "Base (English)",
    description: "The default. Handles dictated prompts and most identifiers.",
    englishOnly: true,
  },
  {
    id: "small.en",
    label: "Small (English)",
    description: "Noticeably better on names and code, three times the download.",
    englishOnly: true,
  },
  {
    id: "base",
    label: "Base (multilingual)",
    description: "Base, but not restricted to English.",
    englishOnly: false,
  },
  {
    id: "small",
    label: "Small (multilingual)",
    description: "The best multilingual option that still starts quickly.",
    englishOnly: false,
  },
];

const VOICE_MODEL_BY_ID = new Map(VOICE_MODEL_OPTIONS.map((entry) => [entry.id, entry]));

export function voiceModelOption(id: VoiceModelId): VoiceModelOption {
  return (
    VOICE_MODEL_BY_ID.get(id) ??
    VOICE_MODEL_BY_ID.get(DEFAULT_VOICE_MODEL_ID) ??
    VOICE_MODEL_OPTIONS[0]!
  );
}
