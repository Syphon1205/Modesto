// FILE: MonacoFileEditor.tsx
// Purpose: The IDE editing surface - VS Code's editor over a workspace file.
// Layer: Files UI
//
// Sits alongside the existing preview surface rather than replacing it. The
// preview carries inline review comments and line annotations that this cannot;
// this carries multi-cursor, find and replace, folding, and the rest of the
// editing behaviour a developer expects and the preview cannot. Which one you
// want depends on whether you are reviewing or writing, so both stay.
//
// Saving reuses the panel's existing FileSaveCoordinator, so debounce, pending
// state, and conflict confirmation behave identically in both surfaces rather
// than growing a second persistence path.

import { useEffect, useRef, useState } from "react";

import { loadMonaco, type Monaco, monacoLanguageForPath } from "../../lib/monacoSetup";

export function MonacoFileEditor({
  relativePath,
  contents,
  resolvedTheme,
  readOnly = false,
  onChange,
}: {
  readonly relativePath: string;
  readonly contents: string;
  readonly resolvedTheme: "light" | "dark";
  readonly readOnly?: boolean;
  /** Called on every edit; the caller owns debouncing and persistence. */
  readonly onChange: (next: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ReturnType<Monaco["editor"]["create"]> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Read once at creation; the effects below keep the live editor in step.
  const contentsRef = useRef(contents);
  contentsRef.current = contents;
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;
  const [failed, setFailed] = useState<string | null>(null);

  // Created once per file. Contents are pushed into the existing model below
  // rather than recreating the editor, which would throw away undo history and
  // cursor position on every keystroke that round-trips through the server.
  useEffect(() => {
    let disposed = false;
    let editor: ReturnType<Monaco["editor"]["create"]> | null = null;

    void loadMonaco()
      .then((monaco) => {
        if (disposed || !hostRef.current) return;
        const language = monacoLanguageForPath(relativePath);
        editor = monaco.editor.create(hostRef.current, {
          value: contentsRef.current,
          ...(language ? { language } : {}),
          theme: themeRef.current === "dark" ? "vs-dark" : "vs",
          readOnly,
          automaticLayout: true,
          minimap: { enabled: true },
          fontSize: 12,
          lineNumbers: "on",
          renderWhitespace: "selection",
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          tabSize: 2,
        });
        editorRef.current = editor;
        editor.onDidChangeModelContent(() => {
          const next = editor?.getValue();
          if (typeof next === "string") onChangeRef.current(next);
        });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        // Monaco is a large dynamic import; a failure here must say so rather
        // than leaving an empty rectangle that looks like an empty file.
        setFailed(error instanceof Error ? error.message : "The editor failed to load.");
      });

    return () => {
      disposed = true;
      editor?.getModel()?.dispose();
      editor?.dispose();
      editorRef.current = null;
    };
    // Deliberately not keyed on `contents`: the editor is created once per
    // file. Keying on contents would tear the editor down and rebuild it on
    // every keystroke, losing undo history, cursor, folds and scroll position.
  }, [readOnly, relativePath]);

  // Contents arriving from outside - a reload, or an agent editing the file
  // while it is open. Applied only when they differ from what is on screen, so
  // the echo of the user's own typing does not reset their cursor.
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || model.getValue() === contents) return;
    const selections = editor.getSelections();
    model.setValue(contents);
    if (selections) editor.setSelections(selections);
  }, [contents]);

  // Theme changes without a reload; the editor is not recreated for them.
  useEffect(() => {
    void loadMonaco().then((monaco) => {
      monaco.editor.setTheme(resolvedTheme === "dark" ? "vs-dark" : "vs");
    });
  }, [resolvedTheme]);

  if (failed !== null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {failed}
      </div>
    );
  }

  return <div ref={hostRef} className="min-h-0 flex-1" data-monaco-editor />;
}
