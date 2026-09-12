import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { FileTagChipContent } from "./FileTagChip";

describe("FileTagChipContent", () => {
  it("renders catalog apps with their brand mark and product name", () => {
    const drive = renderToStaticMarkup(
      <FileTagChipContent path="drive" label="drive" theme="dark" />,
    );
    expect(drive).toContain("Google Drive");
    expect(drive).toContain("<svg");

    const salesforce = renderToStaticMarkup(
      <FileTagChipContent path="salesforce" label="salesforce" theme="dark" />,
    );
    expect(salesforce).toContain("Salesforce");

    const hubspot = renderToStaticMarkup(
      <FileTagChipContent path="hubspot" label="hubspot" theme="dark" />,
    );
    expect(hubspot).toContain("HubSpot");

    const photoshop = renderToStaticMarkup(
      <FileTagChipContent path="photoshop" label="photoshop" theme="dark" />,
    );
    expect(photoshop).toContain("Photoshop");
    expect(photoshop).toContain("<svg");
  });

  it("keeps ordinary file mentions on the file-icon path", () => {
    const markup = renderToStaticMarkup(
      <FileTagChipContent path="README.md" label="README.md" theme="dark" />,
    );
    expect(markup).toContain("README.md");
    expect(markup).not.toContain("Google Drive");
  });
});
