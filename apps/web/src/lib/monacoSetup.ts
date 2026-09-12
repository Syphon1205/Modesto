// FILE: monacoSetup.ts
// Purpose: Boots Monaco once, with workers and themes wired to this app.
// Layer: Web editor infrastructure
//
// Monaco needs its language workers registered before any editor is created,
// and it is ~5MB, so everything here is behind a dynamic import: the IDE view
// pays for it only when a developer actually opens it, and the chat surface -
// which most sessions never leave - loads none of it.

import type * as MonacoApi from "monaco-editor";

export type Monaco = typeof MonacoApi;

let monacoPromise: Promise<Monaco> | null = null;

/**
 * Maps a path to a Monaco language id.
 *
 * Deliberately small: Monaco resolves most languages from the model URI, so
 * this only covers the cases where the extension alone is ambiguous or where
 * Monaco's own guess is wrong.
 */
export function monacoLanguageForPath(path: string): string | undefined {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  switch (extension) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascript";
    case "md":
    case "markdown":
      return "markdown";
    case "json":
    case "jsonc":
      return "json";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
    case "htm":
      return "html";
    case "yml":
    case "yaml":
      return "yaml";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "sql":
      return "sql";
    case "toml":
      return "ini";
    default:
      return undefined;
  }
}

/**
 * Loads Monaco and registers its workers.
 *
 * Workers are constructed through Vite's `?worker` imports rather than a CDN
 * `MonacoEnvironment.getWorkerUrl`, so the editor works offline and inside the
 * packaged desktop app, where there is no origin to fetch worker scripts from.
 */
export function loadMonaco(): Promise<Monaco> {
  if (monacoPromise) return monacoPromise;

  monacoPromise = (async () => {
    const [monaco, EditorWorker, TsWorker, JsonWorker, CssWorker, HtmlWorker] = await Promise.all([
      import("monaco-editor"),
      import("monaco-editor/editor/editor.worker?worker"),
      import("monaco-editor/language/typescript/ts.worker?worker"),
      import("monaco-editor/language/json/json.worker?worker"),
      import("monaco-editor/language/css/css.worker?worker"),
      import("monaco-editor/language/html/html.worker?worker"),
    ]);

    (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
      getWorker(_id: string, label: string) {
        switch (label) {
          case "typescript":
          case "javascript":
            return new TsWorker.default();
          case "json":
            return new JsonWorker.default();
          case "css":
          case "scss":
          case "less":
            return new CssWorker.default();
          case "html":
          case "handlebars":
          case "razor":
            return new HtmlWorker.default();
          default:
            return new EditorWorker.default();
        }
      },
    };

    // The workspace's files are not on disk for Monaco, so cross-file type
    // resolution would report phantom errors on every import. Syntax
    // highlighting, formatting, and the editing features stay; the red
    // squiggles that would all be wrong do not.
    //
    // Reached through the language contribution rather than the editor API:
    // Monaco 0.56 deprecated `languages.typescript` and moved these defaults.
    // Declared in vite-env.d.ts: this entry point ships no declarations.
    const typescriptContribution =
      await import("monaco-editor/language/typescript/monaco.contribution");
    for (const defaults of [
      typescriptContribution.typescriptDefaults,
      typescriptContribution.javascriptDefaults,
    ]) {
      defaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
    }

    return monaco;
  })();

  return monacoPromise;
}
