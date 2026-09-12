import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { WebAppMentionInlineText } from "./webAppMentionInline";

describe("WebAppMentionInlineText", () => {
  it("turns @drive and @salesforce into labeled chips", () => {
    const markup = renderToStaticMarkup(
      <WebAppMentionInlineText text="pull up sales from @drive and @salesforce" />,
    );
    expect(markup).toContain("Google Drive");
    expect(markup).toContain("Salesforce");
    expect(markup).toContain('data-markdown-copy="@drive"');
    expect(markup).toContain('data-markdown-copy="@salesforce"');
  });

  it("leaves unknown @tokens as plain text", () => {
    const markup = renderToStaticMarkup(<WebAppMentionInlineText text="ping @nobody" />);
    expect(markup).toContain("ping @nobody");
    expect(markup).not.toContain("data-markdown-copy");
  });
});
