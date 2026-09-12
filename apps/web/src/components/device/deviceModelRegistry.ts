// FILE: deviceModelRegistry.ts
// Purpose: Which real handset model backs each chassis kind, and how to read it.
// Layer: Device pane 3D asset contract
// Exports: DEVICE_MODELS, deviceModelFor, DEVICE_MODEL_DIR, type DeviceModelContract
// Depends on: deviceChassis for the kind enum.
//
// A glTF from a marketplace is an opaque node tree: nobody agrees on units, up
// axis, or what the display mesh is called. Rather than teach the loader to
// guess, each model gets an entry here saying which node is the screen and
// which nodes are the buttons, and the loader normalizes everything else
// (centering, scale, orientation) from the bounding box. `bun run
// devices:inspect <file.glb>` prints the node tree an entry needs.
//
// Every entry is optional. A kind with no model — or a model that fails to
// load, or a build that never shipped the file — falls back to the procedural
// chassis in `deviceChassis.ts`, which is why the pane still works on a fresh
// checkout. Missing assets degrade fidelity, never function.
//
// LICENSING. These are third-party depictions of trademarked industrial
// design. A Creative Commons licence on the mesh is the uploader's grant over
// their own work; it says nothing about Apple's, Google's, or Samsung's rights
// in the product's appearance. Anything added here must record its licence and
// be listed in THIRD_PARTY_NOTICES.md.

import type { DeviceKind } from "./deviceChassis";

/** Where GLB files live, relative to the web app's public root. */
export const DEVICE_MODEL_DIR = "/devices";

export type DeviceModelCredit = {
  readonly title: string;
  readonly author: string;
  /** SPDX-style identifier: "CC-BY-4.0", "CC0-1.0". */
  readonly license: string;
  readonly sourceUrl: string;
};

export type DeviceModelContract = {
  /** Filename inside `DEVICE_MODEL_DIR`. */
  readonly file: string;
  readonly credit: DeviceModelCredit;
  /**
   * The mesh carrying the display. Its bounding box — not its UVs — defines
   * where the live video quad goes: marketplace screen meshes are UV-mapped to
   * whatever wallpaper the author baked in, and reusing those coordinates puts
   * the guest's pixels somewhere arbitrary. The mesh itself is hidden.
   */
  readonly screenNode: string;
  /**
   * Pressable hardware, keyed by the same names `NUB_ACTIONS` uses. A model
   * that merges its buttons into the body omits these and gets no 3D press
   * targets — the flat frame's controls still work.
   */
  readonly buttonNodes?: Readonly<Partial<Record<string, string>>>;
  /**
   * Euler XYZ in radians, applied before fitting. For models authored Z-up, or
   * lying face-down, or facing away from the camera.
   */
  readonly rotation?: readonly [number, number, number];
  /**
   * Nodes to drop entirely — baked-in screen content, a stand, a shadow plane,
   * a duplicate LOD. Matched by exact name.
   */
  readonly hideNodes?: readonly string[];
};

/**
 * Empty by design.
 *
 * The models this pane wants are 2026 flagships, and every CC-licensed copy
 * found so far lives on Sketchfab, whose Download API requires an authenticated
 * account per its own guidelines — so the files cannot be fetched unattended
 * and are not committed here. Drop a licensed GLB into `apps/web/public/devices/`,
 * run `bun run devices:inspect` on it, and add the entry it prints.
 */
export const DEVICE_MODELS: Partial<Record<DeviceKind, DeviceModelContract>> = {};

export function deviceModelFor(kind: DeviceKind): DeviceModelContract | null {
  return DEVICE_MODELS[kind] ?? null;
}

/** Full URL for a model, for the loader and for preloading. */
export function deviceModelUrl(contract: DeviceModelContract): string {
  return `${DEVICE_MODEL_DIR}/${contract.file}`;
}
