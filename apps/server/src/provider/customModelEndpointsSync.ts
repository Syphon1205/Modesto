/**
 * customModelEndpointsSync - Synchronous, file-direct read of configured custom
 * model endpoints for the codexProcessEnv.ts call sites that build subprocess env
 * outside the Effect runtime (health probes, CLI version checks, session spawn).
 *
 * ServerSettingsService and ServerSecretStore are themselves just files on disk
 * (settings.json, secrets/*.bin, written via ServerSettingsService.updateSettings /
 * ServerSecretStore.set) — reading them directly here avoids threading Effect
 * service access through every one of those call sites for a single, low-frequency,
 * read-only lookup, matching how this module already reads `~/.codex/config.toml`
 * and `~/.codex/auth.json` directly rather than through a service.
 *
 * @module customModelEndpointsSync
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { customModelEndpointEnvVar, customModelEndpointSecretName } from "./customModelEndpoints";

export interface ResolvedCustomModelEndpoint {
  readonly id: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly wireApi: "chat" | "responses";
  readonly envVar: string;
  readonly apiKey: string | null;
}

// Mirrors ServerSecretStore's own file naming (apps/server/src/auth/Layers/ServerSecretStore.ts).
function secretFileName(name: string): string {
  return `${name.replace(/[^a-zA-Z0-9_.-]/g, "_")}.bin`;
}

export function resolveCustomModelEndpointsSync(input: {
  readonly settingsPath: string;
  readonly secretsDir: string;
}): ReadonlyArray<ResolvedCustomModelEndpoint> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(input.settingsPath, "utf8"));
  } catch {
    return [];
  }
  const endpoints = (raw as { customModelEndpoints?: unknown } | null)?.customModelEndpoints;
  if (!Array.isArray(endpoints)) {
    return [];
  }

  return endpoints.flatMap((entry): ResolvedCustomModelEndpoint[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : undefined;
    const label = typeof record.label === "string" ? record.label : undefined;
    const baseUrl = typeof record.baseUrl === "string" ? record.baseUrl : undefined;
    if (!id || !label || !baseUrl) {
      return [];
    }
    const wireApi = record.wireApi === "responses" ? "responses" : "chat";

    const secretPath = path.join(
      input.secretsDir,
      secretFileName(customModelEndpointSecretName(id)),
    );
    let apiKey: string | null = null;
    try {
      apiKey = readFileSync(secretPath, "utf8");
    } catch {
      apiKey = null;
    }

    return [{ id, label, baseUrl, wireApi, envVar: customModelEndpointEnvVar(id), apiKey }];
  });
}
