# Bundled VS Code palettes

`vscodePalettes.json` is generated from the editor UI colors distributed by
`@shikijs/themes` 4.0.2 (https://github.com/shikijs/shiki/tree/main/packages/themes),
using Modesto's existing VS Code importer. The Shiki MIT notice is included in
`LICENSE.shiki`. Syntax grammars and executable extensions are not bundled.

Regenerate from the installed package:

```sh
bun apps/web/scripts/generate-theme-catalog.ts node_modules/.bun/@shikijs+themes@4.0.2/node_modules/@shikijs/themes
```

Paired themes retain their source light and dark palettes. Single-appearance
palettes are labelled with their supported mode in the picker. Selection installs
a palette into the existing local custom-theme store, so the boot script, theme
editor, persistence, and export use the same implementation as imported themes.

## OpenCode

`opencodePalettes.json` contains all 37 desktop palettes from anomalyco/opencode
at revision `83abc64a5c4e0e0a5157f2c4435d34131009a404`, resolved with its own color
scale generator before mapping into Modesto's shared theme roles. Each palette
retains both source appearances. The 45 original MP3 notification sounds are
in `public/sounds/opencode`; they load only when played. MIT notices accompany
both collections. Regenerate both with `bun apps/web/scripts/import-opencode-assets.ts`.

Every layout uses this catalog: Default shows preview cards, OpenCode uses
appearance-specific selectors, and Classic keeps its paired theme controls.
