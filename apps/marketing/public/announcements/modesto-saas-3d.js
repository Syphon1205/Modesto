import { cursorPose, PRODUCT_END } from "./modesto-saas-demo.js";
import * as THREE from "./modesto-saas-assets/vendor/three.module.min.js";
import { RoomEnvironment } from "./modesto-saas-assets/vendor/RoomEnvironment.js";

// One renderer follows the film's clock. No separate RAF, physics clock, or per-scene WebGL contexts.
export async function create3D() {
  const stage = document.querySelector(".stage");
  const hosts = [".agent-sculpture", ".harness", ".outro", ".product", ".work-object"].map(
    (selector, index) => {
      const host = document.createElement("div");
      host.className = `three-host three-host-${index}`;
      host.setAttribute("aria-hidden", "true");
      document.querySelector(selector).append(host);
      return host;
    },
  );
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    hosts.forEach((host) => host.remove());
    return null; // The existing CSS artwork remains as the fallback.
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  const scene = new THREE.Scene();
  scene.environment = environment.texture;
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
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

  const resources = new Set();
  const own = (resource) => {
    resources.add(resource);
    return resource;
  };
  const material = (options) => own(new THREE.MeshPhysicalMaterial(options));
  const chrome = material({ color: 0xdce2d2, metalness: 0.96, roughness: 0.19, clearcoat: 1 });
  const lime = material({
    color: 0xc7ed87,
    metalness: 0.38,
    roughness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
  });
  const dark = material({ color: 0x242c20, metalness: 0.65, roughness: 0.26, clearcoat: 1 });

  function roundedShape(width, height, radius) {
    const x = -width / 2,
      y = -height / 2;
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
  function bodyGeometry(width, height, depth, radius) {
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
  async function loadImage(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  }
  await document.fonts.ready;
  // Wall order matches the DOM fallback so the 3D scene and the CSS scene read
  // the same. `accent` marks the three tiles that carry the dark case.
  const PROVIDERS = [
    { slug: "codex", label: "Codex", accent: true },
    { slug: "gemini", label: "Gemini" },
    { slug: "kilo", label: "Kilo" },
    { slug: "claude", label: "Claude", accent: true },
    { slug: "devin", label: "Devin" },
    { slug: "opencode", label: "OpenCode" },
    { slug: "qwen", label: "Qwen" },
    { slug: "cursor", label: "Cursor", accent: true },
    { slug: "poolside", label: "Poolside" },
    { slug: "grok", label: "Grok" },
    { slug: "kimi", label: "Kimi" },
    { slug: "droid", label: "Factory Droid" },
    { slug: "acp", label: "Custom ACP" },
    { slug: "copilot", label: "GitHub Copilot" },
    { slug: "pi", label: "Pi" },
  ];
  const marks = new Map(
    await Promise.all(
      PROVIDERS.map(async (provider) => [
        provider.slug,
        await loadImage(`./modesto-saas-assets/marks/${provider.slug}.svg`),
      ]),
    ),
  );
  const images = ["codex", "claude", "cursor"].map((slug) => marks.get(slug));
  const logo = await loadImage("./modesto-mark-light.svg");
  function faceTexture(index) {
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
    ctx.save();
    ctx.filter = index === 1 ? "brightness(0) invert(1)" : "brightness(0)";
    ctx.drawImage(images[index], 68, 65, 190, 190);
    ctx.restore();
    ctx.fillStyle = ink;
    ctx.font = "600 77px Manrope";
    ctx.fillText(["Codex", "Claude", "Cursor"][index], 68, 370);
    ctx.globalAlpha = 0.62;
    ctx.font = "500 23px Manrope";
    ctx.fillText(["READY TO BUILD", "READY TO THINK", "READY TO SHIP"][index], 72, 420);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(70, 810, 628, 1);
    ctx.font = "500 21px Manrope";
    ctx.fillText("MODESTO / AGENT 0" + (index + 1), 72, 865);
    ctx.globalAlpha = 1;
    const texture = own(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const intro = new THREE.Group();
  scene.add(intro);
  const cases = [lime, dark, chrome];
  const cards = images.map((_, index) => {
    const card = new THREE.Group();
    card.add(new THREE.Mesh(bodyGeometry(1.83, 2.3, 0.14, 0.16), cases[index]));
    const front = new THREE.Mesh(
      own(new THREE.PlaneGeometry(1.82, 2.29)),
      own(
        new THREE.MeshBasicMaterial({
          map: faceTexture(index),
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    front.position.z = 0.12;
    card.add(front);
    // An inset rear panel and a polished edge reveal the physical thickness on camera moves.
    const rear = new THREE.Mesh(bodyGeometry(1.55, 2.02, 0.025, 0.13), cases[index]);
    rear.position.z = -0.12;
    card.add(rear);
    intro.add(card);
    return card;
  });
  const orbitGeometry = own(new THREE.TorusGeometry(2.6, 0.012, 8, 100));
  const introOrbit = new THREE.Mesh(orbitGeometry, chrome);
  introOrbit.rotation.set(0.8, 0.35, -0.4);
  introOrbit.position.z = -0.7;
  intro.add(introOrbit);

  const harness = new THREE.Group();
  scene.add(harness);
  const TILE = { width: 1.72, height: 1.28, depth: 0.17, corner: 0.2, stacked: true };
  const glass = material({
    color: 0xdcebd6,
    metalness: 0.05,
    roughness: 0.08,
    transmission: 0.65,
    thickness: 0.3,
    ior: 1.45,
    transparent: true,
    opacity: 0.18,
    clearcoat: 1,
    depthWrite: false,
  });
  const plaqueGeometry = bodyGeometry(TILE.width, TILE.height, TILE.depth, TILE.corner);
  const plaqueFace = own(new THREE.PlaneGeometry(TILE.width - 0.01, TILE.height - 0.01));
  const FACE_SCALE = 260; // texture pixels per world unit
  function plaqueTexture(provider) {
    const canvas = document.createElement("canvas");
    const width = Math.round(TILE.width * FACE_SCALE);
    const height = Math.round(TILE.height * FACE_SCALE);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const corner = TILE.corner * FACE_SCALE * 1.55;
    const wash = ctx.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, "#ffffff26");
    wash.addColorStop(0.45, "#ffffff03");
    wash.addColorStop(1, "#cce9b918");
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, corner);
    ctx.fill();
    ctx.strokeStyle = "#ffffff70";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(3, 3, width - 6, height - 6, corner - 2);
    ctx.stroke();
    const markSize = Math.round((TILE.stacked ? 0.49 : 0.56) * height);
    ctx.save();
    ctx.filter = "brightness(0) invert(1)";
    ctx.drawImage(
      marks.get(provider.slug),
      TILE.stacked ? (width - markSize) / 2 : Math.round(height * 0.28),
      TILE.stacked ? Math.round(height * 0.16) : (height - markSize) / 2,
      markSize,
      markSize,
    );
    ctx.restore();
    ctx.fillStyle = "#f2f5ea";
    if (TILE.stacked) {
      ctx.textAlign = "center";
      ctx.font = `600 ${Math.round(height * 0.115)}px Manrope`;
      ctx.fillText(provider.label, width / 2, Math.round(height * 0.79), width * 0.88);
    } else {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(height * 0.3)}px Manrope`;
      ctx.fillText(
        provider.label,
        Math.round(height * 0.28) + markSize + Math.round(height * 0.26),
        height / 2 + 2,
        width * 0.62,
      );
    }
    const texture = own(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const plaques = PROVIDERS.map((provider) => {
    const tile = new THREE.Group();
    tile.add(new THREE.Mesh(plaqueGeometry, glass));
    const face = new THREE.Mesh(
      plaqueFace,
      own(
        new THREE.MeshBasicMaterial({
          map: plaqueTexture(provider),
          transparent: true,
          toneMapped: false,
        }),
      ),
    );
    face.position.z = 0.15;
    tile.add(face);
    harness.add(tile);
    return tile;
  });
  // Project the tilted orbit around a protected opening for the headline.
  // Compensating position for depth prevents foreground logos cropping at the edges.
  let arcCache;
  function orbitAngle(fraction, rx, ry) {
    if (!arcCache || arcCache.rx !== rx || arcCache.ry !== ry) {
      const lengths = [0];
      let lastX = rx,
        lastY = 0;
      for (let i = 1; i <= 256; i++) {
        const a = (i / 256) * Math.PI * 2,
          x = rx * Math.cos(a),
          y = ry * Math.sin(a);
        lengths.push(lengths[i - 1] + Math.hypot(x - lastX, y - lastY));
        lastX = x;
        lastY = y;
      }
      arcCache = { rx, ry, lengths };
    }
    const lengths = arcCache.lengths,
      target = (((fraction % 1) + 1) % 1) * lengths[256];
    let lo = 0,
      hi = 256;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < target) lo = mid;
      else hi = mid;
    }
    return ((lo + (target - lengths[lo]) / (lengths[hi] - lengths[lo])) / 256) * Math.PI * 2;
  }
  function layoutHarness(time, aspect) {
    const visibleHeight = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const visibleWidth = visibleHeight * aspect;
    const portrait = aspect < 0.7;
    const rx = visibleWidth * (portrait ? 0.365 : 0.395);
    const ry = visibleHeight * (portrait ? 0.31 : 0.285);
    const size = Math.min(
      (visibleWidth * (portrait ? 0.14 : 0.089)) / TILE.width,
      (visibleHeight * 0.17) / TILE.height,
    );
    const local = time - 5.5;
    const spin = -0.6 + local * 0.115;
    const roll = portrait ? -0.055 : -0.12;
    const cos = Math.cos(roll),
      sin = Math.sin(roll);
    plaques.forEach((tile, index) => {
      const progress = Math.min(1, Math.max(0, (local - index * 0.032) / 1));
      const arrive = 1 - Math.pow(1 - progress, 3);
      const angle = orbitAngle(spin / (Math.PI * 2) + index / plaques.length, rx, ry);
      const depth = Math.sin(angle);
      const z = depth * 0.65 - (1 - arrive) * 5;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      const projection = (camera.position.z - z) / camera.position.z;
      tile.position.set((x * cos - y * sin) * projection, (x * sin + y * cos) * projection, z);
      tile.scale.setScalar(size * (0.2 + arrive * 0.8) * (1 + depth * 0.06));
      tile.visible = progress > 0.015;
      tile.lookAt(camera.position);
      tile.rotateY(-Math.cos(angle) * 0.23);
      tile.rotateX(depth * 0.12);
      tile.rotateZ(roll * 0.35);
    });
  }
  const nucleus = new THREE.Group();
  nucleus.add(new THREE.Mesh(bodyGeometry(1.05, 1.05, 0.4, 0.23), lime));
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = logoCanvas.height = 256;
  const logoCtx = logoCanvas.getContext("2d");
  logoCtx.filter = "brightness(0)";
  logoCtx.drawImage(logo, 22, 22, 212, 212);
  const logoTexture = own(new THREE.CanvasTexture(logoCanvas));
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const logoPlate = new THREE.Mesh(
    own(new THREE.PlaneGeometry(0.87, 0.87)),
    own(new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true })),
  );
  logoPlate.position.z = 0.252;
  nucleus.add(logoPlate);

  const outro = new THREE.Group();
  scene.add(outro);
  const knot = new THREE.Mesh(own(new THREE.TorusKnotGeometry(1.18, 0.32, 180, 24, 2, 3)), chrome);
  outro.add(knot);
  const innerKnot = new THREE.Mesh(
    own(new THREE.TorusKnotGeometry(1.18, 0.1, 160, 12, 2, 3)),
    lime,
  );
  innerKnot.scale.setScalar(1.32);
  outro.add(innerKnot);
  const cursor = new THREE.Group();
  const cursorShape = new THREE.Shape();
  cursorShape.moveTo(0, 0);
  [
    [0.04, 0.94],
    [0.3, 0.69],
    [0.54, 1.13],
    [0.73, 1.02],
    [0.48, 0.62],
    [0.91, 0.56],
  ].forEach(([x, y]) => cursorShape.lineTo(x, y));
  cursorShape.closePath();
  const cursorGeometry = own(
    new THREE.ExtrudeGeometry(cursorShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 4,
      steps: 1,
    }),
  );
  const enamel = material({
    color: 0xf6f7f1,
    emissive: 0xadb4bc,
    emissiveIntensity: 0.2,
    metalness: 0.1,
    roughness: 0.22,
    clearcoat: 1,
    transparent: true,
  });
  const cursorEdge = material({
    color: 0x8b9aab,
    metalness: 0.8,
    roughness: 0.18,
    transparent: true,
  });
  const pointer = new THREE.Mesh(cursorGeometry, [enamel, cursorEdge]);
  cursor.add(pointer);
  scene.add(cursor);
  const cursorCamera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000);
  cursorCamera.position.z = 300;
  const cursorTargets = new Map();
  // Brackets close around the Modesto core as the submitted work takes shape.
  const work = new THREE.Group();
  const bracketShape = new THREE.Shape();
  bracketShape.moveTo(0.35, 1);
  [
    [-0.5, 0],
    [0.35, -1],
    [0.62, -0.76],
    [-0.02, 0],
    [0.62, 0.76],
  ].forEach(([x, y]) => bracketShape.lineTo(x, y));
  bracketShape.closePath();
  const bracketGeometry = own(
    new THREE.ExtrudeGeometry(bracketShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSize: 0.055,
      bevelThickness: 0.055,
      bevelSegments: 5,
      steps: 1,
    }),
  );
  const leftBracket = new THREE.Mesh(bracketGeometry, chrome);
  const rightBracket = new THREE.Mesh(bracketGeometry, chrome);
  rightBracket.rotation.z = Math.PI;
  const workCore = nucleus.clone();
  workCore.scale.setScalar(0.85);
  work.add(leftBracket, rightBracket, workCore);
  scene.add(work);
  const groups = [intro, harness, outro, cursor, work];
  let active = -1;
  let lastTime = 0;
  let width = 0,
    height = 0;
  let contextLost = false;
  function draw(time) {
    lastTime = time;
    const index = time < 5.5 ? 0 : time < 10.3 ? 1 : time >= PRODUCT_END ? 2 : time >= 18.7 ? 4 : 3;
    if (index < 0 || contextLost) {
      renderer.domElement.style.visibility = "hidden";
      return;
    }
    renderer.domElement.style.visibility = "visible";
    if (active !== index) {
      active = index;
      hosts[index].append(renderer.domElement);
      groups.forEach((group, i) => {
        group.visible = i === index;
      });
    }
    const host = hosts[index];
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    if (width !== w || height !== h) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    camera.position.set(0, 0, index === 0 ? 9.6 : index === 2 ? 8.7 : 7.6);
    // Fit on the short axis so vertical, square, and landscape crops remain composed.
    camera.position.z *= Math.max(1, 1 / camera.aspect);
    camera.lookAt(0, 0, 0);
    if (index === 1) layoutHarness(time, camera.aspect);
    if (index === 0) {
      const arrive = 1 - Math.pow(1 - Math.min(1, Math.max(0, time / 1.6)), 3);
      intro.scale.setScalar(0.82 + arrive * 0.18);
      intro.rotation.y = Math.sin(time * 0.38) * 0.17 - 0.08;
      const poses = [
        [-0.55, 0.98, -0.42, -0.23],
        [0.95, 0.05, 0.05, 0.15],
        [-0.65, -0.92, 0.65, -0.15],
      ];
      cards.forEach((card, i) => {
        const [x, y, z, angle] = poses[i];
        card.position.set(
          x,
          y + Math.sin(time * 0.8 + i * 1.5) * 0.08 - (1 - arrive) * (1 + i * 0.4),
          z,
        );
        card.rotation.set(
          0.1 + Math.sin(time * 0.45 + i) * 0.08,
          [-0.36, -0.4, 0.33][i] + Math.sin(time * 0.5 + i) * 0.1,
          angle,
        );
      });
      introOrbit.rotation.z = -0.4 + time * 0.055;
    } else if (index === 2) {
      const t = time - PRODUCT_END;
      outro.rotation.set(0.3 + t * 0.06, 0.5 + t * 0.18, -0.35);
      outro.position.y = Math.sin(t * 0.65) * 0.08;
      innerKnot.rotation.y = t * -0.08;
    }
    if (index === 4) {
      const t = time - 18.7;
      const assemble = 1 - Math.pow(1 - Math.min(1, t / 1.5), 3);
      const spread = 1.15 + (1 - assemble) * 1.25;
      leftBracket.position.set(-spread, 0.08, 0.1);
      rightBracket.position.set(spread, -0.08, -0.1);
      leftBracket.rotation.y = (1 - assemble) * -0.8;
      rightBracket.rotation.y = (1 - assemble) * 0.8;
      work.rotation.set(0.25, -0.6 + Math.sin(t * 0.4) * 0.12, -0.16);
      work.scale.setScalar(0.72 + assemble * 0.28);
      workCore.rotation.y = Math.sin(t * 0.7) * 0.17;
      workCore.position.y = Math.sin(t * 1.1) * 0.055;
    }
    if (index === 3) {
      const base = host.getBoundingClientRect();
      const pose = cursorPose(time, (selector) => {
        if (!cursorTargets.has(selector))
          cursorTargets.set(selector, document.querySelector(selector));
        const rect = cursorTargets.get(selector).getBoundingClientRect();
        return {
          x: rect.left - base.left,
          y: rect.top - base.top,
          width: rect.width,
          height: rect.height,
        };
      });
      cursorCamera.right = w;
      cursorCamera.bottom = h;
      cursorCamera.updateProjectionMatrix();
      const size = w * (w / h < 0.7 ? 0.065 : w / h < 1.1 ? 0.046 : 0.032);
      cursor.position.set(pose.x, pose.y, 0);
      cursor.scale.setScalar(size * pose.scale);
      pointer.rotation.set(0.22, -0.4 + pose.tilt * 0.15, -0.05);
      enamel.opacity = pose.opacity;
      cursorEdge.opacity = pose.opacity;
      renderer.render(scene, cursorCamera);
    } else renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(() => draw(lastTime));
  hosts.forEach((host) => observer.observe(host));
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    stage.classList.remove("has-three");
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    stage.classList.add("has-three");
    draw(lastTime);
  });
  function dispose() {
    observer.disconnect();
    resources.forEach((resource) => resource.dispose());
    environment.dispose();
    renderer.dispose();
  }
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) dispose();
    },
    { once: true },
  );
  stage.classList.add("has-three");
  return { draw };
}
