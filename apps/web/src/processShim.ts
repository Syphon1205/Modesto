// FILE: processShim.ts
// Purpose: Provide a minimal `process.env` for the Electron renderer before app code runs.
// Layer: Web bootstrap (must stay side-effect only; imported first from bootstrap.ts)

const PROCESS_KEY = "process";

type ProcessEnvShim = {
  env: Record<string, string | undefined>;
};

function readProcessShim(): ProcessEnvShim | undefined {
  const value = (globalThis as Record<string, unknown>)[PROCESS_KEY];
  if (value == null || typeof value !== "object") {
    return undefined;
  }
  return value as ProcessEnvShim;
}

function writeProcessShim(next: ProcessEnvShim): void {
  (globalThis as Record<string, unknown>)[PROCESS_KEY] = next;
}

const existing = readProcessShim();
if (existing == null) {
  writeProcessShim({ env: {} });
} else if (existing.env == null) {
  existing.env = {};
}
