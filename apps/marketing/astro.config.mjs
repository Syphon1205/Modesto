import { defineConfig } from "astro/config";

import { teaserCaptureVitePlugin } from "./scripts/capture-alpha-teaser.mjs";

export default defineConfig({
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
  vite: {
    plugins: [teaserCaptureVitePlugin()],
  },
});
