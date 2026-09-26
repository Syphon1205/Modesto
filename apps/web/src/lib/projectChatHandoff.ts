let pendingProjectChatTask: string | null = null;

export function stageProjectChatHandoff(task: string): void {
  pendingProjectChatTask = task;
}

export function takeProjectChatHandoff(): string | null {
  const task = pendingProjectChatTask;
  pendingProjectChatTask = null;
  return task;
}

export function peekProjectChatHandoff(): string | null {
  return pendingProjectChatTask;
}
