import type { RepoMemoryWritebackSuggestion } from "@modesto/contracts";
import { Effect, FileSystem, Path } from "effect";

import { detectRepoMemoryFiles } from "./detectRepoMemoryFiles";
import { normalizeWorkspaceRoot } from "./paths";

const DURABLE_NOTE_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly reason: string;
  readonly confidence: RepoMemoryWritebackSuggestion["confidence"];
}> = [
  {
    pattern:
      /\b(decided|decision|we(?:'ll| will) always|always use|never use|never run|must not|must always)\b/i,
    reason: "Conversation mentions a durable project rule or decision",
    confidence: "high",
  },
  {
    pattern: /\b(convention|prefer|standard|guideline|policy|rule:?)\b/i,
    reason: "Conversation mentions a convention that may belong in repo instructions",
    confidence: "medium",
  },
  {
    pattern: /\b(remember to|going forward|from now on|do not commit|do not run)\b/i,
    reason: "Conversation includes ongoing workflow guidance",
    confidence: "low",
  },
];

const AGENTS_OR_CLAUDE_TARGETS = ["AGENTS.md", "CLAUDE.md"] as const;

function splitConversationNotes(conversationNotes: string): ReadonlyArray<string> {
  return conversationNotes
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= 24);
}

function pickTargetPath(paragraph: string): (typeof AGENTS_OR_CLAUDE_TARGETS)[number] {
  if (/\bclaude\b/i.test(paragraph)) {
    return "CLAUDE.md";
  }
  return "AGENTS.md";
}

function excerptAlreadyPresent(
  excerpt: string,
  existingContents: ReadonlyArray<string | null>,
): boolean {
  const normalizedExcerpt = excerpt.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalizedExcerpt.length < 24) {
    return false;
  }
  const snippet = normalizedExcerpt.slice(0, 80);
  return existingContents.some((content) => content?.toLowerCase().includes(snippet) ?? false);
}

export const suggestDurableWritebacks = Effect.fnUntraced(function* (input: {
  readonly workspaceRoot: string;
  readonly conversationNotes: string;
}) {
  const normalizedRoot = yield* normalizeWorkspaceRoot(input.workspaceRoot);
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const detectedFiles = yield* detectRepoMemoryFiles(normalizedRoot);
  const existingContents = yield* Effect.forEach(AGENTS_OR_CLAUDE_TARGETS, (targetPath) =>
    Effect.gen(function* () {
      const absolutePath = path.join(normalizedRoot, targetPath);
      const exists = yield* fileSystem.exists(absolutePath);
      if (!exists) {
        return null;
      }
      return yield* fileSystem.readFileString(absolutePath);
    }),
  );

  const suggestions: RepoMemoryWritebackSuggestion[] = [];
  const seen = new Set<string>();

  for (const paragraph of splitConversationNotes(input.conversationNotes)) {
    const match = DURABLE_NOTE_PATTERNS.find(({ pattern }) => pattern.test(paragraph));
    if (!match) {
      continue;
    }

    const targetPath = pickTargetPath(paragraph);
    const targetExists = detectedFiles.some((file) => file.path === targetPath && file.exists);
    if (!targetExists && targetPath === "CLAUDE.md") {
      const agentsExists = detectedFiles.some((file) => file.path === "AGENTS.md" && file.exists);
      if (!agentsExists) {
        continue;
      }
    }

    const excerpt = paragraph.length > 240 ? `${paragraph.slice(0, 237).trimEnd()}...` : paragraph;
    if (excerptAlreadyPresent(excerpt, existingContents)) {
      continue;
    }

    const dedupeKey = `${targetPath}:${excerpt.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    suggestions.push({
      targetPath,
      reason: match.reason,
      excerpt,
      confidence: match.confidence,
    });
  }

  return { suggestions };
});
