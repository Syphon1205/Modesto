import { assert, describe, it } from "@effect/vitest";

import { collectBundledClientAssetRefs } from "./bundled-client-assets.ts";

describe("collectBundledClientAssetRefs", () => {
  it("collects entry tags from index.html", () => {
    assert.deepEqual(
      collectBundledClientAssetRefs(
        `<script type="module" crossorigin src="/assets/index-abc.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-def.css">`,
      ),
      ["/assets/index-abc.js", "/assets/index-def.css"],
    );
  });

  it("collects lazy chunk paths embedded in entry JS", () => {
    assert.deepEqual(
      collectBundledClientAssetRefs(
        `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/PreviewPanel-DURt19eN.js","assets/DiffPanel-D7WYkpdT.js"]`,
      ),
      ["assets/PreviewPanel-DURt19eN.js", "assets/DiffPanel-D7WYkpdT.js"],
    );
  });
});
