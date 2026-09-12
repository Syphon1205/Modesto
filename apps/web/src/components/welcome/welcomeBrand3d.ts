// FILE: welcomeBrand3d.ts
// Purpose: Welcome WebGL — the marketing hero's three agent cards, plus the
//          appearance-step theme tiles. Same light rig, lime rim, and idle
//          sway as `apps/marketing/public/brand/modesto-3d.js`. Loaded only
//          when welcome is open so three.js stays off the first-paint graph.
//          Reduced-motion and WebGL-less clients keep the CSS fallbacks.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MARK_BASE = "/brand/marks";

export type WelcomeBrandStage = {
  dispose: () => void;
};

export type ThemeTileSpec = {
  id: string;
  label: string;
  code: string;
  caseHex: number;
  canvas: string;
  accent: string;
  text: string;
  muted: string;
  surface: string;
};

export type WelcomeThemeStage = WelcomeBrandStage & {
  setSelected: (id: string) => void;
};

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.dataset.reduced === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function roundedShape(width: number, height: number, radius: number): THREE.Shape {
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

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function tintedMark(mark: CanvasImageSource, size: number, color: string): HTMLCanvasElement {
  const scratch = document.createElement("canvas");
  scratch.width = size;
  scratch.height = size;
  const context = scratch.getContext("2d");
  if (!context) return scratch;
  context.drawImage(mark, 0, 0, size, size);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, size, size);
  return scratch;
}

type Disposable = { dispose?: () => void };

type BrandStage = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  own: <T extends Disposable>(resource: T) => T;
  setUpdate: (fn: (time: number, pointer: { x: number; y: number }) => void) => void;
  dispose: () => void;
};

function createStage(
  host: HTMLElement,
  { fov = 36, distance = 9 }: { fov?: number; distance?: number } = {},
): BrandStage | null {
  let renderer: THREE.WebGLRenderer;
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

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, distance);

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

  const owned = new Set<Disposable>([{ dispose: () => environment.texture.dispose() }]);
  const own = <T extends Disposable>(resource: T): T => {
    owned.add(resource);
    return resource;
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointerMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  let frame = 0;
  let visible = false;
  let update: ((time: number, pointer: { x: number; y: number }) => void) | null = null;
  const clock = new THREE.Clock();

  const tick = () => {
    frame = prefersReducedMotion() ? 0 : requestAnimationFrame(tick);
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    try {
      update?.(clock.getElapsedTime(), pointer);
    } catch {
      /* A scene update must not kill the loop — the CSS cards stay up. */
    }
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.render(scene, camera);
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

  const intersection = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) start();
      else stop();
    },
    { threshold: 0, rootMargin: "80px" },
  );
  intersection.observe(host);

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  return {
    scene,
    camera,
    own,
    setUpdate(fn) {
      update = fn;
    },
    dispose() {
      stop();
      intersection.disconnect();
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      owned.forEach((resource) => resource.dispose?.());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function faceTexture(
  own: BrandStage["own"],
  mark: HTMLImageElement,
  index: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 960;
  const context = canvas.getContext("2d");
  if (!context) return own(new THREE.CanvasTexture(canvas));

  const palettes = [
    ["#d4f5a0", "#a2be74", "#1b2a11"],
    ["#333b30", "#1b2119", "#f0f3e8"],
    ["#f0f0e6", "#bfc8b1", "#1d2917"],
  ] as const;
  const [top, bottom, ink] = palettes[index] ?? palettes[0];
  const gradient = context.createLinearGradient(0, 0, 768, 960);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(0, 0, 768, 960, 55);
  context.fill();
  context.strokeStyle = index === 1 ? "#ffffff24" : "#ffffff70";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(10, 10, 748, 940, 48);
  context.stroke();
  context.drawImage(tintedMark(mark, 190, index === 1 ? "#f0f3e8" : "#12150f"), 68, 65);
  const sans =
    getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim() ||
    "ui-sans-serif, system-ui, sans-serif";
  context.fillStyle = ink;
  context.font = `600 77px ${sans}`;
  context.fillText(["Codex", "Claude", "Cursor"][index] ?? "", 68, 370);
  context.globalAlpha = 0.62;
  context.font = `500 23px ${sans}`;
  context.fillText(["READY TO BUILD", "READY TO THINK", "READY TO SHIP"][index] ?? "", 72, 420);
  context.globalAlpha = 0.35;
  context.fillRect(70, 810, 628, 1);
  context.font = `500 21px ${sans}`;
  context.fillText(`MODESTO / AGENT 0${index + 1}`, 72, 865);
  context.globalAlpha = 1;
  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function materials(own: BrandStage["own"]) {
  const make = (options: THREE.MeshPhysicalMaterialParameters) =>
    own(new THREE.MeshPhysicalMaterial(options));
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

/** Bevel depth used by every extruded card body. */
const BODY_BEVEL = 0.045;

/**
 * Z at which a card's printed face clears its own body.
 *
 * `bodyGeometry` centres the extrusion and then bevels it, so the front
 * surface sits at `depth / 2 + BODY_BEVEL` — not `depth / 2`. Every face plane
 * here was placed just *under* that and got swallowed by the body, which is
 * why the theme cards rendered as blank slabs with no name or hex on them.
 */
function faceZ(depth: number): number {
  return depth / 2 + BODY_BEVEL + 0.015;
}

function bodyGeometry(
  own: BrandStage["own"],
  width: number,
  height: number,
  depth: number,
  radius: number,
): THREE.ExtrudeGeometry {
  const geometry = own(
    new THREE.ExtrudeGeometry(roundedShape(width, height, radius), {
      depth,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: BODY_BEVEL,
      bevelThickness: BODY_BEVEL,
      curveSegments: 12,
    }),
  );
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Hero: the three agent cards and their orbit, floating under the pointer. */
export async function mountAgentCards(host: HTMLElement): Promise<WelcomeBrandStage | null> {
  if (prefersReducedMotion()) return null;
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

  const poses = [
    { pos: [-0.55, 0.98, -0.42] as const, rotZ: -0.23, rotY: -0.36 },
    { pos: [0.95, 0.05, 0.05] as const, rotZ: 0.15, rotY: -0.4 },
    { pos: [-0.65, -0.92, 0.65] as const, rotZ: -0.15, rotY: 0.33 },
  ];

  const cards = poses.map((pose, index) => {
    const card = new THREE.Group();
    const caseMaterial = cases[index];
    const mark = marks[index];
    if (!caseMaterial || !mark) return card;
    card.add(new THREE.Mesh(bodyGeometry(own, 1.83, 2.3, 0.14, 0.16), caseMaterial));

    const front = new THREE.Mesh(
      own(new THREE.PlaneGeometry(1.82, 2.29)),
      own(
        new THREE.MeshBasicMaterial({
          map: faceTexture(own, mark, index),
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    front.position.z = faceZ(0.14);
    card.add(front);

    const rear = new THREE.Mesh(bodyGeometry(own, 1.55, 2.02, 0.025, 0.13), caseMaterial);
    rear.position.z = -0.12;
    card.add(rear);

    card.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    group.add(card);
    return card;
  });

  const orbit = new THREE.Mesh(own(new THREE.TorusGeometry(2.6, 0.012, 8, 100)), mat.chrome);
  orbit.rotation.set(0.8, 0.35, -0.4);
  orbit.position.z = -0.7;
  group.add(orbit);
  group.scale.setScalar(1.12);

  stage.setUpdate((time, pointer) => {
    group.rotation.y = Math.sin(time * 0.38) * 0.17 - 0.08 + pointer.x * 0.16;
    group.rotation.x = pointer.y * 0.1;

    cards.forEach((card, index) => {
      const pose = poses[index];
      if (!pose) return;
      card.position.y = pose.pos[1] + Math.sin(time * 0.8 + index * 1.5) * 0.08;
      card.rotation.set(
        0.1 + Math.sin(time * 0.45 + index) * 0.08,
        pose.rotY + Math.sin(time * 0.5 + index) * 0.1,
        pose.rotZ,
      );
    });

    orbit.rotation.z = -0.4 + time * 0.055;
  });

  return stage;
}

function themeFaceTexture(own: BrandStage["own"], tile: ThemeTileSpec): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 800;
  const context = canvas.getContext("2d");
  if (!context) return own(new THREE.CanvasTexture(canvas));

  context.fillStyle = tile.canvas;
  context.beginPath();
  context.roundRect(0, 0, 640, 800, 48);
  context.fill();

  context.fillStyle = tile.surface;
  context.beginPath();
  context.roundRect(28, 28, 584, 744, 38);
  context.fill();

  const orb = context.createRadialGradient(250, 290, 20, 270, 310, 210);
  orb.addColorStop(0, tile.accent);
  orb.addColorStop(0.55, tile.accent);
  orb.addColorStop(1, `${tile.accent}00`);
  context.fillStyle = orb;
  context.beginPath();
  context.arc(270, 310, 210, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = tile.canvas;
  context.globalAlpha = 0.45;
  context.beginPath();
  context.arc(400, 420, 88, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const sans =
    getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim() ||
    "ui-sans-serif, system-ui, sans-serif";
  context.fillStyle = tile.text;
  context.font = `600 68px ${sans}`;
  context.fillText(tile.label, 56, 600);
  context.fillStyle = tile.accent;
  context.font = `600 36px ${sans}`;
  context.fillText(tile.code, 58, 656);
  context.fillStyle = tile.muted;
  context.font = `500 20px ${sans}`;
  context.fillText("MODESTO / LOOK", 58, 702);

  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Appearance: a fan of physical theme tiles under the pointer. */
export async function mountThemeTiles(
  host: HTMLElement,
  tiles: readonly ThemeTileSpec[],
  options: { selectedId: string; onSelect: (id: string) => void },
): Promise<WelcomeThemeStage | null> {
  if (prefersReducedMotion()) return null;
  const stage = createStage(host, { fov: 30, distance: 11.4 });
  if (!stage) return null;

  await document.fonts.ready;

  const { own, scene, camera } = stage;
  const group = new THREE.Group();
  scene.add(group);

  const mid = (tiles.length - 1) / 2;
  let selectedId = options.selectedId;
  let hoverId: string | null = null;

  const cards = tiles.map((tile, index) => {
    const offset = index - mid;
    const pose = {
      x: offset * 1.86,
      y: Math.abs(offset) * 0.06,
      z: -Math.abs(offset) * 0.18,
      rotY: offset * -0.15,
      rotZ: offset * 0.03,
    };
    const caseMaterial = own(
      new THREE.MeshPhysicalMaterial({
        color: tile.caseHex,
        metalness: 0.42,
        roughness: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
      }),
    );
    const card = new THREE.Group();
    card.userData.themeId = tile.id;
    card.userData.lift = selectedId === tile.id ? 1 : 0;
    card.add(new THREE.Mesh(bodyGeometry(own, 1.48, 1.86, 0.12, 0.14), caseMaterial));

    const front = new THREE.Mesh(
      own(new THREE.PlaneGeometry(1.47, 1.85)),
      own(
        new THREE.MeshBasicMaterial({
          map: themeFaceTexture(own, tile),
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    front.position.z = faceZ(0.12);
    front.userData.themeId = tile.id;
    card.add(front);

    const rear = new THREE.Mesh(bodyGeometry(own, 1.26, 1.62, 0.022, 0.12), caseMaterial);
    rear.position.z = -0.1;
    rear.userData.themeId = tile.id;
    card.add(rear);

    card.position.set(pose.x, pose.y, pose.z);
    card.rotation.set(0.08, pose.rotY, pose.rotZ);
    group.add(card);
    return { card, pose, id: tile.id };
  });

  const pickables = cards.map((entry) => entry.card);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const pick = (event: PointerEvent): string | null => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, true)[0];
    const id = hit?.object.userData.themeId;
    return typeof id === "string" ? id : null;
  };

  const onPointerDown = (event: PointerEvent) => {
    const id = pick(event);
    if (id) options.onSelect(id);
  };
  const onPointerMove = (event: PointerEvent) => {
    hoverId = pick(event);
    host.style.cursor = hoverId ? "pointer" : "default";
  };
  const onPointerLeave = () => {
    hoverId = null;
    host.style.cursor = "";
  };

  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);

  const innerDispose = stage.dispose;
  stage.setUpdate((time, pointer) => {
    group.rotation.y = pointer.x * 0.1;
    group.rotation.x = pointer.y * 0.05;

    for (const { card, pose, id } of cards) {
      const target = selectedId === id ? 1 : hoverId === id ? 0.45 : 0;
      card.userData.lift += (target - card.userData.lift) * 0.14;
      const lift = card.userData.lift as number;
      card.position.set(
        pose.x,
        pose.y + Math.sin(time * 0.7 + pose.x) * 0.045 + lift * 0.1,
        pose.z + lift * 0.46,
      );
      card.scale.setScalar(1 + lift * 0.07);
      card.rotation.set(0.08 + lift * 0.04, pose.rotY, pose.rotZ);
    }
  });

  return {
    dispose() {
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.style.cursor = "";
      innerDispose();
    },
    setSelected(id: string) {
      selectedId = id;
    },
  };
}

export type ProviderTileSpec = {
  id: string;
  label: string;
  detail: string;
  markUrl: string | null;
  /** Dimmed treatment for a CLI this machine does not have. */
  muted: boolean;
};

/**
 * Face for one provider card: the brand mark over the provider's name, drawn
 * in the app's own card colours so the ring sits inside the current theme
 * rather than beside it.
 */
function providerFaceTexture(
  own: BrandStage["own"],
  tile: ProviderTileSpec,
  mark: HTMLImageElement | null,
  palette: { surface: string; text: string; muted: string; border: string },
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return own(new THREE.CanvasTexture(canvas));

  context.globalAlpha = tile.muted ? 0.62 : 1;
  context.fillStyle = palette.surface;
  context.beginPath();
  context.roundRect(0, 0, 512, 512, 74);
  context.fill();
  context.strokeStyle = palette.border;
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(6, 6, 500, 500, 70);
  context.stroke();

  if (mark) {
    context.drawImage(tintedMark(mark, 150, tile.muted ? palette.muted : palette.text), 181, 132);
  }

  const sans =
    getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim() ||
    "ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillStyle = tile.muted ? palette.muted : palette.text;
  context.font = `600 46px ${sans}`;
  context.fillText(tile.label, 256, 356, 440);
  context.fillStyle = palette.muted;
  context.font = `500 27px ${sans}`;
  context.fillText(tile.detail, 256, 404, 440);
  context.globalAlpha = 1;

  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function readPalette(): {
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: number;
} {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const accentCss = read("--primary", "#8ab4f8");
  // `caseHex` needs a number; anything the browser cannot resolve to a hex
  // falls back rather than throwing NaN into the material.
  const probe = document.createElement("canvas").getContext("2d");
  let accent = 0x8ab4f8;
  if (probe) {
    probe.fillStyle = "#000000";
    probe.fillStyle = accentCss;
    const resolved = probe.fillStyle;
    if (typeof resolved === "string" && resolved.startsWith("#")) {
      accent = Number.parseInt(resolved.slice(1, 7), 16);
    }
  }
  return {
    surface: read("--card", "#161616"),
    text: read("--card-foreground", "#f5f5f5"),
    muted: read("--muted-foreground", "#9a9a9a"),
    border: read("--border", "#2a2a2a"),
    accent,
  };
}

/**
 * Agents step: the detected CLIs as physical cards on a slowly turning ring.
 * Cards stay upright (billboarded on the ring's own tilt) so their names stay
 * readable all the way around, and ease outward from the centre on mount —
 * the app reporting what it found, not a carousel demanding attention.
 */
export async function mountProviderRing(
  host: HTMLElement,
  tiles: readonly ProviderTileSpec[],
): Promise<WelcomeBrandStage | null> {
  if (prefersReducedMotion()) return null;
  if (tiles.length === 0) return null;

  const radius = tiles.length > 8 ? 3.3 : tiles.length > 5 ? 2.9 : 2.4;
  const cardSize = tiles.length > 8 ? 1.06 : 1.24;
  // Pull the camera back far enough to hold the whole ring rather than
  // guessing a distance: a hardcoded one fits five cards and clips nine.
  const fov = 32;
  const extent = radius + cardSize / 2 + 0.4;
  const distance = extent / Math.tan((fov / 2) * (Math.PI / 180));

  const stage = createStage(host, { fov, distance });
  if (!stage) return null;

  await document.fonts.ready;

  const { own, scene } = stage;
  const palette = readPalette();
  const group = new THREE.Group();
  // A shallow tilt reads as depth without turning the ring into an ellipse so
  // flat that the far cards disappear.
  group.rotation.x = -0.46;
  scene.add(group);

  const marks = await Promise.all(
    tiles.map((tile) => (tile.markUrl ? loadImage(tile.markUrl).catch(() => null) : null)),
  );

  const cards = tiles.map((tile, index) => {
    const angle = (index / tiles.length) * Math.PI * 2 - Math.PI / 2;
    const caseMaterial = own(
      new THREE.MeshPhysicalMaterial({
        color: palette.accent,
        metalness: 0.34,
        roughness: 0.34,
        clearcoat: 1,
        clearcoatRoughness: 0.24,
      }),
    );
    const card = new THREE.Group();
    card.add(new THREE.Mesh(bodyGeometry(own, cardSize, cardSize, 0.1, 0.18), caseMaterial));

    const front = new THREE.Mesh(
      own(new THREE.PlaneGeometry(cardSize - 0.02, cardSize - 0.02)),
      own(
        new THREE.MeshBasicMaterial({
          map: providerFaceTexture(own, tile, marks[index] ?? null, palette),
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    front.position.z = faceZ(0.1);
    card.add(front);

    group.add(card);
    return { card, angle };
  });

  const start = performance.now();
  stage.setUpdate((time, pointer) => {
    // 0 → 1 over the first ~900ms: cards travel out from the centre once.
    const settle = Math.min((performance.now() - start) / 900, 1);
    const eased = 1 - (1 - settle) ** 3;
    const spin = time * 0.075;

    group.rotation.z = spin;
    group.rotation.y = pointer.x * 0.14;

    for (const { card, angle } of cards) {
      const r = radius * eased;
      card.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      // Undo the group's spin and tilt on each card so every face keeps
      // pointing at the camera instead of rolling with the ring.
      card.rotation.set(0.46, -pointer.x * 0.14, -spin);
      card.scale.setScalar(0.72 + eased * 0.28);
    }
  });

  return { dispose: stage.dispose };
}

/**
 * Ready step: a physical folder, half-open, turning slowly under the pointer.
 * The same card language as the other steps — extruded body, accent case,
 * chrome edge — so "add a project" reads as the last object in the same set.
 */
export async function mountProjectFolder(host: HTMLElement): Promise<WelcomeBrandStage | null> {
  if (prefersReducedMotion()) return null;
  const stage = createStage(host, { fov: 32, distance: 8.6 });
  if (!stage) return null;

  const { own, scene } = stage;
  const palette = readPalette();
  const group = new THREE.Group();
  scene.add(group);

  const caseMaterial = own(
    new THREE.MeshPhysicalMaterial({
      color: palette.accent,
      metalness: 0.36,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.22,
    }),
  );
  const paperMaterial = own(
    new THREE.MeshPhysicalMaterial({
      color: 0xf3f3ef,
      metalness: 0.05,
      roughness: 0.62,
    }),
  );

  // Back panel, with the tab sitting proud of its top-left corner.
  const back = new THREE.Mesh(bodyGeometry(own, 2.6, 1.9, 0.12, 0.14), caseMaterial);
  group.add(back);

  const tab = new THREE.Mesh(bodyGeometry(own, 1.05, 0.34, 0.11, 0.09), caseMaterial);
  tab.position.set(-0.72, 1.02, -0.002);
  group.add(tab);

  // Three sheets, fanned, rising out of the folder as it opens.
  const sheets = [0, 1, 2].map((index) => {
    const sheet = new THREE.Mesh(
      bodyGeometry(own, 2.24 - index * 0.12, 1.6 - index * 0.08, 0.02, 0.06),
      paperMaterial,
    );
    sheet.position.set(index * 0.05 - 0.05, 0.12 + index * 0.06, 0.07 + index * 0.035);
    sheet.rotation.z = (index - 1) * 0.035;
    group.add(sheet);
    return sheet;
  });

  // Front panel, hinged at the bottom so the folder reads as open.
  const front = new THREE.Group();
  const frontPanel = new THREE.Mesh(bodyGeometry(own, 2.6, 1.78, 0.12, 0.14), caseMaterial);
  frontPanel.position.y = 0.89;
  front.add(frontPanel);
  front.position.set(0, -0.95, 0.22);
  front.rotation.x = -0.42;
  group.add(front);

  group.rotation.set(0.18, -0.42, 0.05);
  group.position.y = -0.1;

  stage.setUpdate((time, pointer) => {
    group.rotation.y = -0.42 + Math.sin(time * 0.32) * 0.16 + pointer.x * 0.22;
    group.rotation.x = 0.18 + pointer.y * 0.12;
    group.position.y = -0.1 + Math.sin(time * 0.7) * 0.05;
    // The sheets breathe a little out of the folder, slightly out of phase.
    sheets.forEach((sheet, index) => {
      sheet.position.y = 0.12 + index * 0.06 + Math.sin(time * 0.9 + index * 0.8) * 0.035;
    });
  });

  return { dispose: stage.dispose };
}
