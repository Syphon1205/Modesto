// FILE: workspaceFileErrors.ts
// Purpose: User-facing copy for workspace file read failures surfaced in previews.
// Layer: Web UI helpers
// Exports: formatWorkspaceFileReadError

function basenameOfPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function extractRealpathTarget(message: string): string | null {
  const match = message.match(/realpath '([^']+)'/u);
  return match?.[1] ?? null;
}

export function formatWorkspaceFileReadError(
  error: unknown,
  context?: { filePath?: string | null; workspaceRoot?: string | null },
): string {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("enoent")) {
    const missingPath =
      extractRealpathTarget(message) ?? context?.filePath ?? context?.workspaceRoot ?? null;
    if (missingPath) {
      return `${basenameOfPath(missingPath)} is not in this workspace. It may have been deleted, moved, or never created.`;
    }
    return "This file is not in the workspace. It may have been deleted, moved, or never created.";
  }

  if (lowerMessage.includes("not a file")) {
    return "That path is not a file.";
  }

  if (lowerMessage.includes("outside") && lowerMessage.includes("workspace")) {
    return "That file is outside this workspace.";
  }

  return message;
}
