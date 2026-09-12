import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-electron/**",
      // Reference checkout of the upstream OpenWork repo. It ships its own suites that
      // are not wired to this workspace's config and must not run here.
      "openwork-dev/**",
      // Throwaway agent worktrees hold stale copies of these same suites, which would
      // otherwise run against an unrelated checkout and report phantom failures.
      ".claude/worktrees/**",
      ".modesto-*/**",
      // Pre-OpenWork-embed Work UI, intentionally outside the active route tree (see its
      // own README). Its suites import shared modules like workspaces.ts and drift out of
      // sync with them since nothing exercises this code anymore — excluding it here
      // matches the "must not import this UI" boundary the directory already documents.
      "apps/web/src/work-legacy-backup/**",
    ],
  },
  resolve: {
    alias: [
      {
        find: /^@modesto\/contracts$/,
        replacement: path.resolve(import.meta.dirname, "./packages/contracts/src/index.ts"),
      },
      // The web app's `~` alias (only workspace that defines one), so its
      // modules stay importable from tests without rewriting to relative paths.
      {
        find: /^~\//,
        replacement: `${path.resolve(import.meta.dirname, "./apps/web/src")}/`,
      },
    ],
  },
});
