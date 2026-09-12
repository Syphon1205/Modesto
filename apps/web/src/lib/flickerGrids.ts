// Dot-grid frame data for Modesto's loading/working indicators, rendered at runtime
// via the `flicker-dot` package (https://flicker.laurie.fyi). Each preset is a flat
// 49-boolean (7x7) frame sequence, transcribed from the Flicker spinner editor's
// exported `grids` array. `FlickerLoadingIcon` derives the inner 5x5 "safe area"
// automatically for small render sizes, so a single 49-length source works for both.
//
// Add new presets here (never inline a `grids` literal at a call site) so every
// spinner in the app draws from the same curated set.

function frame(onIndices: readonly number[]): boolean[] {
  return Array.from({ length: 49 }, (_, i) => onIndices.includes(i));
}

/**
 * "Tiny spinner" — a compact 4-dot cluster that rotates through a corner, tuned by
 * its author for small icon sizes. Used for Modesto's inline/small loading spinners.
 */
export const TINY_SPINNER_GRIDS: boolean[][] = [
  frame([16, 17, 23, 30]),
  frame([16, 17, 18, 23]),
  frame([16, 17, 18, 25]),
  frame([17, 18, 25, 32]),
  frame([18, 25, 31, 32]),
  frame([25, 30, 31, 32]),
  frame([23, 30, 31, 32]),
  frame([16, 23, 30, 31]),
];

/**
 * "Choo Choo" ("Agent at work", from Conductor) — a dot trail that builds up and
 * sweeps diagonally across the grid before resetting. Used for the primary
 * "the agent is thinking" indicator in the chat transcript.
 */
export const CHOO_CHOO_GRIDS: boolean[][] = [
  frame([16]),
  frame([16, 17, 23]),
  frame([16, 17, 18, 23, 24, 30]),
  frame([16, 17, 18, 23, 24, 25, 30, 31, 32]),
  frame([18, 24, 25, 30, 31, 32]),
  frame([25, 31, 32]),
  frame([32]),
  frame([]),
];

/**
 * "Comet" — a dense diagonal trail that sweeps corner-to-corner. Used for
 * task-list / checklist "in progress" indicators.
 */
export const COMET_GRIDS: boolean[][] = [
  frame([]),
  frame([37, 44, 45]),
  frame([23, 29, 30, 36, 37, 38, 43, 44, 45, 46]),
  frame([16, 22, 23, 28, 29, 30, 35, 36, 37, 38, 42, 43, 44, 45, 46, 47]),
  frame([9, 15, 16, 17, 21, 22, 23, 28, 29, 30, 35, 36, 37, 38, 42, 43, 44, 45, 46, 47]),
  frame([9, 10, 15, 16, 17, 18, 21, 22, 23, 28, 29, 30, 35, 36, 37, 38, 43, 44, 45, 46]),
  frame([9, 10, 15, 16, 17, 18, 21, 22, 23, 28, 29, 30, 35, 36, 37, 43, 44, 45]),
  frame([9, 10, 15, 16, 17, 18, 21, 22, 23, 28, 29, 30, 37]),
  frame([9, 10, 15, 16, 17, 18, 21, 22, 23, 30]),
  frame([9, 10, 15, 16, 17, 18, 23]),
  frame([9, 10, 16, 17, 18]),
  frame([10, 17, 18]),
  frame([18]),
];

/**
 * "Syncing" (inspired by Adrien Griveau's mini loaders) — a short comet trail
 * that sweeps and reverses. Used for the "Working for …" transcript status line.
 */
export const SYNCING_GRIDS: boolean[][] = [
  frame([2, 3, 4, 10]),
  frame([3, 9, 10, 11, 17]),
  frame([3, 10, 16, 17, 18, 24]),
  frame([10, 17, 23, 24, 25, 31]),
  frame([17, 24, 30, 31, 32, 38]),
  frame([24, 31, 37, 38, 39, 45]),
  frame([31, 38, 44, 45, 46]),
  frame([38, 45]),
  frame([]),
  frame([38, 44, 45, 46]),
  frame([31, 37, 38, 39, 45]),
  frame([24, 30, 31, 32, 38, 45]),
  frame([17, 23, 24, 25, 31, 38]),
  frame([10, 16, 17, 18, 24, 31]),
  frame([3, 9, 10, 11, 17, 24]),
  frame([2, 3, 4, 10, 17]),
  frame([3, 10]),
  frame([]),
];

/**
 * "Searching" (inspired by Adrien Griveau's mini loaders) — a dot sweeps
 * diagonally and settles into a magnifying-glass shape. Used for lookup/fetch
 * style loading spinners (e.g. resolving a pull request).
 */
export const SEARCHING_GRIDS: boolean[][] = [
  frame([9, 15, 16, 17, 23]),
  frame([10, 16, 17, 18, 24]),
  frame([11, 17, 18, 19, 25]),
  frame([18, 24, 25, 26, 32]),
  frame([25, 31, 32, 33, 39]),
  frame([24, 30, 31, 32, 38]),
  frame([23, 29, 30, 31, 37]),
  frame([8, 9, 10, 15, 17, 22, 23, 24]),
  frame([8, 9, 10, 15, 17, 22, 23, 24]),
  frame([8, 9, 10, 15, 17, 22, 23, 24]),
];

/**
 * "Busy" (inspired by Adrien Griveau's mini loaders) — a scattered cluster of
 * dots that flickers in place. Used for the composer "N Working" pill.
 */
export const BUSY_GRIDS: boolean[][] = [
  frame([15, 19, 22, 23, 26, 29, 33]),
  frame([15, 19, 22, 26, 29, 31, 33]),
  frame([15, 22, 26, 29, 33, 39, 40]),
  frame([15, 22, 26, 29, 31, 33, 40]),
  frame([8, 15, 22, 23, 26, 33, 40]),
  frame([8, 15, 17, 19, 22, 26, 33]),
  frame([8, 11, 12, 15, 19, 22, 26]),
  frame([12, 15, 17, 19, 22, 26, 29]),
  frame([15, 19, 22, 23, 26, 29, 33]),
  frame([15, 22, 26, 29, 31, 33, 40]),
  frame([15, 22, 26, 29, 33, 39, 40]),
  frame([15, 22, 26, 29, 31, 33, 40]),
  frame([8, 15, 22, 23, 26, 33, 40]),
  frame([8, 15, 17, 19, 22, 26, 33]),
  frame([8, 11, 12, 15, 19, 22, 26]),
  frame([12, 15, 17, 19, 22, 26, 29]),
];

/**
 * "Initialising" (inspired by Adrien Griveau's mini loaders) — bars build up
 * left to right, then clear. Used for "kicking off work" indicators.
 */
export const INITIALISING_GRIDS: boolean[][] = [
  frame([]),
  frame([9, 11]),
  frame([9, 11, 15, 16, 17, 18, 19]),
  frame([9, 11, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26]),
  frame([9, 11, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 30, 31, 32]),
  frame([9, 11, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 30, 31, 32, 38]),
  frame([17, 23, 24, 25, 31]),
  frame([24]),
  frame([]),
];
