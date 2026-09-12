import { describe, expect, it } from "vite-plus/test";

import { composerFileAttachmentKind, formatAttachmentSize } from "./attachmentDisplay";

describe("formatAttachmentSize", () => {
  it("formats bytes, kilobytes, and megabytes", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(2048)).toBe("2.0 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("composerFileAttachmentKind", () => {
  it("classifies pdfs and spreadsheets", () => {
    expect(composerFileAttachmentKind("brief.pdf", "application/pdf")).toBe("pdf");
    expect(
      composerFileAttachmentKind(
        "budget.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("spreadsheet");
    expect(composerFileAttachmentKind("notes.txt", "text/plain")).toBe("document");
  });

  it("classifies design sources as design, not images", () => {
    expect(composerFileAttachmentKind("hero.fig", "application/vnd.figma")).toBe("design");
    expect(composerFileAttachmentKind("site.framer", "")).toBe("design");
    expect(composerFileAttachmentKind("poster.psd", "image/vnd.adobe.photoshop")).toBe("design");
    expect(composerFileAttachmentKind("mark.svg", "image/svg+xml")).toBe("design");
  });
});
