import type { TurnId } from "@modesto/contracts";

export function resolveStableMessageTurnId(input: {
  readonly existingTurnId?: TurnId | null | undefined;
  readonly incomingTurnId?: TurnId | null | undefined;
}): TurnId | null {
  return input.existingTurnId ?? input.incomingTurnId ?? null;
}
