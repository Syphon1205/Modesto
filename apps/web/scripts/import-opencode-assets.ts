/** Reproduce the bundled OpenCode themes and sounds from a pinned MIT-licensed revision. */
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseVsCodeThemeFile } from "../src/vscodeThemeImport";

const revision = "83abc64a5c4e0e0a5157f2c4435d34131009a404";
const base = `https://raw.githubusercontent.com/anomalyco/opencode/${revision}/`;
async function read(path: string) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response;
}
const treeResponse = await fetch(
  `https://api.github.com/repos/anomalyco/opencode/git/trees/${revision}?recursive=1`,
);
if (!treeResponse.ok) throw new Error(`Source tree: ${treeResponse.status}`);
const tree = (await treeResponse.json()) as { tree: { path: string }[] };
const scratch = await mkdtemp(join(tmpdir(), "modesto-opencode-"));
try {
  for (const file of ["resolve.ts", "color.ts", "types.ts"]) {
    await Bun.write(
      join(scratch, file),
      await (await read(`packages/ui/src/theme/${file}`)).text(),
    );
  }
  const { resolveTheme } = await import(join(scratch, "resolve.ts"));
  const palettes = [];
  for (const { path } of tree.tree.filter(
    ({ path }) => path.startsWith("packages/ui/src/theme/themes/") && path.endsWith(".json"),
  )) {
    const source = (await (await read(path)).json()) as { id: string; name: string };
    const resolved = resolveTheme(source) as Record<"light" | "dark", Record<string, string>>;
    const variants = (["light", "dark"] as const).map((appearance) => {
      const tokens = resolved[appearance];
      const color = (key: string): string => {
        let value = tokens[key] ?? "";
        for (let i = 0; value.startsWith("var(--") && i < 10; i++)
          value = tokens[value.slice(6, -1)] ?? "";
        return value;
      };
      return parseVsCodeThemeFile({
        name: source.name,
        type: appearance,
        colors: {
          "editor.background": color("background-base"),
          "editor.foreground": color("text-base"),
          "sideBar.background": color("background-weak"),
          "sideBar.foreground": color("text-base"),
          "panel.background": color("background-base"),
          "panel.border": color("border-base"),
          focusBorder: color("border-interactive-base"),
          "button.background": color("surface-brand-base"),
          "button.foreground": color("text-on-brand-base"),
          descriptionForeground: color("text-weak"),
          "terminal.background": color("background-base"),
          "terminal.foreground": color("text-base"),
          "editorError.foreground": color("text-critical-base"),
          "editorWarning.foreground": color("text-warning-base"),
        },
        tokenColors: ["comment", "keyword", "string", "variable", "constant"].map((scope) => ({
          scope,
          settings: { foreground: color(`syntax-${scope}`) },
        })),
      });
    });
    palettes.push({
      ...variants[1]!,
      id: `opencode-${source.id}`,
      label: source.name === "OpenCode" ? "OpenCode" : `${source.name} · OpenCode`,
      variants: { light: variants[0]!.colors },
    });
  }
  await Bun.write(
    new URL("../src/themes/opencodePalettes.json", import.meta.url),
    JSON.stringify(palettes, null, 2) + "\n",
  );
  const audioDir = new URL("../public/sounds/opencode/", import.meta.url);
  await mkdir(audioDir, { recursive: true });
  const audio = tree.tree.filter(
    ({ path }) => path.startsWith("packages/ui/src/assets/audio/") && path.endsWith(".mp3"),
  );
  for (const { path } of audio)
    await Bun.write(
      new URL(path.split("/").at(-1)!, audioDir),
      await (await read(path)).arrayBuffer(),
    );
  const license = await (await read("LICENSE")).text();
  await Bun.write(new URL("LICENSE.txt", audioDir), license);
  await Bun.write(new URL("../src/themes/LICENSE.opencode", import.meta.url), license);
  console.log(
    `Imported ${palettes.length} paired themes and ${audio.length} sounds from ${revision}.`,
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
