import { collectComposerInlineTokens } from "./composerInlineTokens.ts";
import { scoreQueryMatch } from "./searchRanking.ts";

export type NativeAppSuite = "adobe";

export type NativeAppId =
  | "photoshop"
  | "after-effects"
  | "illustrator"
  | "premiere-pro"
  | "indesign"
  | "lightroom"
  | "acrobat"
  | "audition"
  | "media-encoder"
  | "bridge"
  | "animate"
  | "xd";

export interface NativeApp {
  readonly id: NativeAppId;
  readonly name: string;
  readonly suite: NativeAppSuite;
  readonly mentionAliases: ReadonlyArray<string>;
  readonly capabilityHint: string;
  readonly darwinBundleNames: ReadonlyArray<string>;
  readonly winPathSegments: ReadonlyArray<ReadonlyArray<string>>;
  readonly linuxCommands: ReadonlyArray<string>;
  readonly appleScriptNames: ReadonlyArray<string>;
}

const ADOBE_YEARS = [2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;

function adobeYearedBundles(name: string): string[] {
  const bundles: string[] = [];
  for (const year of ADOBE_YEARS) {
    const titled = `${name} ${year}`;
    bundles.push(`${titled}.app`, `${titled}/${titled}.app`);
  }
  bundles.push(`${name}.app`, `${name}/${name}.app`);
  return bundles;
}

function adobeYearedWinPaths(folderPrefix: string, exeSegments: ReadonlyArray<string>): string[][] {
  const paths: string[][] = [];
  for (const year of ADOBE_YEARS) {
    paths.push([`${folderPrefix} ${year}`, ...exeSegments]);
  }
  paths.push([folderPrefix, ...exeSegments]);
  return paths;
}

export const NATIVE_APPS: ReadonlyArray<NativeApp> = [
  {
    id: "photoshop",
    name: "Photoshop",
    suite: "adobe",
    mentionAliases: ["ps", "adobe photoshop", "adobe-photoshop"],
    capabilityHint: "edit the open document, adjust layers, and make the visual changes I describe",
    darwinBundleNames: adobeYearedBundles("Adobe Photoshop"),
    winPathSegments: adobeYearedWinPaths("Adobe Photoshop", ["Photoshop.exe"]),
    linuxCommands: ["photoshop"],
    appleScriptNames: ["Adobe Photoshop", ...ADOBE_YEARS.map((year) => `Adobe Photoshop ${year}`)],
  },
  {
    id: "after-effects",
    name: "After Effects",
    suite: "adobe",
    mentionAliases: ["ae", "aftereffects", "adobe after effects", "adobe-after-effects"],
    capabilityHint:
      "edit the open composition, adjust layers, and make the motion changes I describe",
    darwinBundleNames: adobeYearedBundles("Adobe After Effects"),
    winPathSegments: adobeYearedWinPaths("Adobe After Effects", ["Support Files", "AfterFX.exe"]),
    linuxCommands: ["afterfx"],
    appleScriptNames: [
      "Adobe After Effects",
      ...ADOBE_YEARS.map((year) => `Adobe After Effects ${year}`),
    ],
  },
  {
    id: "illustrator",
    name: "Illustrator",
    suite: "adobe",
    mentionAliases: ["ai", "adobe illustrator", "adobe-illustrator"],
    capabilityHint: "edit the open artwork and make the illustration changes I describe",
    darwinBundleNames: adobeYearedBundles("Adobe Illustrator"),
    winPathSegments: adobeYearedWinPaths("Adobe Illustrator", [
      "Support Files",
      "Contents",
      "Windows",
      "Illustrator.exe",
    ]),
    linuxCommands: ["illustrator"],
    appleScriptNames: [
      "Adobe Illustrator",
      ...ADOBE_YEARS.map((year) => `Adobe Illustrator ${year}`),
    ],
  },
  {
    id: "premiere-pro",
    name: "Premiere Pro",
    suite: "adobe",
    mentionAliases: ["premiere", "pr", "adobe premiere", "adobe-premiere", "adobe premiere pro"],
    capabilityHint: "edit the open sequence, cut, and make the timeline changes I describe",
    darwinBundleNames: adobeYearedBundles("Adobe Premiere Pro"),
    winPathSegments: adobeYearedWinPaths("Adobe Premiere Pro", ["Adobe Premiere Pro.exe"]),
    linuxCommands: ["premiere"],
    appleScriptNames: [
      "Adobe Premiere Pro",
      ...ADOBE_YEARS.map((year) => `Adobe Premiere Pro ${year}`),
    ],
  },
  {
    id: "indesign",
    name: "InDesign",
    suite: "adobe",
    mentionAliases: ["id", "adobe indesign", "adobe-indesign"],
    capabilityHint: "edit the open layout and make the page changes I describe",
    darwinBundleNames: adobeYearedBundles("Adobe InDesign"),
    winPathSegments: adobeYearedWinPaths("Adobe InDesign", ["InDesign.exe"]),
    linuxCommands: ["indesign"],
    appleScriptNames: ["Adobe InDesign", ...ADOBE_YEARS.map((year) => `Adobe InDesign ${year}`)],
  },
  {
    id: "lightroom",
    name: "Lightroom",
    suite: "adobe",
    mentionAliases: ["lr", "lightroom classic", "adobe lightroom", "adobe-lightroom"],
    capabilityHint: "edit the selected photo and make the develop changes I describe",
    darwinBundleNames: [
      "Adobe Lightroom Classic.app",
      "Adobe Lightroom.app",
      ...adobeYearedBundles("Adobe Lightroom Classic"),
      ...adobeYearedBundles("Adobe Lightroom"),
    ],
    winPathSegments: [
      ["Adobe Lightroom Classic", "Lightroom.exe"],
      ["Adobe Lightroom", "Lightroom.exe"],
      ...adobeYearedWinPaths("Adobe Lightroom Classic", ["Lightroom.exe"]),
    ],
    linuxCommands: ["lightroom"],
    appleScriptNames: ["Adobe Lightroom Classic", "Adobe Lightroom"],
  },
  {
    id: "acrobat",
    name: "Acrobat",
    suite: "adobe",
    mentionAliases: ["adobe acrobat", "acrobat pro", "acrobat reader", "adobe-acrobat"],
    capabilityHint: "open the PDF and make the document changes I describe",
    darwinBundleNames: [
      "Adobe Acrobat.app",
      "Adobe Acrobat Pro.app",
      "Adobe Acrobat Reader.app",
      "Adobe Acrobat DC.app",
    ],
    winPathSegments: [
      ["Adobe", "Acrobat DC", "Acrobat", "Acrobat.exe"],
      ["Adobe", "Acrobat", "Acrobat.exe"],
    ],
    linuxCommands: ["acrobat"],
    appleScriptNames: ["Adobe Acrobat", "Adobe Acrobat Reader"],
  },
  {
    id: "audition",
    name: "Audition",
    suite: "adobe",
    mentionAliases: ["adobe audition", "adobe-audition"],
    capabilityHint: "edit the open audio session and make the sound changes I describe",
    darwinBundleNames: adobeYearedBundles("Adobe Audition"),
    winPathSegments: adobeYearedWinPaths("Adobe Audition", ["Adobe Audition.exe"]),
    linuxCommands: ["audition"],
    appleScriptNames: ["Adobe Audition", ...ADOBE_YEARS.map((year) => `Adobe Audition ${year}`)],
  },
  {
    id: "media-encoder",
    name: "Media Encoder",
    suite: "adobe",
    mentionAliases: ["ame", "adobe media encoder", "adobe-media-encoder"],
    capabilityHint: "queue and encode the open media",
    darwinBundleNames: adobeYearedBundles("Adobe Media Encoder"),
    winPathSegments: adobeYearedWinPaths("Adobe Media Encoder", ["Adobe Media Encoder.exe"]),
    linuxCommands: ["mediaencoder"],
    appleScriptNames: [
      "Adobe Media Encoder",
      ...ADOBE_YEARS.map((year) => `Adobe Media Encoder ${year}`),
    ],
  },
  {
    id: "bridge",
    name: "Bridge",
    suite: "adobe",
    mentionAliases: ["adobe bridge", "adobe-bridge"],
    capabilityHint: "browse files and collections in Bridge",
    darwinBundleNames: adobeYearedBundles("Adobe Bridge"),
    winPathSegments: adobeYearedWinPaths("Adobe Bridge", ["Adobe Bridge.exe"]),
    linuxCommands: ["bridge"],
    appleScriptNames: ["Adobe Bridge", ...ADOBE_YEARS.map((year) => `Adobe Bridge ${year}`)],
  },
  {
    id: "animate",
    name: "Animate",
    suite: "adobe",
    mentionAliases: ["adobe animate", "adobe-animate", "flash"],
    capabilityHint: "edit the open animation and make the timeline changes I describe",
    darwinBundleNames: adobeYearedBundles("Adobe Animate"),
    winPathSegments: adobeYearedWinPaths("Adobe Animate", ["Adobe Animate.exe"]),
    linuxCommands: ["animate"],
    appleScriptNames: ["Adobe Animate", ...ADOBE_YEARS.map((year) => `Adobe Animate ${year}`)],
  },
  {
    id: "xd",
    name: "Adobe XD",
    suite: "adobe",
    mentionAliases: ["adobexd", "adobe-xd"],
    capabilityHint: "edit the open XD file and make the design changes I describe",
    darwinBundleNames: ["Adobe XD.app"],
    winPathSegments: [["Adobe", "Adobe XD", "Adobe XD.exe"]],
    linuxCommands: ["adobe-xd"],
    appleScriptNames: ["Adobe XD"],
  },
];

export const NATIVE_APP_BY_ID: Readonly<Record<NativeAppId, NativeApp>> = Object.fromEntries(
  NATIVE_APPS.map((app) => [app.id, app]),
) as Readonly<Record<NativeAppId, NativeApp>>;

export function nativeAppById(id: string): NativeApp | undefined {
  return NATIVE_APP_BY_ID[id as NativeAppId];
}

export function normalizeNativeAppToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/gu, "");
}

export function nativeAppTokens(app: NativeApp): readonly string[] {
  return [app.id, app.name, ...app.mentionAliases];
}

export function nativeAppMentionLabel(app: NativeApp): string {
  return `@${app.id}`;
}

export function resolveNativeAppMention(query: string): NativeApp | undefined {
  const normalized = normalizeNativeAppToken(query);
  if (normalized.length === 0) return undefined;
  return NATIVE_APPS.find((app) =>
    nativeAppTokens(app).some((token) => normalizeNativeAppToken(token) === normalized),
  );
}

export function nativeAppForMentionPath(path: string): NativeApp | undefined {
  if (path.includes("/") || path.includes("\\")) return undefined;
  return resolveNativeAppMention(path);
}

export type NativeAppMentionMatch = {
  readonly app: NativeApp;
  readonly didYouMean: boolean;
};

const MENTION_FUZZY_BASE = 100;

export function searchNativeAppMentions(query: string): ReadonlyArray<NativeAppMentionMatch> {
  const normalized = normalizeNativeAppToken(query);
  if (normalized.length === 0) {
    return NATIVE_APPS.map((app) => ({ app, didYouMean: false }));
  }

  const ranked: NativeAppMentionMatch[] = [];
  for (const app of NATIVE_APPS) {
    const scores = nativeAppTokens(app).flatMap((candidate) => {
      const score = scoreQueryMatch({
        value: normalizeNativeAppToken(candidate),
        query: normalized,
        exactBase: 0,
        prefixBase: 2,
        boundaryBase: 4,
        includesBase: 6,
        ...(normalized.length >= 3 ? { fuzzyBase: MENTION_FUZZY_BASE } : {}),
        boundaryMarkers: ["-", "_", " "],
      });
      return score === null ? [] : [score];
    });
    if (scores.length === 0) continue;
    ranked.push({ app, didYouMean: Math.min(...scores) >= MENTION_FUZZY_BASE });
  }
  ranked.sort((left, right) => {
    if (left.didYouMean !== right.didYouMean) return left.didYouMean ? 1 : -1;
    return NATIVE_APPS.indexOf(left.app) - NATIVE_APPS.indexOf(right.app);
  });
  return ranked;
}

export function collectNativeAppsFromPrompt(prompt: string): ReadonlyArray<NativeApp> {
  const seen = new Set<string>();
  const apps: NativeApp[] = [];
  for (const token of collectComposerInlineTokens(prompt.endsWith(" ") ? prompt : `${prompt} `)) {
    if (token.type !== "mention") continue;
    const app = resolveNativeAppMention(token.value);
    if (!app || seen.has(app.id)) continue;
    seen.add(app.id);
    apps.push(app);
  }
  return apps;
}

export interface DetectNativeAppInput {
  readonly platform: NodeJS.Platform;
  readonly homeDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly pathExists: (path: string) => boolean;
}

function windowsProgramRoots(homeDir: string, env: NodeJS.ProcessEnv): string[] {
  const programFiles = env.ProgramFiles ?? env.PROGRAMFILES ?? "C:\\Program Files";
  const programFilesX86 =
    env["ProgramFiles(x86)"] ?? env.PROGRAMFILES_X86 ?? "C:\\Program Files (x86)";
  return [programFiles, programFilesX86];
}

export function candidateNativeAppPaths(
  input: DetectNativeAppInput,
  app: NativeApp,
): readonly string[] {
  if (input.platform === "darwin") {
    const dirs = ["/Applications", `${input.homeDir}/Applications`];
    return dirs.flatMap((dir) => app.darwinBundleNames.map((name) => `${dir}/${name}`));
  }
  if (input.platform === "win32") {
    return windowsProgramRoots(input.homeDir, input.env).flatMap((root) =>
      app.winPathSegments.map((segments) => [root, ...segments].join("\\")),
    );
  }
  return app.linuxCommands.flatMap((command) => [
    `/usr/bin/${command}`,
    `/usr/local/bin/${command}`,
    `${input.homeDir}/.local/bin/${command}`,
  ]);
}

export function detectNativeApp(
  input: DetectNativeAppInput,
  app: NativeApp,
): {
  readonly installed: boolean;
  readonly appPath: string | null;
} {
  const appPath =
    candidateNativeAppPaths(input, app).find((path) => input.pathExists(path)) ?? null;
  return { installed: appPath !== null, appPath };
}
