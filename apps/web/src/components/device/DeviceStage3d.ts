// FILE: DeviceStage3d.ts
// Purpose: WebGL device stage — a real handset model (or the procedural chassis)
//          carrying the live guest screen, orbitable, with hit-testable hardware.
// Layer: Device pane 3D runtime
// Exports: createDeviceStage3d, isWebglAvailable, type DeviceStage, type DeviceStageHit
// Depends on: three, deviceChassis for the fallback body, deviceModelRegistry for the models.
//
// Loaded lazily and only while free look is engaged, so the default head-on
// pane keeps its zero-WebGL cost and three.js stays off the first-paint graph.
//
// The device rotates; the camera does not. That is the difference between
// "inspecting a render" and "turning a phone over in your hand", and it is also
// what makes sensor injection fall out for free: the gravity vector the guest
// should feel is just world-down expressed in the body's own frame, which is
// `gravity()` below.
//
// The guest's pixels never pass through the lighting rig. The screen is an
// unlit, untonemapped quad sized from the display mesh's bounding box rather
// than UV-mapped onto it, because a marketplace model's screen UVs are laid out
// for whatever wallpaper the author baked in. Clean UVs are also what make a
// raycast hit convertible straight back to a device point.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

import {
  chassisOutlines,
  DEVICE_SPECS,
  type ChassisOutline,
  type DeviceKind,
} from "./deviceChassis";
import { deviceModelFor, deviceModelUrl } from "./deviceModelRegistry";

/** Decoder bundles ship with three; both are no-ops for models that need neither. */
const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

export type DeviceStageHit =
  | { readonly kind: "screen"; readonly u: number; readonly v: number }
  | { readonly kind: "button"; readonly name: string };

export type DeviceStagePose = {
  /** Yaw, radians. Positive turns the device's right edge away from the viewer. */
  readonly yaw: number;
  /** Pitch, radians. Positive tips the top edge away. */
  readonly pitch: number;
  /** Roll, radians. Positive rolls clockwise from the viewer's side. */
  readonly roll: number;
};

export const IDENTITY_POSE: DeviceStagePose = { yaw: 0, pitch: 0, roll: 0 };

export type DeviceStageSource = "model" | "procedural";

export type DeviceStage = {
  /** Redraw once. Cheap to over-call: renders coalesce onto one animation frame. */
  invalidate(): void;
  setPose(pose: DeviceStagePose): void;
  resize(width: number, height: number): void;
  /**
   * What is under a client-space point. Screen hits carry normalized
   * coordinates with the origin at the display's top-left.
   */
  hitTest(clientX: number, clientY: number): DeviceStageHit | null;
  /**
   * Gravity as the guest's accelerometer would read it, in m/s², in Android's
   * sensor frame (X right, Y up, Z out of the screen). Flat and face-up is
   * (0, 0, 9.81); upright portrait is (0, 9.81, 0).
   */
  gravity(): { readonly x: number; readonly y: number; readonly z: number };
  /** Whether the body on screen is a real model or the drawn fallback. */
  source(): DeviceStageSource;
  dispose(): void;
};

const GRAVITY_MS2 = 9.80665;

export function isWebglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      globalThis.WebGL2RenderingContext &&
      (canvas.getContext("webgl2") ?? canvas.getContext("webgl")),
    );
  } catch {
    // Some hardened configurations throw rather than returning null.
    return false;
  }
}

// ── Outline → THREE.Shape ────────────────────────────────────────────

/**
 * Chassis outlines are authored in SVG space: origin top-left, Y down. Three is
 * Y-up, so every point is mirrored about the chassis mid-height and the whole
 * shape is centred here rather than by a later transform — a mirrored transform
 * would invert the extrusion's winding and turn every face inside out.
 */
function outlineToShape(outline: ChassisOutline, W: number, H: number, scale: number): THREE.Shape {
  const shape = new THREE.Shape();
  const px = (x: number) => (x - W / 2) * scale;
  const py = (y: number) => (H / 2 - y) * scale;
  for (const segment of outline) {
    switch (segment.kind) {
      case "move":
        shape.moveTo(px(segment.to.x), py(segment.to.y));
        break;
      case "line":
        shape.lineTo(px(segment.to.x), py(segment.to.y));
        break;
      case "cubic":
        shape.bezierCurveTo(
          px(segment.c1.x),
          py(segment.c1.y),
          px(segment.c2.x),
          py(segment.c2.y),
          px(segment.to.x),
          py(segment.to.y),
        );
        break;
      case "close":
        shape.closePath();
        break;
    }
  }
  return shape;
}

type BodyBuild = {
  readonly group: THREE.Group;
  /** Local-space rectangle the live screen occupies, and how far proud of the body it sits. */
  readonly screen: { x: number; y: number; width: number; height: number; z: number };
  readonly buttons: readonly THREE.Mesh[];
  readonly source: DeviceStageSource;
};

// ── Procedural body ──────────────────────────────────────────────────

function buildProceduralBody(
  kind: DeviceKind,
  pixelWidth: number | undefined,
  pixelHeight: number | undefined,
  disposables: Set<{ dispose(): void }>,
): BodyBuild {
  const spec = DEVICE_SPECS[kind];
  const geometry = chassisOutlines(kind, pixelWidth, pixelHeight);
  const { W, H } = geometry;
  // One world unit tall, so the camera framing below is kind-independent.
  const scale = 1 / H;
  const depth = H * spec.thicknessRatio * scale;

  const group = new THREE.Group();

  const bodyShape = outlineToShape(geometry.outer, W, H, scale);
  // The bevel is the rail's rounded shoulder. Kept to a fraction of the depth
  // so the flat of the rail — where the buttons sit — survives.
  const bevel = depth * 0.16;
  const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 24,
  });
  bodyGeometry.translate(0, 0, -depth / 2 + bevel);
  disposables.add(bodyGeometry);

  // ExtrudeGeometry emits group 0 for the caps and group 1 for the walls, which
  // maps exactly onto how a phone is finished: matte back and bezel, polished rail.
  const capMaterial = new THREE.MeshPhysicalMaterial({
    color: spec.backColor,
    metalness: 0.35,
    roughness: 0.52,
  });
  const railMaterial = new THREE.MeshPhysicalMaterial({
    color: spec.railColor,
    metalness: 1,
    roughness: spec.railRoughness,
  });
  disposables.add(capMaterial);
  disposables.add(railMaterial);

  const body = new THREE.Mesh(bodyGeometry, [capMaterial, railMaterial]);
  group.add(body);

  // The black bezel: a flat plate filling the aperture, just proud of the front
  // cap so it reads as glass over the frame rather than as part of the metal.
  const bezelShape = outlineToShape(geometry.cutout, W, H, scale);
  const bezelGeometry = new THREE.ShapeGeometry(bezelShape, 24);
  disposables.add(bezelGeometry);
  const bezelMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x05050a,
    metalness: 0,
    roughness: 0.22,
  });
  disposables.add(bezelMaterial);
  const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
  bezel.position.z = depth / 2 + depth * 0.002;
  group.add(bezel);

  const buttons: THREE.Mesh[] = [];
  const nubMaterial = new THREE.MeshPhysicalMaterial({
    color: spec.railColor,
    metalness: 1,
    roughness: spec.railRoughness * 1.15,
  });
  disposables.add(nubMaterial);
  for (const nub of geometry.nubs) {
    // Buttons ride the flat of the rail, so they are shallower than the body
    // and inset from its bevelled shoulders.
    const nubDepth = depth * 0.46;
    const nubGeometry = new THREE.BoxGeometry(nub.width * scale, nub.height * scale, nubDepth);
    disposables.add(nubGeometry);
    const mesh = new THREE.Mesh(nubGeometry, nubMaterial);
    mesh.position.set(
      (nub.x + nub.width / 2 - W / 2) * scale,
      (H / 2 - (nub.y + nub.height / 2)) * scale,
      0,
    );
    mesh.name = nub.name;
    mesh.userData.buttonName = nub.name;
    group.add(mesh);
    buttons.push(mesh);
  }

  return {
    group,
    screen: {
      x: (geometry.screen.x + geometry.screen.width / 2 - W / 2) * scale,
      y: (H / 2 - (geometry.screen.y + geometry.screen.height / 2)) * scale,
      width: geometry.screen.width * scale,
      height: geometry.screen.height * scale,
      z: depth / 2 + depth * 0.01,
    },
    buttons,
    source: "procedural",
  };
}

// ── Loaded model body ────────────────────────────────────────────────

function createGltfLoader(renderer: THREE.WebGLRenderer): {
  loader: GLTFLoader;
  dispose: () => void;
} {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
  const ktx2 = new KTX2Loader().detectSupport(renderer);
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  return {
    loader,
    dispose: () => {
      draco.dispose();
      ktx2.dispose();
    },
  };
}

/**
 * Loads the registered model for a kind and normalizes it into the same local
 * frame the procedural body uses: one world unit tall, centred on the origin,
 * screen facing +Z. Returns null when there is no entry, the file is absent, or
 * the contract does not match what loaded — every one of which means "use the
 * drawn chassis", never "show the user a broken pane".
 */
async function buildModelBody(
  kind: DeviceKind,
  renderer: THREE.WebGLRenderer,
  disposables: Set<{ dispose(): void }>,
  signal: AbortSignal,
): Promise<BodyBuild | null> {
  const contract = deviceModelFor(kind);
  if (!contract) return null;

  const { loader, dispose: disposeLoader } = createGltfLoader(renderer);
  let root: THREE.Object3D;
  try {
    const gltf = await loader.loadAsync(deviceModelUrl(contract));
    root = gltf.scene;
  } catch {
    // A 404 on a checkout without the assets is the common case, and is not an
    // error the user needs to see: the fallback body is a complete experience.
    disposeLoader();
    return null;
  } finally {
    disposeLoader();
  }
  if (signal.aborted) return null;

  for (const name of contract.hideNodes ?? []) {
    root.getObjectByName(name)?.removeFromParent();
  }

  if (contract.rotation) {
    root.rotation.set(contract.rotation[0], contract.rotation[1], contract.rotation[2]);
  }

  const screenNode = root.getObjectByName(contract.screenNode);
  if (!screenNode) {
    // The contract is stale — the model was replaced or renamed. Falling back
    // is right: without a screen node there is nowhere to put the guest.
    return null;
  }

  // Normalize: centre on the origin and scale to one unit tall. Doing this from
  // the measured bounds rather than trusting the file's units is what lets any
  // model drop in without a per-asset scale factor.
  const group = new THREE.Group();
  group.add(root);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  if (size.y <= 0) return null;
  const scale = 1 / size.y;
  root.position.sub(centre);
  root.scale.multiplyScalar(scale);
  root.position.multiplyScalar(scale);

  // Measured after the fit, so the rectangle is already in the group's frame.
  const screenBounds = new THREE.Box3().setFromObject(screenNode);
  const screenSize = screenBounds.getSize(new THREE.Vector3());
  const screenCentre = screenBounds.getCenter(new THREE.Vector3());
  if (screenSize.x <= 0 || screenSize.y <= 0) return null;
  // The baked display is replaced wholesale rather than re-textured: its
  // material may be anything, and its UVs are laid out for the author's
  // wallpaper.
  screenNode.visible = false;

  const buttons: THREE.Mesh[] = [];
  for (const [action, nodeName] of Object.entries(contract.buttonNodes ?? {})) {
    if (!nodeName) continue;
    const node = root.getObjectByName(nodeName);
    if (!(node instanceof THREE.Mesh)) continue;
    node.userData.buttonName = action;
    buttons.push(node);
  }

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const material = object.material;
      for (const entry of Array.isArray(material) ? material : [material]) {
        if (entry) disposables.add(entry);
      }
      if (object.geometry) disposables.add(object.geometry);
    }
  });

  return {
    group,
    screen: {
      x: screenCentre.x,
      y: screenCentre.y,
      width: screenSize.x,
      height: screenSize.y,
      z: screenBounds.max.z,
    },
    buttons,
    source: "model",
  };
}

// ── Stage ────────────────────────────────────────────────────────────

export type DeviceStageOptions = {
  readonly canvas: HTMLCanvasElement;
  readonly kind: DeviceKind;
  readonly pixelWidth?: number | undefined;
  readonly pixelHeight?: number | undefined;
  /** The 2D canvas the H.264 decoder already paints into. Used as a texture. */
  readonly screenSource: HTMLCanvasElement;
  /** Fired when the body swaps from the fallback to a loaded model. */
  readonly onSourceChange?: ((source: DeviceStageSource) => void) | undefined;
  /** Fired if the GPU drops the context; the caller should leave free look. */
  readonly onContextLost?: (() => void) | undefined;
};

export function createDeviceStage3d(options: DeviceStageOptions): DeviceStage {
  const { canvas, kind, screenSource } = options;
  const disposables = new Set<{ dispose(): void }>();
  const abort = new AbortController();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // A long lens: product renders are shot at 85mm-equivalent or longer, and a
  // wide FOV here makes the near corner of the phone balloon during a drag.
  const camera = new THREE.PerspectiveCamera(20, 1, 0.05, 40);
  camera.position.set(0, 0, 6.2);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  disposables.add(environment.texture);
  pmrem.dispose();

  // The env map does the reflecting; this only puts a definable highlight on
  // the rail so the body reads as metal while it turns.
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-1.6, 2.2, 3.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.5);
  fill.position.set(2.4, -1.2, 1.8);
  scene.add(fill);

  const deviceGroup = new THREE.Group();
  scene.add(deviceGroup);

  // The guest's pixels: unlit and untonemapped, so what ships to the encoder is
  // what the user sees. Anything else would make this pane a bad place to judge
  // the app's own colour.
  const screenTexture = new THREE.CanvasTexture(screenSource);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;
  screenTexture.generateMipmaps = false;
  disposables.add(screenTexture);

  const screenMaterial = new THREE.MeshBasicMaterial({
    map: screenTexture,
    toneMapped: false,
  });
  disposables.add(screenMaterial);
  const screenGeometry = new THREE.PlaneGeometry(1, 1);
  disposables.add(screenGeometry);
  const screenMesh = new THREE.Mesh(screenGeometry, screenMaterial);
  screenMesh.name = "modesto:screen";

  // Cover glass. Not transmissive — a real transmission pass costs a
  // render-target resolve per frame for a sheen nobody would miss. A near-
  // invisible, very smooth dielectric picks up the same env reflection.
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.035,
    transparent: true,
    opacity: 0.055,
    envMapIntensity: 1.5,
  });
  disposables.add(glassMaterial);
  const glassMesh = new THREE.Mesh(screenGeometry, glassMaterial);

  let frame: number | null = null;
  const render = () => {
    frame = null;
    // The decoder repaints the 2D canvas out of band; this is what pushes those
    // pixels to the GPU. Uploading once per render — rather than once per
    // decoded frame — coalesces bursts into the frames actually drawn.
    screenTexture.needsUpdate = true;
    renderer.render(scene, camera);
  };
  const invalidate = () => {
    if (frame !== null || abort.signal.aborted) return;
    frame = requestAnimationFrame(render);
  };

  let body: BodyBuild | null = null;
  let buttons: readonly THREE.Mesh[] = [];

  const placeScreen = (build: BodyBuild) => {
    screenMesh.scale.set(build.screen.width, build.screen.height, 1);
    screenMesh.position.set(build.screen.x, build.screen.y, build.screen.z);
    glassMesh.scale.copy(screenMesh.scale);
    glassMesh.position.copy(screenMesh.position);
    glassMesh.position.z += build.screen.width * 0.004;
  };

  const mountBody = (build: BodyBuild) => {
    if (body) {
      deviceGroup.remove(body.group);
    }
    body = build;
    buttons = build.buttons;
    deviceGroup.add(build.group);
    build.group.add(screenMesh);
    build.group.add(glassMesh);
    placeScreen(build);
    invalidate();
  };

  mountBody(buildProceduralBody(kind, options.pixelWidth, options.pixelHeight, disposables));

  // The model, if any, arrives later and replaces the drawn body in place. The
  // pane is interactive from the first frame either way.
  void buildModelBody(kind, renderer, disposables, abort.signal).then((loaded) => {
    if (!loaded || abort.signal.aborted) return;
    mountBody(loaded);
    options.onSourceChange?.("model");
  });

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    options.onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  return {
    invalidate,
    setPose(pose) {
      // YXZ: yaw about the world up, then pitch, then roll in the body's own
      // frame — the order a hand actually moves through, and the one that keeps
      // a horizontal drag horizontal after the device is already tipped.
      deviceGroup.rotation.set(pose.pitch, pose.yaw, pose.roll, "YXZ");
      invalidate();
    },
    resize(width, height) {
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Frame the device to the short axis so it never overflows the pane, with
      // headroom for the corner that swings toward the camera under rotation.
      const fitHeight = 1.16;
      const vFov = (camera.fov * Math.PI) / 180;
      const distanceForHeight = fitHeight / 2 / Math.tan(vFov / 2);
      const distanceForWidth = distanceForHeight / Math.max(camera.aspect, 0.0001);
      camera.position.z = Math.max(distanceForHeight, distanceForWidth * 0.55);
      camera.updateProjectionMatrix();
      invalidate();
    },
    hitTest(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Buttons first: they stand proud of the rail, but a grazing ray at a
      // steep angle can reach the screen plane behind one.
      const buttonHit = raycaster.intersectObjects([...buttons], false)[0];
      const screenHit = raycaster.intersectObject(screenMesh, false)[0];
      if (buttonHit && (!screenHit || buttonHit.distance <= screenHit.distance)) {
        const name = buttonHit.object.userData.buttonName;
        return typeof name === "string" ? { kind: "button", name } : null;
      }
      if (!screenHit?.uv) return null;
      // Plane UVs run bottom-up; device points run top-down.
      return { kind: "screen", u: screenHit.uv.x, v: 1 - screenHit.uv.y };
    },
    gravity() {
      // What an accelerometer at rest reports is the reaction to gravity, which
      // points along the world up. Expressed in the body's frame, that is the
      // inverse of the device's own rotation applied to +Y.
      const vector = new THREE.Vector3(0, GRAVITY_MS2, 0);
      vector.applyQuaternion(deviceGroup.quaternion.clone().invert());
      return { x: vector.x, y: vector.y, z: vector.z };
    },
    source() {
      return body?.source ?? "procedural";
    },
    dispose() {
      abort.abort();
      if (frame !== null) cancelAnimationFrame(frame);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      for (const entry of disposables) entry.dispose();
      disposables.clear();
      renderer.dispose();
    },
  };
}
