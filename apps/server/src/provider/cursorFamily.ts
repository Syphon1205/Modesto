// FILE: cursorFamily.ts
// Purpose: The one place that describes a "cursor-family" CLI provider —
//          an agent whose CLI speaks the same ACP dialect `cursor-agent acp`
//          does, so it can be driven by exactly the same adapter, ACP
//          runtime, and provider probe with nothing changing but the binary
//          name, the auth handshake, and the user-facing strings.
//
//          Cursor, Kimi Code, Qwen Code and Poolside are all such agents.
//          The primary Modesto tree reached the same conclusion from the
//          other direction: its KimiAdapter/QwenAdapter/PoolsideAdapter are
//          each a thin delegate over `makeCursorAdapter` that only re-stamps
//          the provider name on the way out. Rather than port three ~200-line
//          re-stamping shims (plus, in this tree's shape, three ~1,200-line
//          adapter clones), the adapter itself takes a descriptor from here
//          and stamps the right driver kind natively.
//
//          What a descriptor deliberately does NOT carry: model catalogs.
//          None of these CLIs publish a stable static model list, so models
//          are discovered from the live ACP session's model state (see
//          CursorFamilyProvider.ts) and merged with the instance's
//          `customModels` setting.
// @module provider/cursorFamily
import { existsSync } from "node:fs";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";

import { ProviderDriverKind } from "@modesto/contracts";

/**
 * The settings surface the shared cursor-family machinery reads. Every
 * member's own settings schema is a superset of this: `CursorSettings` adds
 * `apiEndpoint`, the others add nothing at all.
 */
export interface CursorFamilySettings {
  readonly enabled: boolean;
  readonly binaryPath: string;
  readonly apiEndpoint?: string | undefined;
  readonly customModels?: ReadonlyArray<string> | undefined;
}

export interface CursorFamilyDescriptor {
  readonly driverKind: ProviderDriverKind;
  /** Name shown in Settings, the model picker, and probe messages. */
  readonly displayName: string;
  /** Longer name used in probe prose (e.g. "Kimi Code CLI"). */
  readonly cliDisplayName: string;
  /** Binary invoked when the instance has no `binaryPath` configured. */
  readonly defaultBinary: string;
  /**
   * ACP `authMethods` id sent after `initialize`. `null` skips the
   * authenticate step entirely — the CLI is expected to already hold its own
   * login state on disk (this is what the primary tree does for Kimi, Qwen
   * and Poolside, which all authenticate through their own CLI, not through
   * Modesto).
   */
  readonly authMethodId: string | null;
  /** Whether `-e <endpoint>` is a supported spawn flag (Cursor only). */
  readonly supportsApiEndpoint: boolean;
  /** Optional early-access marker rendered next to the instance title. */
  readonly badgeLabel?: string;
  /** Appended to the "installed" probe message: how the user logs in. */
  readonly authHint?: string;
  /**
   * Extra install locations to probe when the configured binary is a bare
   * name. Mirrors the primary tree's `resolveInstalledCliExecutable`, which
   * learned these the hard way — these CLIs install outside PATH more often
   * than not.
   */
  readonly extraBinaryDirectories?: ReadonlyArray<string>;
}

const VENDOR_BIN_DIRECTORIES = [".local/bin", ".bun/bin", ".npm-global/bin"] as const;

export const CURSOR_FAMILY_DESCRIPTOR: CursorFamilyDescriptor = {
  driverKind: ProviderDriverKind.make("cursor"),
  displayName: "Cursor",
  cliDisplayName: "Cursor agent",
  defaultBinary: "cursor-agent",
  authMethodId: "cursor_login",
  supportsApiEndpoint: true,
};

export const KIMI_FAMILY_DESCRIPTOR: CursorFamilyDescriptor = {
  driverKind: ProviderDriverKind.make("kimi"),
  displayName: "Kimi",
  cliDisplayName: "Kimi Code CLI",
  defaultBinary: "kimi",
  authMethodId: null,
  supportsApiEndpoint: false,
  badgeLabel: "Early Access",
  authHint: "Run `kimi` and use `/login` to authenticate before starting turns.",
  extraBinaryDirectories: [...VENDOR_BIN_DIRECTORIES, ".kimi/bin"],
};

export const QWEN_FAMILY_DESCRIPTOR: CursorFamilyDescriptor = {
  driverKind: ProviderDriverKind.make("qwen"),
  displayName: "Qwen",
  cliDisplayName: "Qwen Code CLI",
  defaultBinary: "qwen",
  authMethodId: null,
  supportsApiEndpoint: false,
  badgeLabel: "Early Access",
  authHint: "Run `qwen` and use `/auth` to authenticate before starting turns.",
  extraBinaryDirectories: [...VENDOR_BIN_DIRECTORIES, ".qwen/bin"],
};

export const POOLSIDE_FAMILY_DESCRIPTOR: CursorFamilyDescriptor = {
  driverKind: ProviderDriverKind.make("poolside"),
  displayName: "Poolside",
  cliDisplayName: "Poolside Agent CLI",
  defaultBinary: "pool",
  authMethodId: null,
  supportsApiEndpoint: false,
  badgeLabel: "Early Access",
  authHint:
    "Modesto uses its existing setup and login; models come from the connected deployment over ACP.",
  extraBinaryDirectories: [...VENDOR_BIN_DIRECTORIES, ".poolside/bin"],
};

/**
 * Resolve the executable to spawn for a cursor-family instance.
 *
 * An explicit path (anything containing a separator) is honored verbatim. A
 * bare name is looked up on PATH first, then in the descriptor's extra
 * install directories, and finally returned as-is so the spawn failure — and
 * therefore the probe's "not installed" message — stays truthful rather than
 * being masked by a wrong absolute path.
 */
export function resolveCursorFamilyBinaryPath(
  descriptor: CursorFamilyDescriptor,
  binaryPath: string | null | undefined,
): string {
  const configured = binaryPath?.trim();
  if (configured && (configured.includes("/") || configured.includes("\\"))) {
    return configured;
  }
  const name = configured || descriptor.defaultBinary;

  for (const directory of (process.env.PATH ?? "").split(nodePath.delimiter)) {
    if (!directory.trim()) continue;
    const candidate = nodePath.join(directory, name);
    if (safeExists(candidate)) {
      return candidate;
    }
  }

  if (process.platform !== "win32") {
    const home = nodeOs.homedir();
    for (const directory of descriptor.extraBinaryDirectories ?? []) {
      const candidate = nodePath.join(home, ...directory.split("/"), name);
      if (safeExists(candidate)) {
        return candidate;
      }
    }
    for (const candidate of [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`]) {
      if (safeExists(candidate)) {
        return candidate;
      }
    }
  }

  return name;
}

function safeExists(candidate: string): boolean {
  try {
    return existsSync(candidate);
  } catch {
    // A probe failure (permissions, a broken mount) is not evidence the
    // binary is there; keep searching.
    return false;
  }
}
