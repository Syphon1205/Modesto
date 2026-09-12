import { useMemo } from "react";

import { composeHtmlDocument, looksLikeHtml } from "~/studio/canvasLanguages";

export function CanvasFrame({
  source,
  title,
}: {
  readonly source: string;
  readonly title: string;
}) {
  const srcDoc = useMemo(() => {
    if (!looksLikeHtml(source)) return null;
    return /^<!doctype html/i.test(source.trim()) || /^<html[\s>]/i.test(source.trim())
      ? source
      : composeHtmlDocument({ html: source });
  }, [source]);

  if (!srcDoc) return null;

  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      className="h-full w-full border-0 bg-background"
    />
  );
}
