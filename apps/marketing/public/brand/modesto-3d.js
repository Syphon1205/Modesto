/**
 * Modesto brand 3D — the site-side port of the brand film's WebGL look.
 *
 * The film (`/announcements/modesto-saas-3d.js`) drives its scene from a fixed
 * timeline because it renders to video. The site needs the same *look* but a
 * different driver: pointer parallax and an idle float that never ends. So the
 * materials, light rig and card construction below are deliberately identical
 * to the film's, while the animation is interactive.
 *
 * Budget rules (performance is a core project priority):
 *   - one renderer per host, created lazily and only when the host is on screen
 *   - the RAF loop stops when the host scrolls out of view or the tab is hidden
 *   - skipped entirely for reduced-motion and for WebGL-less clients, which
 *     keep the CSS artwork underneath as the fallback
 */
import * as THREE from "/announcements/modesto-saas-assets/vendor/three.module.min.js";
import { RoomEnvironment } from "/brand/RoomEnvironment.js";

/*
 * The provider marks are extracted straight from the app's own icon set
 * (apps/web/src/components/Icons.tsx) so the site and the product show
 * identical logos. They already carry their real brand colours, resolved to
 * the app's dark-mode variants.
 */
const MARK_BASE = "/brand/marks";

export function prefersReducedMotion() {
  return (
    document.documentElement.dataset.reduced === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function roundedShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

async function loadImage(src) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();
  return image;
}

/**
 * Draws a black-silhouette mark in an arbitrary colour.
 *
 * The obvious way to do this is `ctx.filter = "brightness(0) invert(1)"`, and
 * that is what every call site here used to do — but Canvas filters only
 * landed in Safari 16.4, and when unsupported the property silently no-ops.
 * The result is the mark drawn in its own colour: black glyphs on a dark tile,
 * i.e. tiles that look completely empty.
 *
 * Compositing works everywhere: stamp the mark onto a scratch canvas, then
 * `source-in` a flat fill through its alpha.
 */
function tintedMark(mark, size, color, alpha = 1) {
  const scratch = document.createElement("canvas");
  scratch.width = size;
  scratch.height = size;
  const sctx = scratch.getContext("2d");
  sctx.drawImage(mark, 0, 0, size, size);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, size, size);
  if (alpha !== 1) {
    const out = document.createElement("canvas");
    out.width = size;
    out.height = size;
    const octx = out.getContext("2d");
    octx.globalAlpha = alpha;
    octx.drawImage(scratch, 0, 0);
    return out;
  }
  return scratch;
}

/**
 * Shared stage: renderer, camera, the film's four-light rig, and a RAF loop
 * that only runs while visible. Returns a small handle the scene builders use.
 */
function createStage(host, { fov = 36, distance = 9, ortho = false, worldPerPixel = 0.01 } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  host.append(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();

  const scene = new THREE.Scene();
  scene.environment = environment.texture;

  const camera = ortho
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80)
    : new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, distance);

  // The film's exact rig — a warm hemisphere base, a bright key, and the lime
  // rim that gives every chrome edge its green kick.
  scene.add(new THREE.HemisphereLight(0xf5ffe6, 0x465038, 0.8));
  const key = new THREE.DirectionalLight(0xf5ffdd, 2);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd5f995, 3);
  rim.position.set(5, 1, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(2, -3, 4);
  scene.add(fill);

  const owned = new Set([environment.texture]);
  const own = (resource) => {
    owned.add(resource);
    return resource;
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointerMove = (event) => {
    const rect = host.getBoundingClientRect();
    pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (camera.isOrthographicCamera) {
      camera.left = -(w * worldPerPixel) / 2;
      camera.right = (w * worldPerPixel) / 2;
      camera.top = (h * worldPerPixel) / 2;
      camera.bottom = -(h * worldPerPixel) / 2;
    } else {
      camera.aspect = w / h;
    }
    camera.updateProjectionMatrix();
  };
  let frame = 0;
  let visible = false;
  let update = null;
  const clock = new THREE.Clock();

  const tick = () => {
    frame = prefersReducedMotion() ? 0 : requestAnimationFrame(tick);
    // Ease the pointer so parallax glides instead of snapping.
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    try {
      update?.(clock.getElapsedTime(), pointer);
    } catch {
      /* A scene update must not kill the loop — the fallback art stays up. */
    }
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.render(scene, camera);
    // Only now is there something to show; revealing earlier would fade in an
    // empty canvas over the CSS fallback.
    if (host.dataset.ready !== "true") host.dataset.ready = "true";
  };

  const start = () => {
    if (frame || !visible || document.hidden) return;
    clock.start();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const observer = new ResizeObserver(() => {
    resize();
    const box = host.getBoundingClientRect();
    if (box.width && box.height && box.bottom > 0 && box.top < window.innerHeight) {
      visible = true;
      start();
    }
  });
  observer.observe(host);
  resize();

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) start();
      else stop();
    },
    { threshold: 0, rootMargin: "80px" },
  );
  io.observe(host);
  const syncVisibility = () => {
    const box = host.getBoundingClientRect();
    const on = Boolean(
      box.width && box.height && box.bottom > 0 && box.top < window.innerHeight + 80,
    );
    visible = on;
    if (on) start();
    else stop();
  };
  window.addEventListener("scroll", syncVisibility, { passive: true });
  syncVisibility();

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotion = () => {
    stop();
    start();
  };
  motionQuery.addEventListener("change", onMotion);
  const motionObserver = new MutationObserver(onMotion);
  motionObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-reduced"],
  });

  return {
    scene,
    camera,
    own,
    setUpdate(fn) {
      update = fn;
    },
    dispose() {
      stop();
      io.disconnect();
      observer.disconnect();
      window.removeEventListener("scroll", syncVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onMotion);
      motionObserver.disconnect();
      owned.forEach((resource) => resource.dispose?.());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** The film's outro sculpture, using its exact two knot geometries and finishes. */
export function mountFilmKnot(host) {
  if (!host) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const stage = createStage(host, { fov: 36, distance: 8.5 });
      if (!stage) {
        host.hidden = true;
        return;
      }
      const { own, scene } = stage;
      const mat = materials(own);
      const group = new THREE.Group();
      const knot = new THREE.Mesh(
        own(new THREE.TorusKnotGeometry(1.18, 0.32, 180, 24, 2, 3)),
        mat.chrome,
      );
      const inner = new THREE.Mesh(
        own(new THREE.TorusKnotGeometry(1.18, 0.1, 160, 12, 2, 3)),
        mat.lime,
      );
      inner.scale.setScalar(1.32);
      group.add(knot, inner);
      scene.add(group);
      stage.setUpdate((t, pointer) => {
        const time = prefersReducedMotion() ? 0 : t;
        group.rotation.set(
          0.3 + time * 0.06 + pointer.y * 0.08,
          0.5 + time * 0.18 + pointer.x * 0.12,
          -0.35,
        );
        group.position.y = Math.sin(time * 0.65) * 0.08;
        inner.rotation.y = time * -0.08;
      });
      window.addEventListener("pagehide", () => stage.dispose(), { once: true });
    },
    { rootMargin: "160px" },
  );
  observer.observe(host);
}

/**
 * Draws one agent card face to a canvas texture — the same three palettes,
 * type sizes and micro-labels the film uses, so a still from the site and a
 * still from the ad are the same artwork.
 */
function faceTexture(own, mark, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 960;
  const ctx = canvas.getContext("2d");
  const palettes = [
    ["#d4f5a0", "#a2be74", "#1b2a11"],
    ["#333b30", "#1b2119", "#f0f3e8"],
    ["#f0f0e6", "#bfc8b1", "#1d2917"],
  ];
  const [top, bottom, ink] = palettes[index];
  const gradient = ctx.createLinearGradient(0, 0, 768, 960);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, 768, 960, 55);
  ctx.fill();
  ctx.strokeStyle = index === 1 ? "#ffffff24" : "#ffffff70";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(10, 10, 748, 940, 48);
  ctx.stroke();
  // Card 1 is the dark case, so its mark goes light; the lime and paper cases
  // take the dark ink.
  ctx.drawImage(tintedMark(mark, 190, index === 1 ? "#f0f3e8" : "#12150f"), 68, 65);
  ctx.fillStyle = ink;
  ctx.font = "600 77px Manrope";
  ctx.fillText(["Codex", "Claude", "Cursor"][index], 68, 370);
  ctx.globalAlpha = 0.62;
  ctx.font = "500 23px Manrope";
  ctx.fillText(["READY TO BUILD", "READY TO THINK", "READY TO SHIP"][index], 72, 420);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(70, 810, 628, 1);
  ctx.font = "500 21px Manrope";
  ctx.fillText(`MODESTO / AGENT 0${index + 1}`, 72, 865);
  ctx.globalAlpha = 1;
  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function materials(own) {
  const make = (options) => own(new THREE.MeshPhysicalMaterial(options));
  return {
    chrome: make({ color: 0xdce2d2, metalness: 0.96, roughness: 0.19, clearcoat: 1 }),
    lime: make({
      color: 0xc7ed87,
      metalness: 0.38,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
    }),
    dark: make({ color: 0x242c20, metalness: 0.65, roughness: 0.26, clearcoat: 1 }),
  };
}

function bodyGeometry(own, width, height, depth, radius) {
  const geometry = own(
    new THREE.ExtrudeGeometry(roundedShape(width, height, radius), {
      depth,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.045,
      bevelThickness: 0.045,
      curveSegments: 12,
    }),
  );
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Hero: the three agent cards and their orbit, floating under the pointer. */
export async function mountAgentCards(host) {
  if (!host || prefersReducedMotion()) return null;
  const stage = createStage(host, { fov: 36, distance: 9 });
  if (!stage) return null;

  const { own, scene } = stage;
  const mat = materials(own);
  const cases = [mat.lime, mat.dark, mat.chrome];

  await document.fonts.ready;
  const marks = await Promise.all(
    ["codex", "claude", "cursor"].map((slug) => loadImage(`${MARK_BASE}/${slug}.svg`)),
  );

  const group = new THREE.Group();
  scene.add(group);

  /*
   * These are the film's own intro poses, verbatim (x, y, z, rotZ) plus its
   * per-card Y rotations. They matter more than they look: the cards sit in a
   * TIGHT overlapping cluster near the origin, which is what makes them read as
   * a deck of cards. Spreading them toward the frustum edges — as an earlier
   * pass did — drags each card into hard perspective, so they skew, foreshorten
   * and clip instead of reading as flat cards.
   */
  const poses = [
    { pos: [-0.55, 0.98, -0.42], rotZ: -0.23, rotY: -0.36 },
    { pos: [0.95, 0.05, 0.05], rotZ: 0.15, rotY: -0.4 },
    { pos: [-0.65, -0.92, 0.65], rotZ: -0.15, rotY: 0.33 },
  ];

  const cards = poses.map((pose, index) => {
    const card = new THREE.Group();
    card.add(new THREE.Mesh(bodyGeometry(own, 1.83, 2.3, 0.14, 0.16), cases[index]));

    const front = new THREE.Mesh(
      own(new THREE.PlaneGeometry(1.82, 2.29)),
      own(
        new THREE.MeshBasicMaterial({
          map: faceTexture(own, marks[index], index),
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    front.position.z = 0.12;
    card.add(front);

    // The inset rear panel reads as real thickness whenever the card turns.
    const rear = new THREE.Mesh(bodyGeometry(own, 1.55, 2.02, 0.025, 0.13), cases[index]);
    rear.position.z = -0.12;
    card.add(rear);

    card.position.set(...pose.pos);
    group.add(card);
    return card;
  });

  const orbit = new THREE.Mesh(own(new THREE.TorusGeometry(2.6, 0.012, 8, 100)), mat.chrome);
  orbit.rotation.set(0.8, 0.35, -0.4);
  orbit.position.z = -0.7;
  group.add(orbit);

  // Slightly oversize the cluster so it fills the hero column without pushing
  // any card out toward the distorting edge of the lens.
  group.scale.setScalar(1.12);

  stage.setUpdate((t, pointer) => {
    // The film's own idle sway, with pointer parallax layered on top at about
    // the same amplitude so neither dominates.
    group.rotation.y = Math.sin(t * 0.38) * 0.17 - 0.08 + pointer.x * 0.16;
    group.rotation.x = pointer.y * 0.1;

    cards.forEach((card, index) => {
      const { pos, rotZ, rotY } = poses[index];
      card.position.y = pos[1] + Math.sin(t * 0.8 + index * 1.5) * 0.08;
      card.rotation.set(
        0.1 + Math.sin(t * 0.45 + index) * 0.08,
        rotY + Math.sin(t * 0.5 + index) * 0.1,
        rotZ,
      );
    });

    orbit.rotation.z = -0.4 + t * 0.055;
  });

  return stage;
}

/**
 * Download page: a slow rotating shape study in the same three finishes.
 * No text, no product mock — it is the brand's material language on its own.
 */
export async function mountShapes(host) {
  if (!host || prefersReducedMotion()) return null;
  const stage = createStage(host, { fov: 34, distance: 10 });
  if (!stage) return null;

  const { own, scene } = stage;
  const mat = materials(own);
  const group = new THREE.Group();
  scene.add(group);

  const paint = () => {
    const light = isLightTheme();
    mat.chrome.color.setHex(light ? 0xc8c2b0 : 0xdce2d2);
    mat.lime.color.setHex(light ? 0x8fb84a : 0xc7ed87);
    mat.dark.color.setHex(light ? 0x3c4234 : 0x242c20);
  };
  paint();
  const themeWatcher = new MutationObserver(paint);
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const stageDispose = stage.dispose;
  stage.dispose = () => {
    themeWatcher.disconnect();
    stageDispose();
  };

  const pieces = [
    {
      mesh: new THREE.Mesh(bodyGeometry(own, 2.1, 2.6, 0.16, 0.2), mat.lime),
      pos: [-2.3, 0.35, 0],
      spin: [0.05, 0.16, 0],
      phase: 0,
    },
    {
      mesh: new THREE.Mesh(own(new THREE.IcosahedronGeometry(0.95, 0)), mat.chrome),
      pos: [1.95, 1.35, 0.7],
      spin: [0.22, 0.28, 0.1],
      phase: 1.4,
    },
    {
      mesh: new THREE.Mesh(own(new THREE.TorusGeometry(0.85, 0.26, 22, 96)), mat.dark),
      pos: [2.35, -1.2, -0.4],
      spin: [0.3, 0.14, 0],
      phase: 2.8,
    },
    {
      mesh: new THREE.Mesh(own(new THREE.CapsuleGeometry(0.34, 1.05, 8, 24)), mat.lime),
      pos: [0.15, -1.75, 1.1],
      spin: [0.12, 0.2, 0.24],
      phase: 4.2,
    },
    {
      mesh: new THREE.Mesh(own(new THREE.TorusKnotGeometry(0.52, 0.17, 128, 20)), mat.chrome),
      pos: [-0.35, 1.75, -0.6],
      spin: [0.18, 0.24, 0.08],
      phase: 5.6,
    },
  ];

  pieces.forEach((piece) => {
    piece.mesh.position.set(...piece.pos);
    group.add(piece.mesh);
  });

  const ring = new THREE.Mesh(own(new THREE.TorusGeometry(3.4, 0.01, 8, 140)), mat.chrome);
  ring.rotation.set(1.15, 0.2, 0);
  ring.position.z = -1.6;
  group.add(ring);

  stage.setUpdate((t, pointer) => {
    group.rotation.y = pointer.x * 0.3;
    group.rotation.x = pointer.y * 0.18;
    ring.rotation.z = t * 0.05;
    pieces.forEach((piece) => {
      piece.mesh.rotation.x += piece.spin[0] * 0.004;
      piece.mesh.rotation.y += piece.spin[1] * 0.004;
      piece.mesh.rotation.z += piece.spin[2] * 0.004;
      piece.mesh.position.y = piece.pos[1] + Math.sin(t * 0.5 + piece.phase) * 0.14;
    });
  });

  return stage;
}

/* ---------------------------------------------------------------------------
 * The ring.
 *
 * The ad's signature: every supported agent riding a tilted elliptical orbit
 * around a protected opening. The headline sits inside that opening, so the
 * ring frames the words rather than competing with them — which is what keeps
 * it identity rather than decoration.
 *
 * Two details carry the whole effect and are ported from the film verbatim:
 *   1. Arc-length parameterisation. Spacing marks by angle bunches them at
 *      the ends of an ellipse; spacing them by distance along it does not.
 *   2. Perspective compensation. Marks swinging toward camera are pushed back
 *      toward the centre so they never crop against the edge of the frame.
 * ------------------------------------------------------------------------- */

/*
 * Every agent Modesto supports, in the order they ride the orbit. Bare marks
 * carry no text, so the slug is all this list needs — the label fields the
 * ad's plaques used would be dead data here.
 */
const RING_PROVIDERS = [
  "codex",
  "gemini",
  "kilo",
  "claude",
  "devin",
  "opencode",
  "qwen",
  "cursor",
  "poolside",
  "grok",
  "kimi",
  "droid",
  "meta",
  "copilot",
  "pi",
];

const TILE_PX = 256;

/** Reads the site's current theme so the 3D can match the page. */
function isLightTheme() {
  return document.documentElement.dataset.theme === "light";
}

/**
 * Draws one provider as an APP ICON: a rounded square tile with the glyph
 * centred on it, the way the icon looks on a home screen or in a dock.
 *
 * The marks are flat black silhouettes on disk, so the theme decides the ink:
 * black glyph on a paper tile in light, light glyph on a slate tile in dark.
 * That is the whole reason the extractor flattens them to one colour.
 */
function appIconTexture(own, mark, light) {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  const radius = Math.round(TILE_PX * 0.225); // iOS-ish squircle proportion

  const tileTop = light ? "#faf7ef" : "#2b322708";
  const tileBottom = light ? "#e8e0cf" : "#161a13";
  const wash = ctx.createLinearGradient(0, 0, 0, TILE_PX);
  wash.addColorStop(0, light ? tileTop : "#333b30");
  wash.addColorStop(1, tileBottom);
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.roundRect(0, 0, TILE_PX, TILE_PX, radius);
  ctx.fill();

  // A hairline inner edge, the highlight every real app icon has.
  ctx.strokeStyle = light ? "#12150f1f" : "#ffffff1f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, TILE_PX - 3, TILE_PX - 3, radius - 1);
  ctx.stroke();

  const inset = Math.round(TILE_PX * 0.235);
  const glyph = TILE_PX - inset * 2;
  ctx.drawImage(tintedMark(mark, glyph, light ? "#12150f" : "#eceee6"), inset, inset);

  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Maps an even 0..1 fraction to the ellipse angle that is that far along the
 * PERIMETER, not that far around in angle. Cached per (rx, ry).
 */
function makeOrbitAngle() {
  let cache;
  return (fraction, rx, ry) => {
    if (!cache || cache.rx !== rx || cache.ry !== ry) {
      const lengths = [0];
      let lastX = rx;
      let lastY = 0;
      for (let i = 1; i <= 256; i += 1) {
        const a = (i / 256) * Math.PI * 2;
        const x = rx * Math.cos(a);
        const y = ry * Math.sin(a);
        lengths.push(lengths[i - 1] + Math.hypot(x - lastX, y - lastY));
        lastX = x;
        lastY = y;
      }
      cache = { rx, ry, lengths };
    }
    const { lengths } = cache;
    const target = (((fraction % 1) + 1) % 1) * lengths[256];
    let lo = 0;
    let hi = 256;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < target) lo = mid;
      else hi = mid;
    }
    return ((lo + (target - lengths[lo]) / (lengths[hi] - lengths[lo])) / 256) * Math.PI * 2;
  };
}

export async function mountRings(host) {
  if (!host || prefersReducedMotion()) return null;
  const stage = createStage(host, { fov: 36, distance: 9 });
  if (!stage) return null;

  const { own, scene, camera } = stage;

  await document.fonts.ready;
  const marks = await Promise.all(
    RING_PROVIDERS.map((slug) => loadImage(`${MARK_BASE}/${slug}.svg`)),
  );
  const ring = new THREE.Group();
  scene.add(ring);

  /*
   * Each provider is a real app-icon tile: a rounded square with actual
   * thickness, not a flat decal. The body is extruded and bevelled so the
   * edges catch the lime rim light as the orbit turns them, and the face is a
   * separate plane sitting just proud of the front so the artwork stays crisp.
   */
  const TILE_SIZE = 1;
  const tileBody = bodyGeometry(own, TILE_SIZE, TILE_SIZE, 0.15, TILE_SIZE * 0.225);
  const tileFace = own(new THREE.PlaneGeometry(TILE_SIZE - 0.004, TILE_SIZE - 0.004));

  let light = isLightTheme();
  const caseMaterial = own(
    new THREE.MeshPhysicalMaterial({
      color: light ? 0xe6dece : 0x2b3227,
      metalness: 0.35,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
    }),
  );

  const orbiters = marks.map((mark) => {
    const tile = new THREE.Group();
    tile.add(new THREE.Mesh(tileBody, caseMaterial));
    const face = new THREE.Mesh(
      tileFace,
      own(
        new THREE.MeshBasicMaterial({
          map: appIconTexture(own, mark, light),
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    // The extruded case ends at depth / 2 + bevelThickness = 0.12.
    face.position.z = 0.126;
    tile.add(face);
    ring.add(tile);
    return tile;
  });

  /*
   * No nucleus. The ad puts the Modesto mark at the centre of the orbit, but
   * here the headline occupies that space — the mark landed on top of the
   * word "faster". The ring of agents carries the identity on its own.
   */

  /*
   * The page's theme toggle has to reach the 3D too, otherwise the ring keeps
   * light glyphs on a paper page. Repainting the face textures is cheap — 15
   * small canvases — so it happens inline rather than rebuilding the scene.
   */
  const repaint = () => {
    const next = isLightTheme();
    if (next === light) return;
    light = next;
    caseMaterial.color.setHex(light ? 0xe6dece : 0x2b3227);
    orbiters.forEach((tile, index) => {
      const face = tile.children[1];
      face.material.map.dispose();
      face.material.map = appIconTexture(own, marks[index], light);
      face.material.needsUpdate = true;
    });
  };
  const themeWatcher = new MutationObserver(repaint);
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const orbitAngle = makeOrbitAngle();
  let arrived = 0;

  stage.setUpdate((t, pointer) => {
    const aspect = camera.aspect;
    const visibleHeight = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const visibleWidth = visibleHeight * aspect;
    const portrait = aspect < 0.7;

    const rx = visibleWidth * (portrait ? 0.365 : 0.395);
    const ry = visibleHeight * (portrait ? 0.39 : 0.36);
    // Bare marks carry no label, so they can be far smaller than the ad's
    // tiles and still read — which is the point: quiet enough to sit behind
    // the headline rather than crowd it.
    const size = Math.min(visibleWidth * 0.058, visibleHeight * 0.105);

    arrived = Math.min(1, arrived + 0.012);
    const spin = -0.6 + t * 0.085;
    const roll = portrait ? -0.055 : -0.12;
    const cos = Math.cos(roll);
    const sin = Math.sin(roll);

    orbiters.forEach((mesh, index) => {
      const progress = Math.min(1, Math.max(0, (arrived * 1.6 - index * 0.03) / 1));
      const arrive = 1 - Math.pow(1 - progress, 3);
      const angle = orbitAngle(spin / (Math.PI * 2) + index / orbiters.length, rx, ry);
      const depth = Math.sin(angle);
      const z = depth * 0.65 - (1 - arrive) * 5;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      // Pull marks that swing toward camera back in, so none crop at the edge.
      const projection = (camera.position.z - z) / camera.position.z;

      mesh.position.set((x * cos - y * sin) * projection, (x * sin + y * cos) * projection, z);
      mesh.scale.setScalar(size * (0.2 + arrive * 0.8) * (1 + depth * 0.06));
      mesh.visible = progress > 0.015;
      // Marks always face the viewer; the ones at the back simply dim.
      mesh.lookAt(camera.position);
    });

    ring.rotation.z = pointer.x * 0.04;
    scene.rotation.y = pointer.x * 0.05;
    scene.rotation.x = pointer.y * 0.035;
  });

  const stageDispose = stage.dispose;
  stage.dispose = () => {
    themeWatcher.disconnect();
    stageDispose();
  };

  return stage;
}

/* ---------------------------------------------------------------------------
 * The Handoff Mark, as a sculpture.
 *
 * The 2D mark is four strokes (see /announcements/modesto-mark.svg). Here those
 * same paths become chrome tubes with a lime core — the film's two finishes —
 * so the identity can sit in a hero the way the knot sits in the film. The
 * strokes weave a few millimetres in Z: many paths, one direction, in volume.
 * ------------------------------------------------------------------------- */

function markStrokes() {
  const scale = 0.048;
  const point = (x, y, z) => new THREE.Vector3((x - 48) * scale, (46 - y) * scale, z);

  const stroke = (z, segments) => {
    const path = new THREE.CurvePath();
    for (const segment of segments) {
      if (segment.length === 2) {
        path.add(new THREE.LineCurve3(point(...segment[0], z), point(...segment[1], z)));
      } else {
        path.add(
          new THREE.CubicBezierCurve3(
            point(...segment[0], z),
            point(...segment[1], z),
            point(...segment[2], z),
            point(...segment[3], z),
          ),
        );
      }
    }
    return path;
  };

  return [
    stroke(0.1, [
      [
        [18, 32],
        [39, 32],
      ],
      [
        [39, 32],
        [42, 32],
        [43.5, 30.5],
        [45, 28],
      ],
      [
        [45, 28],
        [55, 12],
      ],
    ]),
    stroke(-0.1, [
      [
        [66, 20],
        [60, 32],
      ],
      [
        [60, 32],
        [58, 36],
        [59, 39],
        [62, 42],
      ],
      [
        [62, 42],
        [81, 58],
      ],
    ]),
    stroke(0.06, [
      [
        [14, 45],
        [35, 51],
      ],
      [
        [35, 51],
        [39, 52],
        [41, 55],
        [41, 59],
      ],
      [
        [41, 59],
        [41, 80],
      ],
    ]),
    stroke(-0.12, [
      [
        [57, 58],
        [70, 70],
      ],
    ]),
  ];
}

function paintBrandMaterials(mat) {
  const light = isLightTheme();
  mat.chrome.color.setHex(light ? 0xc8c2b0 : 0xdce2d2);
  mat.lime.color.setHex(light ? 0x8fb84a : 0xc7ed87);
  mat.dark.color.setHex(light ? 0x3c4234 : 0x242c20);
}

/** Branding hero: the Handoff Mark as a chrome + lime sculpture. */
export function mountMark(host) {
  if (!host || prefersReducedMotion()) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const stage = createStage(host, { fov: 36, distance: 8.8 });
      if (!stage) return;

      const { own, scene } = stage;
      const mat = materials(own);
      paintBrandMaterials(mat);
      const themeWatcher = new MutationObserver(() => paintBrandMaterials(mat));
      themeWatcher.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      const stageDispose = stage.dispose;
      stage.dispose = () => {
        themeWatcher.disconnect();
        stageDispose();
      };

      const group = new THREE.Group();
      const radius = 0.145;
      const cap = own(new THREE.SphereGeometry(radius, 16, 12));
      const innerCap = own(new THREE.SphereGeometry(radius * 0.38, 10, 8));

      for (const curve of markStrokes()) {
        const tubular = Math.max(20, Math.floor(curve.getLength() / 0.06));
        group.add(
          new THREE.Mesh(
            own(new THREE.TubeGeometry(curve, tubular, radius, 12, false)),
            mat.chrome,
          ),
        );
        group.add(
          new THREE.Mesh(
            own(new THREE.TubeGeometry(curve, tubular, radius * 0.38, 8, false)),
            mat.lime,
          ),
        );
        const start = curve.getPointAt(0);
        const end = curve.getPointAt(1);
        const startCap = new THREE.Mesh(cap, mat.chrome);
        const endCap = new THREE.Mesh(cap, mat.chrome);
        startCap.position.copy(start);
        endCap.position.copy(end);
        const startInner = new THREE.Mesh(innerCap, mat.lime);
        const endInner = new THREE.Mesh(innerCap, mat.lime);
        startInner.position.copy(start);
        endInner.position.copy(end);
        group.add(startCap, endCap, startInner, endInner);
      }

      group.scale.setScalar(0.72);
      scene.add(group);

      stage.setUpdate((t, pointer) => {
        const time = prefersReducedMotion() ? 0 : t;
        group.rotation.set(
          0.12 + Math.sin(time * 0.22) * 0.04 + pointer.y * 0.04,
          0.18 + Math.sin(time * 0.18) * 0.06 + pointer.x * 0.06,
          -0.04,
        );
        group.position.y = Math.sin(time * 0.35) * 0.03;
      });

      window.addEventListener("pagehide", () => stage.dispose(), { once: true });
    },
    { rootMargin: "160px" },
  );
  observer.observe(host);
}

/**
 * Draws one changelog tile face: the mark and the version, on paper or lime.
 * The 3D case carries the chrome edge; this plane is only the printed front.
 */
function releaseTileTexture(own, logo, tag, { light, selected }) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const radius = 92;

  const wash = ctx.createLinearGradient(0, 0, 80, 512);
  if (selected) {
    wash.addColorStop(0, light ? "#eef6c8" : "#d5f995");
    wash.addColorStop(1, light ? "#c7ed87" : "#9ec85e");
  } else if (light) {
    wash.addColorStop(0, "#faf7ef");
    wash.addColorStop(1, "#e4dcc8");
  } else {
    wash.addColorStop(0, "#333b30");
    wash.addColorStop(1, "#171a14");
  }
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 512, radius);
  ctx.fill();
  ctx.strokeStyle = selected ? "#14180f22" : light ? "#12150f18" : "#ffffff18";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(3, 3, 506, 506, radius - 2);
  ctx.stroke();

  const ink = selected || light;
  ctx.drawImage(tintedMark(logo, 148, ink ? "#12150f" : "#eceee6", selected ? 0.88 : 0.42), 48, 44);

  ctx.fillStyle = selected ? "#14180f" : light ? "#3c4234" : "#d5f995cc";
  ctx.font = "600 36px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(tag, 48, 448);

  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Changelog: one WebGL tileset behind the real buttons. Each release is an
 * extruded plate in the film's chrome / paper / lime language. The buttons
 * stay the hit targets so keyboard and screen-reader users are unchanged.
 */
export async function mountReleaseTiles(root) {
  if (!root || prefersReducedMotion()) return null;
  const host = root.querySelector("[data-rc-stage]");
  const buttons = Array.from(root.querySelectorAll(".rc-cube"));
  if (!host || buttons.length === 0) return null;

  const worldPerPixel = 0.01;
  const stage = createStage(host, { ortho: true, distance: 18, worldPerPixel });
  if (!stage) return null;

  const { own, scene } = stage;
  const logo = await loadImage("/announcements/modesto-mark-light.svg");
  await document.fonts.ready;

  const tileBody = bodyGeometry(own, 1, 1, 0.24, 0.18);
  const tileFace = own(new THREE.PlaneGeometry(0.992, 0.992));
  const paperCase = own(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6dece,
      metalness: 0.42,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.22,
    }),
  );
  const limeCase = own(
    new THREE.MeshPhysicalMaterial({
      color: 0xc7ed87,
      metalness: 0.38,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
    }),
  );

  let light = isLightTheme();
  const paintCases = () => {
    paperCase.color.setHex(light ? 0xe6dece : 0x2b3227);
    limeCase.color.setHex(light ? 0xb7d96a : 0xc7ed87);
  };
  paintCases();

  const makeFaces = () =>
    buttons.map((button) => {
      const tag = button.querySelector(".rc-tag")?.textContent?.trim() ?? "";
      return {
        idle: releaseTileTexture(own, logo, tag, { light, selected: false }),
        selected: releaseTileTexture(own, logo, tag, { light, selected: true }),
      };
    });

  let faces = makeFaces();

  const tiles = buttons.map((_, index) => {
    const tile = new THREE.Group();
    const body = new THREE.Mesh(tileBody, paperCase);
    const face = new THREE.Mesh(
      tileFace,
      own(
        new THREE.MeshBasicMaterial({
          map: faces[index].idle,
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    face.position.z = 0.168;
    tile.add(body, face);
    scene.add(tile);
    return { tile, body, face, lift: 0 };
  });

  const repaint = () => {
    const next = isLightTheme();
    if (next === light) return;
    light = next;
    paintCases();
    faces.forEach((pair) => {
      pair.idle.dispose();
      pair.selected.dispose();
    });
    faces = makeFaces();
    tiles.forEach((entry, index) => {
      entry.face.material.map = faces[index].idle;
      entry.face.material.needsUpdate = true;
    });
  };
  const themeWatcher = new MutationObserver(repaint);
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  stage.setUpdate((_t, pointer) => {
    const hostRect = host.getBoundingClientRect();
    tiles.forEach((entry, index) => {
      const button = buttons[index];
      const rect = button.getBoundingClientRect();
      const selected = button.classList.contains("is-selected");
      const x = (rect.left + rect.width / 2 - (hostRect.left + hostRect.width / 2)) * worldPerPixel;
      const y = (hostRect.top + hostRect.height / 2 - (rect.top + rect.height / 2)) * worldPerPixel;
      const size = Math.min(rect.width, rect.height) * worldPerPixel;

      entry.lift += ((selected ? 0.22 : 0) - entry.lift) * 0.12;
      entry.tile.position.set(x, y, entry.lift);
      entry.tile.scale.setScalar(size * 0.86);
      entry.tile.rotation.set(-0.48 + pointer.y * 0.03, 0.58 + pointer.x * 0.04, 0.08);
      entry.body.material = selected ? limeCase : paperCase;
      const nextMap = selected ? faces[index].selected : faces[index].idle;
      if (entry.face.material.map !== nextMap) {
        entry.face.material.map = nextMap;
        entry.face.material.needsUpdate = true;
      }
    });
  });

  const stageDispose = stage.dispose;
  stage.dispose = () => {
    themeWatcher.disconnect();
    faces.forEach((pair) => {
      pair.idle.dispose();
      pair.selected.dispose();
    });
    stageDispose();
  };
  window.addEventListener("pagehide", () => stage.dispose(), { once: true });

  return stage;
}

/**
 * Branding colour row: the four palette chips as extruded app-icon tiles in
 * the film's physical materials. One ortho renderer sits behind the grid and
 * tracks each CSS chip, so the labels stay real DOM and reduced-motion keeps
 * the flat tiles.
 */
const SWATCH_SPEC = {
  ink: { color: 0x10120f, metalness: 0.78, roughness: 0.22 },
  paper: { color: 0xefe7d6, metalness: 0.2, roughness: 0.4 },
  soft: { color: 0x171a14, metalness: 0.7, roughness: 0.28 },
  live: { color: 0xd5f995, metalness: 0.38, roughness: 0.24 },
};

export function mountColorSwatches(root) {
  if (!root || prefersReducedMotion()) return;
  const host = root.querySelector("[data-swatch-stage]");
  const chips = [...root.querySelectorAll("[data-swatch]")];
  if (!host || chips.length === 0) return;
  mountColorSwatchesNow(host, chips);
}

function mountColorSwatchesNow(host, chips) {
  const worldPerPixel = 0.01;
  const stage = createStage(host, { ortho: true, distance: 16, worldPerPixel });
  if (!stage) return;

  const { own, scene } = stage;
  const body = bodyGeometry(own, 1, 1, 0.22, 0.225);
  const face = own(new THREE.PlaneGeometry(0.9, 0.9));

  const tiles = chips.map((chip, index) => {
    const spec = SWATCH_SPEC[chip.dataset.swatch] ?? SWATCH_SPEC.ink;
    const material = own(
      new THREE.MeshPhysicalMaterial({
        color: spec.color,
        metalness: spec.metalness,
        roughness: spec.roughness,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
      }),
    );
    const plate = own(
      new THREE.MeshPhysicalMaterial({
        color: spec.color,
        metalness: Math.max(0, spec.metalness - 0.12),
        roughness: spec.roughness + 0.06,
        clearcoat: 0.7,
        clearcoatRoughness: 0.28,
      }),
    );
    const tile = new THREE.Group();
    const mesh = new THREE.Mesh(body, material);
    const front = new THREE.Mesh(face, plate);
    front.position.z = 0.14;
    tile.add(mesh, front);
    scene.add(tile);
    return { tile, phase: index * 1.15 };
  });

  stage.setUpdate((t, pointer) => {
    const hostRect = host.getBoundingClientRect();
    tiles.forEach((entry, index) => {
      const rect = chips[index].getBoundingClientRect();
      const x = (rect.left + rect.width / 2 - (hostRect.left + hostRect.width / 2)) * worldPerPixel;
      const y = (hostRect.top + hostRect.height / 2 - (rect.top + rect.height / 2)) * worldPerPixel;
      const size = Math.min(rect.width, rect.height) * worldPerPixel;
      const time = prefersReducedMotion() ? 0 : t;
      entry.tile.position.set(x, y + Math.sin(time * 0.7 + entry.phase) * 0.04, 0.12);
      entry.tile.scale.setScalar(size * 0.92);
      entry.tile.rotation.set(
        -0.28 + Math.sin(time * 0.45 + entry.phase) * 0.05 + pointer.y * 0.05,
        0.34 + Math.sin(time * 0.38 + index) * 0.06 + pointer.x * 0.07,
        0.04,
      );
    });
  });

  window.addEventListener("pagehide", () => stage.dispose(), { once: true });
}
