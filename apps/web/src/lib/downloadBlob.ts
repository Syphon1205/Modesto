export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function openGoogleWorkspace(kind: "slides" | "docs" | "sheets"): void {
  const url =
    kind === "slides"
      ? "https://docs.google.com/presentation/u/0/"
      : kind === "docs"
        ? "https://docs.google.com/document/u/0/"
        : "https://docs.google.com/spreadsheets/u/0/";
  window.open(url, "_blank", "noopener,noreferrer");
}
