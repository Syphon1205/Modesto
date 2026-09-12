import { composeHtmlDocument } from "./canvasLanguages";
import { mermaidDocument, svgDocument } from "./visualArtifacts";

export function inlineVisualKind(language: string): "diagram" | "graphic" | "interactive" | null {
  switch (language.toLowerCase()) {
    case "mermaid":
    case "mmd":
      return "diagram";
    case "svg":
      return "graphic";
    case "html":
    case "htm":
      return "interactive";
    default:
      return null;
  }
}

export function inlineVisualDocument(language: string, source: string): string | null {
  if (!source.trim()) return null;
  switch (inlineVisualKind(language)) {
    case "diagram":
      return mermaidDocument(source);
    case "graphic":
      return svgDocument(source);
    case "interactive":
      return composeHtmlDocument({ html: source });
    default:
      return null;
  }
}
