// FILE: whisperCatalog.ts
// Purpose: The pinned set of whisper.cpp speech models Modesto Voice can install.
// Layer: Server utility (pure data + selectors)
// Exports: WHISPER_MODELS, whisperModel, whisperModelFileName, formatModelSize
// Depends on: nothing - deliberately free of Effect and the filesystem so the
//             catalog can be asserted against in a plain unit test.
//
// Every entry carries the exact byte length and SHA-256 of the file the URL
// serves. That is what makes a partial download detectable: a truncated GGML
// file is still a readable file, and whisper.cpp fails on it with a mmap error
// that says nothing about the real cause. Size alone is not enough either - a
// proxy or captive portal can return exactly-sized garbage - so the digest is
// checked before the model is ever handed to the engine.

import type { VoiceModelId } from "@modesto/contracts";

export interface WhisperModel {
  readonly id: VoiceModelId;
  readonly label: string;
  /** One line, shown under the label when picking a model. */
  readonly description: string;
  readonly fileName: string;
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
  /** True for models trained on English only; they are smaller and sharper for it. */
  readonly englishOnly: boolean;
}

/**
 * Models are served from the whisper.cpp author's own Hugging Face repo, which
 * is the same source `download-ggml-model.sh` uses upstream. Pinning `main`
 * rather than a revision is deliberate: these files have never been rewritten,
 * and the digest below is the real integrity check either way.
 */
const MODEL_BASE_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

const model = (input: Omit<WhisperModel, "url">): WhisperModel => ({
  ...input,
  url: `${MODEL_BASE_URL}/${input.fileName}`,
});

export const WHISPER_MODELS: ReadonlyArray<WhisperModel> = [
  model({
    id: "tiny.en",
    label: "Tiny (English)",
    description: "Fastest, roughest. Good on a slow machine.",
    fileName: "ggml-tiny.en.bin",
    bytes: 77_704_715,
    sha256: "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f",
    englishOnly: true,
  }),
  model({
    id: "base.en",
    label: "Base (English)",
    description: "The default. Handles dictated prompts and most identifiers.",
    fileName: "ggml-base.en.bin",
    bytes: 147_964_211,
    sha256: "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002",
    englishOnly: true,
  }),
  model({
    id: "small.en",
    label: "Small (English)",
    description: "Noticeably better on names and code, three times the download.",
    fileName: "ggml-small.en.bin",
    bytes: 487_614_201,
    sha256: "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d",
    englishOnly: true,
  }),
  model({
    id: "base",
    label: "Base (multilingual)",
    description: "Base, but not restricted to English.",
    fileName: "ggml-base.bin",
    bytes: 147_951_465,
    sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
    englishOnly: false,
  }),
  model({
    id: "small",
    label: "Small (multilingual)",
    description: "The best multilingual option that still starts quickly.",
    fileName: "ggml-small.bin",
    bytes: 487_601_967,
    sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    englishOnly: false,
  }),
] as const;

const MODELS_BY_ID = new Map(WHISPER_MODELS.map((entry) => [entry.id, entry]));

/**
 * The catalog is exhaustive over `VoiceModelId`, so this is total - an id that
 * decoded successfully always has an entry. The throw guards the one way that
 * can stop being true: adding a literal to the union without adding it here.
 */
export function whisperModel(id: VoiceModelId): WhisperModel {
  const entry = MODELS_BY_ID.get(id);
  if (!entry) {
    throw new Error(`No whisper model is registered for '${id}'.`);
  }
  return entry;
}

/** Rounded to one decimal, because a byte-exact size helps nobody choose. */
export function formatModelSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}
