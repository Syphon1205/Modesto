import { providerSendTurnFileKind, type ProviderSendTurnFileKind } from "@modesto/contracts";

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function composerFileAttachmentKind(
  name: string,
  mimeType: string,
): ProviderSendTurnFileKind {
  return providerSendTurnFileKind(name, mimeType);
}
