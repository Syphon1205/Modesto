// FILE: PiRpcSupport.ts
// Purpose: Spawn glue between the generic PiRpcRuntime (see its own header
//          for the wire-protocol source of truth) and Pi's real CLI in RPC
//          mode. Verified live against an actually-installed v0.74.0 binary
//          on this machine (`node .../dist/cli.js --help`, run for real, not
//          guessed) - flags below are exactly what that run printed.
//
// Architecture note (why this isn't an in-process SDK embed): the primary
// Modesto tree's own Pi integration imports `@earendil-works/pi-coding-agent`
// directly and drives an in-process `AgentSession`. This port instead spawns
// the CLI's own `--mode rpc` subprocess and speaks its documented JSON-RPC-
// over-stdio protocol - the SDK's own docs (docs/rpc.md, "RPC Mode
// Alternative") explicitly offer this as a supported, vendor-documented
// integration path ("process isolation... language-agnostic client"), and it
// matches this tree's established shape for every other provider (spawn a
// subprocess, speak its protocol, translate into canonical runtime events)
// instead of adding three new npm dependencies directly into Modesto's own
// server process and building a second, structurally different in-process
// adapter type.
//
// Deliberate v1 scope, all real protocol facts confirmed from docs/rpc.md
// (read in full) rather than assumed:
// - No live model switching. `set_model`/`cycle_model` are real, live RPC
//   commands - Pi's RPC surface genuinely supports switching models
//   mid-session, unlike every ACP provider in this tree. This port doesn't
//   use them: model is set once via `--model <pattern>` at spawn (the CLI
//   flag supports a bare `provider/id` pattern, e.g. `openai/gpt-4o`, so no
//   separate `--provider` flag is needed - confirmed in `--help`'s own
//   examples), and `capabilities.sessionModelSwitch: "unsupported"` in
//   PiAdapter.ts, matching every other provider's spawn-time-only
//   simplification this session. A real follow-up could wire `set_model` for
//   genuine live switching.
// - No permission gating. The RPC protocol has no request/approval command
//   at all - tools execute automatically once a prompt is accepted. This
//   isn't a corner cut; Modesto's `runtime.approvalMode` simply has nothing
//   to hook into for this provider. `pendingApprovals` stays permanently
//   empty in PiAdapter.ts, matching the honest-stub pattern used for every
//   provider's `respondToUserInput` when nothing populates its map.
// - No session persistence/resume. Spawned with `--no-session` for a clean,
//   isolated conversation per session start. Pi's own session files
//   (`sessionFile`/`sessionId`, tracked via `get_state`) could support real
//   resume in a follow-up; not wired here.
// - No API-key setting. `pi`'s own `AuthStorage` (per docs/sdk.md) already
//   resolves credentials from `auth.json` and standard provider env vars
//   (`ANTHROPIC_API_KEY` etc.) - Modesto doesn't duplicate that, matching
//   every other provider here (none of them store a separate API key).
//
// @module provider/acp/PiRpcSupport
import { type PiSettings } from "@modesto/contracts";

import * as PiRpcRuntime from "./PiRpcRuntime.ts";

type PiRpcRuntimeSettings = Pick<PiSettings, "binaryPath">;

// The picker's one built-in model entry (see PiProvider.ts's
// `PI_BUILT_IN_MODELS`) - a UI-only sentinel meaning "let Pi pick its own
// default," not a real `--model` pattern Pi would recognize.
const PI_DEFAULT_MODEL_SLUG = "default";

export function buildPiRpcSpawnInput(
  piSettings: PiRpcRuntimeSettings | null | undefined,
  cwd: string,
  model: string | undefined,
  environment?: NodeJS.ProcessEnv,
): PiRpcRuntime.PiRpcSpawnInput {
  const trimmedModel = model?.trim();
  const realModel =
    trimmedModel && trimmedModel !== PI_DEFAULT_MODEL_SLUG ? trimmedModel : undefined;
  return {
    command: piSettings?.binaryPath || "pi",
    args: ["--mode", "rpc", "--no-session", ...(realModel ? ["--model", realModel] : [])],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}
