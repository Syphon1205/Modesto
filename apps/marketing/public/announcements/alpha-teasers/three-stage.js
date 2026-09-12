/**
 * Minimal WebGL scaffold for the 3D export films.
 *
 * Scope note: this is used by the social/export films only (ig-*.html), which
 * are captured to MP4 once and then viewed as video. The in-page billboard
 * films are deliberately CSS-only so the live /teasers page stays cheap.
 *
 * Determinism: nothing here runs its own rAF. Films draw only when the GSAP
 * timeline ticks, so __setTime(t) always yields the same frame — which is what
 * makes headless Playwright capture reproducible.
 */
import * as THREE from "three";
import { RoomEnvironment } from "../modesto-saas-assets/vendor/RoomEnvironment.js";

export { THREE };

/** Brand palette, mirrored from tokens.css. Exactly one signal colour (lime). */
export const BRAND = {
  ink: 0x10120f,
  ink2: 0x171a14,
  fg: 0xeceee6,
  lime: 0xd5f995,
  limeDim: 0xbbd996,
  muted: 0x8b9681,
  dim: 0x6d7864,
};

export function createStage(canvas, options = {}) {
  const { fov = 32, background = BRAND.ink, exposure = 1.1 } = options;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    // Required: frames are captured out-of-band (?paused=1&t=N). Without a
    // preserved buffer a paused film composites empty.
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  // Image-based lighting. RoomEnvironment is what makes the metal read as
  // metal rather than as a grey plastic approximation of it.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  // Films render on demand, so a resize must redraw: setSize() clears the
  // drawing buffer, and a paused film (a still capture at ?paused=1&t=N) would
  // otherwise be left black with nothing scheduled to draw it again.
  let redraw = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (redraw) redraw();
  }
  resize();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(canvas);
  else addEventListener("resize", resize);

  return {
    THREE,
    renderer,
    scene,
    camera,
    resize,
    /** Register the film's draw-at-last-time function so resizes can redraw. */
    onResize(fn) {
      redraw = fn;
    },
    render: () => renderer.render(scene, camera),
  };
}

/** Easing helpers, so scene motion can be derived from absolute timeline time. */
export const ease = {
  clamp: (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v)),
  span: (t, a, b) => ease.clamp((t - a) / (b - a)),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
};

/**
 * The Handoff Mark, built as real geometry.
 *
 * The logo is four round-capped polylines on a 100x100 grid (see
 * public/modesto-logo.svg). Each becomes a tube swept along the same path, with
 * spheres at the ends to reproduce the SVG's round caps. Coordinates are
 * translated from SVG space (y down, origin top-left) to world space (y up,
 * origin centred) so the 3D mark is dimensionally identical to the 2D one.
 */
const STROKE_W = 9.5;
const MARK_PATHS = [
  [
    ["M", 18, 32],
    ["L", 39, 32],
    ["C", 42, 32, 43.5, 30.5, 45, 28],
    ["L", 55, 12],
  ],
  [
    ["M", 66, 20],
    ["L", 60, 32],
    ["C", 58, 36, 59, 39, 62, 42],
    ["L", 81, 58],
  ],
  [
    ["M", 14, 45],
    ["L", 35, 51],
    ["C", 39, 52, 41, 55, 41, 59],
    ["L", 41, 80],
  ],
  [
    ["M", 57, 58],
    ["L", 70, 70],
  ],
];

export function buildHandoffMark(material, { scale = 0.05 } = {}) {
  const group = new THREE.Group();
  const radius = (STROKE_W / 2) * scale;
  // SVG -> world: centre on the 100x100 box and flip the y axis.
  const V = (x, y) => new THREE.Vector3((x - 50) * scale, -(y - 50) * scale, 0);

  for (const path of MARK_PATHS) {
    const curve = new THREE.CurvePath();
    let cursor = null;
    const ends = [];
    for (const seg of path) {
      const [kind] = seg;
      if (kind === "M") {
        cursor = V(seg[1], seg[2]);
        ends.push(cursor.clone());
      } else if (kind === "L") {
        const next = V(seg[1], seg[2]);
        curve.add(new THREE.LineCurve3(cursor, next));
        cursor = next;
      } else if (kind === "C") {
        const c1 = V(seg[1], seg[2]);
        const c2 = V(seg[3], seg[4]);
        const next = V(seg[5], seg[6]);
        curve.add(new THREE.CubicBezierCurve3(cursor, c1, c2, next));
        cursor = next;
      }
    }
    ends.push(cursor.clone());

    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 16, false), material);
    group.add(tube);

    // Round caps, matching stroke-linecap="round".
    for (const end of [ends[0], ends[ends.length - 1]]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material);
      cap.position.copy(end);
      group.add(cap);
    }
  }
  return group;
}
