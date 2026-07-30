// FILE: processShim.ts
// Purpose: Provide a minimal `process.env` for the Electron renderer before app code runs.
// Layer: Web bootstrap (must stay side-effect only; imported first from bootstrap.ts)

const processShim = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

if (typeof processShim.process === "undefined") {
  processShim.process = { env: {} };
} else if (typeof processShim.process.env === "undefined") {
  processShim.process.env = {};
}
