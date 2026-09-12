import * as nodeOs from "node:os";
import * as nodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  CURSOR_FAMILY_DESCRIPTOR,
  KIMI_FAMILY_DESCRIPTOR,
  POOLSIDE_FAMILY_DESCRIPTOR,
  QWEN_FAMILY_DESCRIPTOR,
  resolveCursorFamilyBinaryPath,
} from "./cursorFamily.ts";

describe("cursor family descriptors", () => {
  it("keeps each member's binary, auth handshake and endpoint support distinct", () => {
    expect(CURSOR_FAMILY_DESCRIPTOR).toMatchObject({
      driverKind: "cursor",
      defaultBinary: "cursor-agent",
      authMethodId: "cursor_login",
      supportsApiEndpoint: true,
    });
    // The three ported CLIs authenticate through their own CLI, so Modesto
    // must skip ACP `authenticate` (authMethodId === null) for them.
    expect(KIMI_FAMILY_DESCRIPTOR).toMatchObject({
      driverKind: "kimi",
      defaultBinary: "kimi",
      authMethodId: null,
      supportsApiEndpoint: false,
    });
    expect(QWEN_FAMILY_DESCRIPTOR).toMatchObject({
      driverKind: "qwen",
      defaultBinary: "qwen",
      authMethodId: null,
      supportsApiEndpoint: false,
    });
    expect(POOLSIDE_FAMILY_DESCRIPTOR).toMatchObject({
      driverKind: "poolside",
      defaultBinary: "pool",
      authMethodId: null,
      supportsApiEndpoint: false,
    });
  });
});

describe("resolveCursorFamilyBinaryPath", () => {
  it("honors an explicit path verbatim", () => {
    expect(resolveCursorFamilyBinaryPath(KIMI_FAMILY_DESCRIPTOR, "/opt/kimi/bin/kimi")).toBe(
      "/opt/kimi/bin/kimi",
    );
  });

  it("falls back to the descriptor's default binary name when nothing is found", () => {
    const previousPath = process.env.PATH;
    process.env.PATH = nodePath.join(nodeOs.tmpdir(), "modesto-nonexistent-bin-dir");
    try {
      expect(resolveCursorFamilyBinaryPath(QWEN_FAMILY_DESCRIPTOR, undefined)).toBe("qwen");
      expect(resolveCursorFamilyBinaryPath(POOLSIDE_FAMILY_DESCRIPTOR, "   ")).toBe("pool");
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it("keeps a bare configured name rather than substituting the default", () => {
    const previousPath = process.env.PATH;
    process.env.PATH = nodePath.join(nodeOs.tmpdir(), "modesto-nonexistent-bin-dir");
    try {
      expect(resolveCursorFamilyBinaryPath(KIMI_FAMILY_DESCRIPTOR, "kimi-nightly")).toBe(
        "kimi-nightly",
      );
    } finally {
      process.env.PATH = previousPath;
    }
  });
});
