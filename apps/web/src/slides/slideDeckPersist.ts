import { isSlideDeckPath, suggestSlideDeckPath } from "./slideDeck";

export type RemoteSlideDeckDecision = "apply" | "ack-echo" | "ignore";

export function isEchoOfPersistedDeck(input: {
  readonly incoming: string;
  readonly current: string | undefined;
  readonly persisted: string | undefined;
}): boolean {
  return input.incoming === input.current;
}

export function shouldApplyRemoteSlideDeck(input: {
  readonly dirty: boolean;
  readonly incoming: string;
  readonly current: string | undefined;
  readonly persisted: string | undefined;
}): RemoteSlideDeckDecision {
  if (input.incoming === input.current) {
    return input.dirty ? "ack-echo" : "ignore";
  }
  if (input.dirty) return "ignore";
  return "apply";
}

export function resolveSlideDeckPersistPath(
  sourcePath: string | null | undefined,
  markdown: string,
): string {
  if (sourcePath) {
    const normalized = sourcePath.replaceAll("\\", "/");
    if (isSlideDeckPath(normalized) && /\.(md|html|htm)$/i.test(normalized)) {
      return normalized.replace(/^\.\//, "");
    }
  }
  return suggestSlideDeckPath(markdown);
}
