// FILE: whisperModelStore.ts
// Purpose: Installs and verifies the local whisper.cpp speech model on disk.
// Layer: Server utility
// Exports: whisperModelPaths, readWhisperModelState, downloadWhisperModel
// Depends on: node fs/crypto streams and an injectable `fetch`.
//
// Written against node streams rather than effect/FileSystem on purpose: this
// is a several-hundred-megabyte download that has to be hashed as it arrives,
// and piping the response straight through a hash into a file is the one shape
// that never holds the whole model in memory. `fetch` is injectable so the
// whole install path - resume, digest mismatch, truncation - is testable
// without the network.
//
// The download lands on a `.partial` file and is renamed only after the digest
// matches. A half-written GGML file is still a loadable-looking file, and
// whisper.cpp reports it as an unrelated mmap failure, so "never leave a
// plausible file behind" is the invariant that keeps that failure impossible.

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import * as fsp from "node:fs/promises";
import * as nodePath from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { WhisperModel } from "./whisperCatalog.ts";

export interface WhisperModelPaths {
  readonly directory: string;
  readonly filePath: string;
  readonly partialPath: string;
}

export function whisperModelPaths(baseDir: string, model: WhisperModel): WhisperModelPaths {
  const directory = nodePath.join(baseDir, "voice", "models");
  return {
    directory,
    filePath: nodePath.join(directory, model.fileName),
    partialPath: nodePath.join(directory, `${model.fileName}.partial`),
  };
}

export type WhisperModelDiskState =
  | { readonly kind: "ready"; readonly bytes: number }
  | { readonly kind: "missing"; readonly bytes: number };

/**
 * Reports what is on disk without hashing.
 *
 * Size is the cheap check and it runs on every status poll; the digest is
 * verified once, at install time, before the file is given its final name. A
 * file that is present at exactly the right size is therefore one this process
 * (or an earlier run of it) already verified.
 */
export async function readWhisperModelState(
  baseDir: string,
  model: WhisperModel,
): Promise<WhisperModelDiskState> {
  const paths = whisperModelPaths(baseDir, model);
  const size = await fileSize(paths.filePath);
  if (size === model.bytes) {
    return { kind: "ready", bytes: size };
  }
  // A leftover `.partial` is what a download interrupted mid-flight looks
  // like. Reporting its length is what lets the UI show real progress after a
  // restart instead of resetting the bar to zero.
  const partialSize = await fileSize(paths.partialPath);
  return { kind: "missing", bytes: partialSize ?? 0 };
}

async function fileSize(filePath: string): Promise<number | null> {
  try {
    const stats = await fsp.stat(filePath);
    return stats.isFile() ? stats.size : null;
  } catch {
    return null;
  }
}

export class WhisperModelInstallError extends Error {
  readonly step: "downloading" | "verifying" | "writing";

  constructor(
    message: string,
    step: "downloading" | "verifying" | "writing",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "WhisperModelInstallError";
    this.step = step;
  }
}

export interface DownloadWhisperModelInput {
  readonly baseDir: string;
  readonly model: WhisperModel;
  readonly fetchImpl?: typeof fetch;
  /** Called as bytes land, throttled by the caller if it needs to be. */
  readonly onProgress?: (downloadedBytes: number) => void;
  readonly signal?: AbortSignal;
}

/**
 * Fetches the model, hashing as it writes, and publishes it only on a match.
 *
 * Resume is deliberately not attempted. A `.partial` from a previous run is
 * discarded and refetched, because resuming correctly means trusting a range
 * response to line up with bytes already hashed, and getting that subtly wrong
 * produces exactly the corrupt-but-plausible file this module exists to
 * prevent. The cost of being wrong is far higher than the cost of a refetch.
 */
export async function downloadWhisperModel(input: DownloadWhisperModelInput): Promise<void> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new WhisperModelInstallError(
      "This runtime cannot download the speech model.",
      "downloading",
    );
  }

  const paths = whisperModelPaths(input.baseDir, input.model);
  await fsp.mkdir(paths.directory, { recursive: true });
  await fsp.rm(paths.partialPath, { force: true });

  let response: Response;
  try {
    response = await fetchImpl(input.model.url, input.signal ? { signal: input.signal } : {});
  } catch (cause) {
    throw new WhisperModelInstallError(
      `Could not reach the speech model download. ${describe(cause)}`,
      "downloading",
      { cause },
    );
  }

  if (!response.ok || !response.body) {
    throw new WhisperModelInstallError(
      `The speech model download failed (${response.status}).`,
      "downloading",
    );
  }

  const hash = createHash("sha256");
  let downloadedBytes = 0;

  // `Readable.fromWeb` keeps backpressure intact between the network and the
  // disk; reading the whole body first would mean holding the model in memory.
  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  source.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    downloadedBytes += chunk.byteLength;
    input.onProgress?.(downloadedBytes);
  });

  try {
    await pipeline(source, createWriteStream(paths.partialPath));
  } catch (cause) {
    await fsp.rm(paths.partialPath, { force: true });
    throw new WhisperModelInstallError(
      `The speech model download was interrupted. ${describe(cause)}`,
      "writing",
      { cause },
    );
  }

  const digest = hash.digest("hex");
  if (downloadedBytes !== input.model.bytes || digest !== input.model.sha256) {
    await fsp.rm(paths.partialPath, { force: true });
    throw new WhisperModelInstallError(
      "The downloaded speech model did not match its published checksum, so it was discarded.",
      "verifying",
    );
  }

  await fsp.rename(paths.partialPath, paths.filePath);
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause ?? "");
}
