import { PROVIDER_SEND_TURN_MAX_IMAGE_BYTES, type DesktopAppshotPayload } from "@modesto/contracts";

import {
  useComposerDraftStore,
  type ComposerImageAttachment,
  type DraftId,
} from "~/composerDraftStore";
import { compressImageToByteLimit } from "~/lib/imageCompression";
import { playAppshotShutter } from "~/lib/appshotShutter";
import type { ScopedThreadRef } from "@modesto/contracts";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function attachAppshotToComposer(
  target: ScopedThreadRef | DraftId,
  payload: DesktopAppshotPayload,
): Promise<void> {
  const bytes = base64ToUint8Array(payload.pngBase64);
  const mimeType = payload.mimeType.trim() || "image/png";
  const safeApp = payload.appName.trim().replace(/[^\w.-]+/g, "_") || "app";
  const fileName = `appshot-${safeApp}.png`;
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const rawFile = new File([arrayBuffer], fileName, { type: mimeType });
  const compressed = await compressImageToByteLimit(rawFile, PROVIDER_SEND_TURN_MAX_IMAGE_BYTES);
  if (!compressed.ok) {
    return;
  }
  const attachmentFile = compressed.file;
  const image: ComposerImageAttachment = {
    type: "image",
    id: crypto.randomUUID(),
    name: attachmentFile.name || fileName,
    mimeType: attachmentFile.type || mimeType,
    sizeBytes: attachmentFile.size,
    previewUrl: URL.createObjectURL(attachmentFile),
    file: attachmentFile,
  };

  const store = useComposerDraftStore.getState();
  store.addImage(target, image);
  store.addAppshotContext(target, {
    appName: payload.appName,
    windowTitle: payload.windowTitle,
    accessibilityText: payload.accessibilityText,
    capturedAt: payload.capturedAt,
  });
  playAppshotShutter();
}
