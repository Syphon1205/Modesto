import type * as MonacoApi from "monaco-editor";

export type VsCodeLanguageContribution = {
  id: string;
  aliases: string[];
  extensions: string[];
};

export type VsCodeSnippetContribution = {
  language: string;
  label: string;
  prefix: string;
  body: string;
  description: string;
};

export type InstalledVsCodeExtension = {
  id: string;
  name: string;
  version: string;
  languages: VsCodeLanguageContribution[];
  snippets: VsCodeSnippetContribution[];
};

const STORAGE_KEY = "modesto:vscode-declarative-extensions:v1";
const MAX_EXTENSIONS = 40;
const MAX_STORAGE_BYTES = 2 * 1024 * 1024;
const CHANGE_EVENT = "modesto:vscode-extensions-changed";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInstalledExtension(value: unknown): InstalledVsCodeExtension | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.version !== "string"
  )
    return null;
  if (!Array.isArray(value.languages) || !Array.isArray(value.snippets)) return null;
  const languages = value.languages.flatMap((candidate): VsCodeLanguageContribution[] => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      !Array.isArray(candidate.aliases) ||
      !Array.isArray(candidate.extensions)
    )
      return [];
    if (
      !candidate.aliases.every((item) => typeof item === "string") ||
      !candidate.extensions.every((item) => typeof item === "string")
    )
      return [];
    return [{ id: candidate.id, aliases: candidate.aliases, extensions: candidate.extensions }];
  });
  const snippets = value.snippets.flatMap((candidate): VsCodeSnippetContribution[] => {
    if (
      !isRecord(candidate) ||
      typeof candidate.language !== "string" ||
      typeof candidate.label !== "string" ||
      typeof candidate.prefix !== "string" ||
      typeof candidate.body !== "string" ||
      typeof candidate.description !== "string"
    )
      return [];
    return [
      {
        language: candidate.language,
        label: candidate.label,
        prefix: candidate.prefix,
        body: candidate.body,
        description: candidate.description,
      },
    ];
  });
  return { id: value.id, name: value.name, version: value.version, languages, snippets };
}

export function getInstalledVsCodeExtensions(): InstalledVsCodeExtension[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_STORAGE_BYTES) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value
          .flatMap((item) => {
            const parsed = parseInstalledExtension(item);
            return parsed ? [parsed] : [];
          })
          .slice(0, MAX_EXTENSIONS)
      : [];
  } catch {
    return [];
  }
}

export function installedVsCodeLanguageForPath(path: string): string | undefined {
  const lowerPath = path.toLowerCase();
  for (const extension of getInstalledVsCodeExtensions().toReversed()) {
    for (const language of extension.languages) {
      if (language.extensions.some((suffix) => lowerPath.endsWith(suffix.toLowerCase()))) {
        return language.id;
      }
    }
  }
  return undefined;
}

export function installVsCodeDeclarativeExtension(extension: InstalledVsCodeExtension): void {
  const current = getInstalledVsCodeExtensions().filter((item) => item.id !== extension.id);
  const next = [...current, extension].slice(-MAX_EXTENSIONS);
  const serialized = JSON.stringify(next);
  if (serialized.length > MAX_STORAGE_BYTES)
    throw new Error("That extension contains too many snippets to store safely.");
  window.localStorage.setItem(STORAGE_KEY, serialized);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

let activeDisposables: Array<{ dispose(): void }> = [];

export function activateInstalledVsCodeExtensions(monaco: typeof MonacoApi): void {
  for (const disposable of activeDisposables) disposable.dispose();
  activeDisposables = [];
  const registeredLanguages = new Set(
    monaco.languages.getLanguages().map((language) => language.id),
  );
  for (const extension of getInstalledVsCodeExtensions()) {
    for (const language of extension.languages) {
      if (!registeredLanguages.has(language.id)) {
        activeDisposables.push(
          monaco.languages.register({
            id: language.id,
            aliases: language.aliases,
            extensions: language.extensions,
          }),
        );
        registeredLanguages.add(language.id);
      }
    }
    const snippetsByLanguage = new Map<string, VsCodeSnippetContribution[]>();
    for (const snippet of extension.snippets) {
      const existing = snippetsByLanguage.get(snippet.language);
      if (existing) existing.push(snippet);
      else snippetsByLanguage.set(snippet.language, [snippet]);
    }
    for (const [language, snippets] of snippetsByLanguage) {
      if (!registeredLanguages.has(language)) continue;
      activeDisposables.push(
        monaco.languages.registerCompletionItemProvider(language, {
          provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn,
            );
            return {
              suggestions: snippets.map((snippet) => ({
                label: snippet.prefix,
                detail: `${snippet.label} · ${extension.name}`,
                documentation: snippet.description,
                insertText: snippet.body,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                kind: monaco.languages.CompletionItemKind.Snippet,
                range,
              })),
            };
          },
        }),
      );
    }
  }
}

export function subscribeToVsCodeExtensionChanges(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
