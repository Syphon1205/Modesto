/**
 * Detects when imported conversation guidance conflicts with checked-in repo
 * instruction files. Checked-in files remain authoritative.
 */
export type RepoMemoryConflict = {
  readonly path: string;
  readonly reason: string;
  readonly freshness: "stale" | "superseded";
};

const INSTRUCTION_MARKERS = [
  /always\s+/i,
  /never\s+/i,
  /must\s+/i,
  /do not\s+/i,
  /prefer\s+/i,
  /required:/i,
];

export function detectRepoMemoryConversationConflicts(input: {
  readonly repoFileContents: ReadonlyArray<{ readonly path: string; readonly content: string }>;
  readonly conversationNotes: string;
}): ReadonlyArray<RepoMemoryConflict> {
  const notes = input.conversationNotes.trim();
  if (notes.length === 0 || input.repoFileContents.length === 0) {
    return [];
  }

  const noteHasInstructionTone = INSTRUCTION_MARKERS.some((marker) => marker.test(notes));
  if (!noteHasInstructionTone) {
    return [];
  }

  const conflicts: RepoMemoryConflict[] = [];
  for (const file of input.repoFileContents) {
    const content = file.content.trim();
    if (content.length === 0) continue;
    // If conversation restates guidance that contradicts a "never"/"always" line in-repo,
    // flag the conversation as stale relative to the authoritative file.
    const repoNever = [...content.matchAll(/never\s+([^\n.]+)/gi)].map((match) =>
      match[1]?.trim().toLowerCase(),
    );
    for (const rule of repoNever) {
      if (!rule) continue;
      if (notes.toLowerCase().includes(rule) && /always|prefer|should/i.test(notes)) {
        conflicts.push({
          path: file.path,
          reason: `Conversation guidance may contradict checked-in rule in ${file.path}: never ${rule}`,
          freshness: "stale",
        });
      }
    }
  }
  return conflicts;
}
