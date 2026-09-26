/** Regenerate with: bun apps/web/scripts/generate-theme-catalog.ts <@shikijs/themes@4.0.2 directory> */
import { resolve } from "node:path";
import { parseVsCodeThemeFile } from "../src/vscodeThemeImport";
const root = process.argv[2];
if (!root) throw new Error("Provide the @shikijs/themes@4.0.2 package directory");
const groups = [
  ["GitHub", "github-light", "github-dark"],
  ["GitHub Default", "github-light-default", "github-dark-default"],
  ["GitHub High Contrast", "github-light-high-contrast", "github-dark-high-contrast"],
  ["GitHub Dimmed", "github-dark-dimmed"],
  ["Ayu", "ayu-light", "ayu-dark"],
  ["Ayu Mirage", "ayu-mirage"],
  ["Catppuccin", "catppuccin-latte", "catppuccin-mocha"],
  ["Catppuccin Frappé", "catppuccin-frappe"],
  ["Catppuccin Macchiato", "catppuccin-macchiato"],
  ["Dracula", "dracula"],
  ["Dracula Soft", "dracula-soft"],
  ["Everforest", "everforest-light", "everforest-dark"],
  ["Gruvbox", "gruvbox-light-medium", "gruvbox-dark-medium"],
  ["Gruvbox Soft", "gruvbox-light-soft", "gruvbox-dark-soft"],
  ["Gruvbox Hard", "gruvbox-light-hard", "gruvbox-dark-hard"],
  ["Horizon", "horizon-bright", "horizon"],
  ["Kanagawa", "kanagawa-lotus", "kanagawa-wave"],
  ["Kanagawa Dragon", "kanagawa-dragon"],
  ["Material", "material-theme-lighter", "material-theme"],
  ["Material Ocean", "material-theme-ocean"],
  ["Material Palenight", "material-theme-palenight"],
  ["Min", "min-light", "min-dark"],
  ["Monokai", "monokai"],
  ["Night Owl", "night-owl-light", "night-owl"],
  ["Nord", "nord"],
  ["One", "one-light", "one-dark-pro"],
  ["Poimandres", "poimandres"],
  ["Rosé Pine", "rose-pine-dawn", "rose-pine"],
  ["Rosé Pine Moon", "rose-pine-moon"],
  ["Solarized", "solarized-light", "solarized-dark"],
  ["Tokyo Night", "tokyo-night"],
  ["Vesper", "vesper"],
  ["Vitesse", "vitesse-light", "vitesse-dark"],
  ["VS Code", "light-plus", "dark-plus"],
  ["Synthwave ’84", "synthwave-84"],
] as const;
const catalog = [];
for (const [label, ...files] of groups) {
  const themes = [];
  for (const file of files) {
    const source = (await import(resolve(root, "dist", `${file}.mjs`))).default;
    themes.push(parseVsCodeThemeFile(source));
  }
  const base = themes.find((theme) => theme.appearance === "dark") ?? themes[0]!;
  catalog.push({
    ...base,
    id: `vscode-${files[0]}`,
    label,
    variants: Object.fromEntries(
      themes
        .filter((theme) => theme.appearance !== base.appearance)
        .map((theme) => [theme.appearance, theme.colors]),
    ),
  });
}
await Bun.write(
  new URL("../src/themes/vscodePalettes.json", import.meta.url),
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(
  `Generated ${catalog.length} palettes from ${groups.reduce((n, g) => n + g.length - 1, 0)} VS Code themes.`,
);
