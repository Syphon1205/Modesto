import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  installCommand: "npm install -g vite-plus && vp install --filter '@modesto/marketing...'",
  buildCommand: "vp run --filter @modesto/marketing build",
  outputDirectory: "dist",
};
