// Ambient declarations for Monaco's language contributions, which ship
// JavaScript with no types of their own. Deliberately a non-module file (no
// top-level import/export) so these are ambient rather than augmentations.
//
// Only the diagnostics setter is declared; broadening this to `any` would hide
// real mistakes at the one place the app touches Monaco's language services.

declare module "monaco-editor/language/typescript/monaco.contribution" {
  interface MonacoLanguageDiagnosticsDefaults {
    setDiagnosticsOptions(options: {
      readonly noSemanticValidation: boolean;
      readonly noSyntaxValidation: boolean;
    }): void;
  }
  export const typescriptDefaults: MonacoLanguageDiagnosticsDefaults;
  export const javascriptDefaults: MonacoLanguageDiagnosticsDefaults;
}
