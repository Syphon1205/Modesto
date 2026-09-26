import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
  type FileTreeIconConfig,
  type FileTreeIcons,
} from "@pierre/trees";

export interface PierreIconResolution {
  name: string;
  token?: string;
}

const PIERRE_ICON_SPRITE_ID = "modesto-pierre-file-icon-sprite";
const IMPORTED_ICON_THEME_STORAGE_KEY = "modesto:file-icon-theme:v1";
const IMPORTED_ICON_THEME_METADATA_KEY = "modesto:file-icon-theme:active:v1";
const FILE_ICON_PACK_PREFERENCE_KEY = "modesto:file-icon-pack:v1";
const ICON_THEME_DATABASE_NAME = "modesto-appearance";
const ICON_THEME_DATABASE_VERSION = 1;
const ICON_THEME_STORE_NAME = "file-icon-themes";
const ACTIVE_ICON_THEME_KEY = "active";

const T3_FILE_ICON_SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">
  <symbol id="t3-file-icon-package-json" viewBox="0 0 32 32">
    <path d="M2 2H30V30H2" fill="#c12127" />
    <path d="M7.25 7.25h17.5v17.5h-3.5v-14H16v14H7.25" fill="#fff" />
  </symbol>
  <symbol id="t3-file-icon-tsconfig" viewBox="0 0 32 32">
    <path d="M23.827 8.243a4.424 4.424 0 0 1 2.223 1.281 5.853 5.853 0 0 1 .852 1.143c.011.045-1.534 1.083-2.471 1.662-.034.023-.169-.124-.322-.35a2.014 2.014 0 0 0-1.67-1c-1.077-.074-1.771.49-1.766 1.433a1.3 1.3 0 0 0 .153.666c.237.49.677.784 2.059 1.383 2.544 1.1 3.636 1.817 4.31 2.843a5.158 5.158 0 0 1 .416 4.333 4.764 4.764 0 0 1-3.932 2.815 10.9 10.9 0 0 1-2.708-.028 6.531 6.531 0 0 1-3.616-1.884 6.278 6.278 0 0 1-.926-1.371 2.655 2.655 0 0 1 .327-.208c.158-.09.756-.434 1.32-.761l1.024-.6.214.312a4.771 4.771 0 0 0 1.35 1.292 3.3 3.3 0 0 0 3.458-.175 1.545 1.545 0 0 0 .2-1.974c-.276-.4-.84-.727-2.443-1.422a8.8 8.8 0 0 1-3.349-2.055 4.687 4.687 0 0 1-.976-1.777 7.116 7.116 0 0 1-.062-2.268 4.332 4.332 0 0 1 3.644-3.374 9 9 0 0 1 2.71.01ZM15.484 9.726l.011 1.454h-4.63v13.148H7.6V11.183H2.97V9.755a13.986 13.986 0 0 1 .04-1.466c.017-.023 2.832-.034 6.245-.028l6.211.017Z" fill="#007acc" />
    <path d="m27.075 25.107.363-.361c1.68.055 1.706 0 1.78-.177l.462-1.124.034-.107-.038-.093c-.02-.049-.081-.2-1.13-1.2v-.526c1.211-1.166 1.185-1.226 1.116-1.4l-.46-1.136c-.069-.17-.1-.237-1.763-.191l-.364-.367a8.138 8.138 0 0 0-.057-1.657l-.047-.106-1.2-.525c-.177-.081-.239-.11-1.372 1.124l-.509-.008c-1.167-1.245-1.222-1.223-1.4-1.152l-1.115.452c-.175.071-.236.1-.169 1.79l-.36.359c-1.68-.055-1.7 0-1.778.177L18.606 20l-.036.108.038.094c.02.048.078.194 1.13 1.2v.525c-1.211 1.166-1.184 1.226-1.115 1.4l.459 1.137c.07.174.1.236 1.763.192l.363.377a8.169 8.169 0 0 0 .055 1.654l.047.107 1.208.528c.176.073.236.1 1.366-1.13l.509.006c1.168 1.247 1.228 1.223 1.4 1.154l1.113-.45c.176-.075.237-.102.169-1.795Zm-4.788-2.632a2 2 0 1 1 2.618 1.14 2.023 2.023 0 0 1-2.618-1.14Z" fill="#99b8c4" />
  </symbol>
  <symbol id="t3-file-icon-agents" viewBox="0 0 32 32">
    <path fill="currentColor" d="M27.2 16c0-6.19-5.01-11.2-11.2-11.2C9.81 4.8 4.8 9.81 4.8 16S9.81 27.2 16 27.2c6.19 0 11.2-5.01 11.2-11.2Zm-5.6 2.1a1.4 1.4 0 1 1 0 2.8h-4.2a1.4 1.4 0 1 1 0-2.8Zm-11.2-6.8c.622-.373 1.42-.208 1.84.361l.079.119 2.1 3.5.088.171c.15.351.15.748 0 1.1l-.088.171-2.1 3.5a1.4 1.4 0 0 1-2.4-1.44L11.59 16l-1.67-2.78-.067-.127c-.302-.642-.075-1.42.547-1.79ZM30 16c0 7.73-6.27 14-14 14S2 23.73 2 16 8.27 2 16 2s14 6.27 14 14Z" />
  </symbol>
  <symbol id="t3-file-icon-claude" viewBox="0 0 32 32">
    <path fill="#d97757" d="m7.5 20.61 5.5-3.08.1-.27-.1-.15h-.27l-.92-.06a234.2 234.2 0 0 1-8.51-.34l-.67-.14-.62-.82.06-.41.56-.38.8.07c3.08.2 6.15.4 9.21.72h.46l.06-.19-.16-.1-.12-.12-2.74-1.86c-2.04-1.3-3.55-2.43-5.38-3.68l-.43-.54-.18-1.18.76-.84 1.03.07.26.07c2.03 1.6 4.1 3.14 6.17 4.66l.43.36.17-.12.02-.09-.2-.32c-1.43-2.6-2.55-4.62-4-6.96l-.2-.72c-.08-.3-.13-.55-.13-.85l.87-1.18.49-.16 1.16.16.49.42c1.4 3.31 2.76 5.93 4.23 8.83l.29.97.1.3h.19v-.17c.65-3.42 0-6.57 1.22-9.53l.87-.57.68.33.56.8-.08.51c-.37 2.62-.92 5.22-1.4 7.82h.24l.29-.29a68.66 68.66 0 0 1 4.91-5.94l.64-.5h1.2l.89 1.32-.4 1.36a53.45 53.45 0 0 0-4.66 6.47l.09.13.22-.02c2.4-.57 4.84-.99 7.27-1.4l.97.45.1.46-.37.94c-3 .72-6 1.34-9 2.05l-.05.04.06.07c2.7.26 5.62.3 7.99.47l.92.61.55.75-.1.56-1.4.73c-2.93-.7-5.19-1.22-7.91-1.9h-.22v.13c2.18 2.12 4.6 4.27 6.54 6.07l.15.68-.38.53-.4-.06c-2.04-1.43-3.9-3.09-5.8-4.7h-.15v.2l.52.76c1.14 1.79 2.64 3.25 2.87 5.37l-.2.41-.7.25-.78-.14a73.16 73.16 0 0 1-4.58-7.04l-.17.09-.78 8.46-.37.43-.85.33-.71-.54-.38-.87a114 114 0 0 0 1.53-7.97l.2-.73-.01-.05-.16.02a76.67 76.67 0 0 1-6.23 7.88l-.48.2-.84-.44.08-.77.47-.69c2.07-2.57 3.54-4.66 5.54-7v-.19h-.07l-7.4 4.8-1.31.17-.57-.53.07-.87.27-.28 2.23-1.53Z" />
  </symbol>
  <symbol id="t3-file-icon-readme" viewBox="0 0 32 32">
    <rect x="2.5" y="7.955" width="27" height="16.091" fill="none" stroke="#b48a5a" />
    <path fill="#b48a5a" d="M5.909 20.636v-9.272h2.727l2.728 3.409 2.727-3.409h2.727v9.272h-2.727v-5.318l-2.727 3.409-2.728-3.409v5.318H5.91Zm17.046 0-4.091-4.5h2.727v-4.772h2.727v4.772h2.727l-4.09 4.5Z" />
  </symbol>
  <symbol id="t3-file-icon-pnpm" viewBox="0 0 32 32">
    <path fill="#f9ad00" d="M30 10.75h-8.749V2H30Zm-9.626 0h-8.75V2h8.75Zm-9.625 0H2V2h8.749ZM30 20.375h-8.749v-8.75H30Z" />
    <path fill="currentColor" d="M20.374 20.375h-8.75v-8.75h8.75Zm0 9.625h-8.75v-8.75h8.75ZM30 30h-8.749v-8.75H30Zm-19.251 0H2v-8.75h8.749Z" />
  </symbol>
</svg>`;

const BASE_PIERRE_ICONS = {
  set: "complete",
  colored: true,
  spriteSheet: T3_FILE_ICON_SPRITE,
  byFileName: {
    "package.json": "t3-file-icon-package-json",
    "tsconfig.json": "t3-file-icon-tsconfig",
    "agents.md": "t3-file-icon-agents",
    "claude.md": "t3-file-icon-claude",
    "readme.md": "t3-file-icon-readme",
    "pnpm-lock.yaml": "t3-file-icon-pnpm",
    "pnpm-workspace.yaml": "t3-file-icon-pnpm",
  },
} satisfies FileTreeIcons;

export type ImportedFileIconTheme = Readonly<{
  id: string;
  label: string;
  spriteSheet: string;
  byFileName: Record<string, string>;
  byFileExtension: Record<string, string>;
  byFolderName?: Record<string, string>;
  folderIcon?: string;
}>;

export type BuiltInFileIconPackId = "modesto" | "modesto-mono" | "standard" | "minimal";
export type FileIconPackOption = Readonly<{
  id: string;
  label: string;
  description: string;
  custom: boolean;
}>;

export const BUILT_IN_FILE_ICON_PACKS: ReadonlyArray<FileIconPackOption> = [
  {
    id: "modesto",
    label: "Modesto Color",
    description: "Detailed, colorful icons for common project files.",
    custom: false,
  },
  {
    id: "modesto-mono",
    label: "Modesto Mono",
    description: "The same file shapes in a quieter single-color style.",
    custom: false,
  },
  {
    id: "standard",
    label: "Classic",
    description: "A compact set with familiar code-file shapes.",
    custom: false,
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Simple icons with the least visual noise.",
    custom: false,
  },
];

function isBuiltInFileIconPackId(value: string): value is BuiltInFileIconPackId {
  return BUILT_IN_FILE_ICON_PACKS.some((pack) => pack.id === value);
}

function readFileIconPackPreference(): string {
  if (typeof window === "undefined") return "modesto";
  try {
    return window.localStorage.getItem(FILE_ICON_PACK_PREFERENCE_KEY) || "modesto";
  } catch {
    return "modesto";
  }
}

function readImportedFileIconTheme(): ImportedFileIconTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(IMPORTED_ICON_THEME_STORAGE_KEY) ?? "null",
    );
    if (!value || typeof value !== "object") return null;
    const theme = value as Partial<ImportedFileIconTheme>;
    if (
      typeof theme.id !== "string" ||
      typeof theme.label !== "string" ||
      typeof theme.spriteSheet !== "string"
    )
      return null;
    if (
      !theme.byFileName ||
      typeof theme.byFileName !== "object" ||
      !theme.byFileExtension ||
      typeof theme.byFileExtension !== "object"
    )
      return null;
    return theme as ImportedFileIconTheme;
  } catch {
    return null;
  }
}

let importedFileIconTheme = readImportedFileIconTheme();
let activeFileIconPackId = readFileIconPackPreference();
let iconThemeActivationVersion = 0;

function isImportedFileIconTheme(value: unknown): value is ImportedFileIconTheme {
  if (!value || typeof value !== "object") return false;
  const theme = value as Partial<ImportedFileIconTheme>;
  return (
    typeof theme.id === "string" &&
    typeof theme.label === "string" &&
    typeof theme.spriteSheet === "string" &&
    Boolean(theme.byFileName) &&
    typeof theme.byFileName === "object" &&
    Boolean(theme.byFileExtension) &&
    typeof theme.byFileExtension === "object"
  );
}

function openIconThemeDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const request = indexedDB.open(ICON_THEME_DATABASE_NAME, ICON_THEME_DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(ICON_THEME_STORE_NAME)) {
        request.result.createObjectStore(ICON_THEME_STORE_NAME);
      }
    });
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("Could not open icon theme storage.")),
    );
    request.addEventListener("success", () => resolve(request.result));
  });
}

async function readIndexedIconTheme(): Promise<ImportedFileIconTheme | null> {
  const database = await openIconThemeDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(ICON_THEME_STORE_NAME, "readonly")
        .objectStore(ICON_THEME_STORE_NAME)
        .get(ACTIVE_ICON_THEME_KEY);
      request.addEventListener("error", () =>
        reject(request.error ?? new Error("Could not read the icon theme.")),
      );
      request.addEventListener("success", () =>
        resolve(isImportedFileIconTheme(request.result) ? request.result : null),
      );
    });
  } finally {
    database.close();
  }
}

async function writeIndexedIconTheme(theme: ImportedFileIconTheme): Promise<void> {
  const database = await openIconThemeDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ICON_THEME_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ICON_THEME_STORE_NAME);
      store.put(theme, `theme:${theme.id}`);
      store.put(theme, ACTIVE_ICON_THEME_KEY);
      transaction.addEventListener("abort", () =>
        reject(transaction.error ?? new Error("Could not save the icon theme.")),
      );
      transaction.addEventListener("error", () =>
        reject(transaction.error ?? new Error("Could not save the icon theme.")),
      );
      transaction.addEventListener("complete", () => resolve());
    });
  } finally {
    database.close();
  }
}

async function readIndexedIconThemeById(id: string): Promise<ImportedFileIconTheme | null> {
  const database = await openIconThemeDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(ICON_THEME_STORE_NAME, "readonly")
        .objectStore(ICON_THEME_STORE_NAME)
        .get(`theme:${id}`);
      request.addEventListener("error", () =>
        reject(request.error ?? new Error("Could not read the icon pack.")),
      );
      request.addEventListener("success", () =>
        resolve(isImportedFileIconTheme(request.result) ? request.result : null),
      );
    });
  } finally {
    database.close();
  }
}

async function listIndexedIconThemes(): Promise<ImportedFileIconTheme[]> {
  const database = await openIconThemeDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const themes: ImportedFileIconTheme[] = [];
      const request = database
        .transaction(ICON_THEME_STORE_NAME, "readonly")
        .objectStore(ICON_THEME_STORE_NAME)
        .openCursor();
      request.addEventListener("error", () =>
        reject(request.error ?? new Error("Could not list icon packs.")),
      );
      request.addEventListener("success", () => {
        const cursor = request.result;
        if (!cursor) {
          resolve([...new Map(themes.map((theme) => [theme.id, theme])).values()]);
          return;
        }
        if (isImportedFileIconTheme(cursor.value)) themes.push(cursor.value);
        cursor.continue();
      });
    });
  } finally {
    database.close();
  }
}

async function deleteIndexedIconTheme(id: string): Promise<void> {
  const database = await openIconThemeDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ICON_THEME_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ICON_THEME_STORE_NAME);
      store.delete(`theme:${id}`);
      if (importedFileIconTheme?.id === id) store.delete(ACTIVE_ICON_THEME_KEY);
      transaction.addEventListener("abort", () =>
        reject(transaction.error ?? new Error("Could not remove the icon pack.")),
      );
      transaction.addEventListener("error", () =>
        reject(transaction.error ?? new Error("Could not remove the icon pack.")),
      );
      transaction.addEventListener("complete", () => resolve());
    });
  } finally {
    database.close();
  }
}

function activePierreIcons(): FileTreeIconConfig {
  if (isBuiltInFileIconPackId(activeFileIconPackId)) {
    if (activeFileIconPackId === "modesto-mono") return { ...BASE_PIERRE_ICONS, colored: false };
    if (activeFileIconPackId === "standard") return { set: "standard", colored: false };
    if (activeFileIconPackId === "minimal") return { set: "minimal", colored: false };
  }
  return importedFileIconTheme
    ? {
        ...BASE_PIERRE_ICONS,
        spriteSheet: mergeSvgSpriteSheets(
          BASE_PIERRE_ICONS.spriteSheet,
          importedFileIconTheme.spriteSheet,
        ),
        byFileName: { ...BASE_PIERRE_ICONS.byFileName, ...importedFileIconTheme.byFileName },
        byFileExtension: importedFileIconTheme.byFileExtension,
      }
    : BASE_PIERRE_ICONS;
}

function mergeSvgSpriteSheets(...sheets: string[]): string {
  const content = sheets
    .map((sheet) => sheet.replace(/^\s*<svg\b[^>]*>/i, "").replace(/<\/svg>\s*$/i, ""))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">${content}</svg>`;
}

export let T3_PIERRE_ICONS = activePierreIcons();
let completeIconResolver = createFileTreeIconResolver(T3_PIERRE_ICONS);

function activateImportedFileIconTheme(theme: ImportedFileIconTheme): void {
  importedFileIconTheme = theme;
  activeFileIconPackId = theme.id;
  T3_PIERRE_ICONS = activePierreIcons();
  completeIconResolver = createFileTreeIconResolver(T3_PIERRE_ICONS);
  document.getElementById(PIERRE_ICON_SPRITE_ID)?.remove();
  ensurePierreIconSprite();
  window.dispatchEvent(new CustomEvent("modesto:file-icon-theme-changed"));
}

/** Install and activate a sanitized file-icon contribution from a theme extension. */
export async function installImportedFileIconTheme(theme: ImportedFileIconTheme): Promise<void> {
  iconThemeActivationVersion += 1;
  let storedInIndexedDb = false;
  try {
    await writeIndexedIconTheme(theme);
    storedInIndexedDb = true;
  } catch (indexedDbCause) {
    try {
      // Browser test contexts and restrictive embedded views may not expose
      // IndexedDB. Keep small themes working there through the legacy store.
      window.localStorage.setItem(IMPORTED_ICON_THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch (localStorageCause) {
      throw new Error("This icon theme could not be saved in browser storage.", {
        cause: localStorageCause ?? indexedDbCause,
      });
    }
  }
  if (storedInIndexedDb) {
    try {
      window.localStorage.removeItem(IMPORTED_ICON_THEME_STORAGE_KEY);
    } catch {
      // The IndexedDB copy has already been committed.
    }
  }
  try {
    window.localStorage.setItem(FILE_ICON_PACK_PREFERENCE_KEY, theme.id);
    window.localStorage.setItem(
      IMPORTED_ICON_THEME_METADATA_KEY,
      JSON.stringify({ id: theme.id, label: theme.label }),
    );
  } catch {
    // IndexedDB remains the source of truth when localStorage is unavailable.
  }
  activateImportedFileIconTheme(theme);
}

export function getActiveFileIconPackId(): string {
  return activeFileIconPackId;
}

export async function listFileIconPacks(): Promise<FileIconPackOption[]> {
  let imported: ImportedFileIconTheme[] = [];
  try {
    imported = await listIndexedIconThemes();
  } catch {
    if (importedFileIconTheme) imported = [importedFileIconTheme];
  }
  return [
    ...BUILT_IN_FILE_ICON_PACKS,
    ...imported.map((theme) => ({
      id: theme.id,
      label: theme.label,
      description: "Installed from a VS Code extension.",
      custom: true,
    })),
  ];
}

function refreshActiveFileIcons(): void {
  T3_PIERRE_ICONS = activePierreIcons();
  completeIconResolver = createFileTreeIconResolver(T3_PIERRE_ICONS);
  document.getElementById(PIERRE_ICON_SPRITE_ID)?.remove();
  ensurePierreIconSprite();
  window.dispatchEvent(new CustomEvent("modesto:file-icon-theme-changed"));
}

export async function setActiveFileIconPack(id: string): Promise<void> {
  if (isBuiltInFileIconPackId(id)) {
    iconThemeActivationVersion += 1;
    activeFileIconPackId = id;
    importedFileIconTheme = null;
    window.localStorage.setItem(FILE_ICON_PACK_PREFERENCE_KEY, id);
    window.localStorage.removeItem(IMPORTED_ICON_THEME_METADATA_KEY);
    refreshActiveFileIcons();
    return;
  }
  const theme =
    importedFileIconTheme?.id === id ? importedFileIconTheme : await readIndexedIconThemeById(id);
  if (!theme) throw new Error("That icon pack is no longer installed.");
  try {
    await writeIndexedIconTheme(theme);
  } catch {
    // A localStorage-backed theme can still be switched in restrictive views
    // where IndexedDB is unavailable.
  }
  window.localStorage.setItem(FILE_ICON_PACK_PREFERENCE_KEY, id);
  window.localStorage.setItem(
    IMPORTED_ICON_THEME_METADATA_KEY,
    JSON.stringify({ id: theme.id, label: theme.label }),
  );
  activateImportedFileIconTheme(theme);
}

export async function removeFileIconPack(id: string): Promise<void> {
  if (isBuiltInFileIconPackId(id)) return;
  await deleteIndexedIconTheme(id);
  if (activeFileIconPackId === id) await setActiveFileIconPack("modesto");
}

export function getImportedFileIconThemeLabel(): string | null {
  if (importedFileIconTheme?.label) return importedFileIconTheme.label;
  try {
    const metadata: unknown = JSON.parse(
      window.localStorage.getItem(IMPORTED_ICON_THEME_METADATA_KEY) ?? "null",
    );
    return metadata &&
      typeof metadata === "object" &&
      typeof (metadata as { label?: unknown }).label === "string"
      ? (metadata as { label: string }).label
      : null;
  } catch {
    return null;
  }
}

export function getActivePierreIcons(): FileTreeIconConfig {
  return T3_PIERRE_ICONS;
}

const LANGUAGE_EXTENSION_ALIASES: Record<string, string> = {
  bash: "sh",
  csharp: "cs",
  dockerfile: "dockerfile",
  javascript: "js",
  jsx: "jsx",
  markdown: "md",
  mdx: "mdx",
  plaintext: "txt",
  python: "py",
  ruby: "rb",
  rust: "rs",
  shell: "sh",
  shellscript: "sh",
  swift: "swift",
  typescript: "ts",
  tsx: "tsx",
  yaml: "yml",
};

export function basenameOfPath(pathValue: string): string {
  const slashIndex = pathValue.lastIndexOf("/");
  return slashIndex === -1 ? pathValue : pathValue.slice(slashIndex + 1);
}

export function inferEntryKindFromPath(pathValue: string): "file" | "directory" {
  const base = basenameOfPath(pathValue);
  if (base.startsWith(".") && !base.slice(1).includes(".")) return "directory";
  return base.includes(".") ? "file" : "directory";
}

export function syntheticFileNameForLanguageId(languageId: string): string {
  const normalized = languageId.toLowerCase();
  return `file.${LANGUAGE_EXTENSION_ALIASES[normalized] ?? normalized}`;
}

export function resolvePierreIconForEntry(
  pathValue: string,
  kind: "file" | "directory",
): PierreIconResolution | null {
  if (kind === "directory") {
    if (!importedFileIconTheme || isBuiltInFileIconPackId(activeFileIconPackId)) return null;
    const name = basenameOfPath(pathValue.replace(/\/$/, "")).toLowerCase();
    const iconName = importedFileIconTheme.byFolderName?.[name] ?? importedFileIconTheme.folderIcon;
    return iconName ? { name: iconName, token: "custom" } : null;
  }
  return completeIconResolver.resolveIcon("file-tree-icon-file", pathValue);
}

export function hasSpecificPierreIconForFileName(fileName: string): boolean {
  return resolvePierreIconForEntry(fileName, "file")?.token !== "default";
}

export function ensurePierreIconSprite(): void {
  if (typeof document === "undefined" || document.getElementById(PIERRE_ICON_SPRITE_ID)) return;
  const container = document.createElement("div");
  container.id = PIERRE_ICON_SPRITE_ID;
  container.setAttribute("aria-hidden", "true");
  container.style.position = "absolute";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  container.style.pointerEvents = "none";
  const customSprite =
    typeof T3_PIERRE_ICONS === "string" ? "" : (T3_PIERRE_ICONS.spriteSheet ?? "");
  container.innerHTML = `${getBuiltInSpriteSheet("complete")}${customSprite}`;
  document.body.prepend(container);
}

if (typeof window !== "undefined") {
  const hydrationVersion = iconThemeActivationVersion;
  void readIndexedIconTheme()
    .then((theme) => {
      if (
        theme &&
        iconThemeActivationVersion === hydrationVersion &&
        activeFileIconPackId === theme.id
      ) {
        activateImportedFileIconTheme(theme);
      }
    })
    .catch(() => {
      // The synchronous localStorage theme above remains the fallback.
    });
}
