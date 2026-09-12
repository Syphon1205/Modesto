import type { ScopedThreadRef } from "@modesto/contracts";
import { useEffect, useRef } from "react";

import { findLatestVisualArtifact } from "./visualArtifacts";

/**
 * Open generated image files without requiring /canvas. HTML, SVG and Mermaid
 * fences stay inline in the transcript instead of taking over the side panel.
 */
export function useVisualArtifactAutoOpen(input: {
  readonly threadRef: ScopedThreadRef | null;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly text: string }> | null;
  readonly openImage?: (relativePath: string) => void;
}): void {
  const lastOpened = useRef<string | null>(null);

  useEffect(() => {
    lastOpened.current = null;
  }, [input.threadRef?.environmentId, input.threadRef?.threadId]);

  useEffect(() => {
    const threadRef = input.threadRef;
    const messages = input.messages;
    if (!threadRef || !messages || messages.length === 0) return;

    const visual = findLatestVisualArtifact(messages);
    if (!visual) return;
    if (lastOpened.current === visual.fingerprint) return;
    lastOpened.current = visual.fingerprint;

    // Inline visuals own their lifecycle. Opening Canvas on each partial HTML
    // fingerprint steals focus and continually restarts interactive output.
    if (visual.kind === "html") return;

    input.openImage?.(visual.path);
  }, [input.messages, input.openImage, input.threadRef]);
}
