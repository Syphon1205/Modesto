/**
 * Theme-aware adaptation of React Bits' CRT Warp background.
 * Source: https://reactbits.dev/backgrounds/crt-warp
 */

import { themeColorToHex } from "../../themePalette";

const VERTEX_SHADER = `
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 resolution;
uniform float time;
uniform vec3 phosphorColor;
uniform vec3 backgroundColor;
uniform float brightness;
uniform vec2 pointer;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec2 crtCurve(vec2 uv) {
  vec2 point = (uv - 0.5) * 2.0;
  float radius = 2.78;
  float cornerScale = radius / sqrt(radius * radius - 2.0);
  point = radius * point / sqrt(max(radius * radius - dot(point, point), 0.001));
  point /= cornerScale;
  return point * 0.5 + 0.5;
}

float plasma(vec2 uv, float tick) {
  uv = (uv - 0.5) * 1.08 + 0.5;

  float scanline = 0.5 - 0.5 * cos(uv.y * 3.14159265 * 180.0);
  scanline = mix(1.0, scanline, 0.18);

  uv *= vec2(80.0, 24.0);
  uv = ceil(uv) / vec2(80.0, 24.0);

  float field = 0.0;
  field += 0.7 * sin(0.5 * uv.x + tick / 5.0);
  field += 3.0 * sin(1.6 * uv.y + tick / 5.0);
  field += sin(10.0 * (uv.y * sin(tick / 2.0) + uv.x * cos(tick / 5.0)) + tick / 2.0);

  float cx = uv.x + 0.5 * sin(tick / 2.0);
  float cy = uv.y + 0.5 * cos(tick / 4.0);
  field += 0.4 * sin(sqrt(100.0 * cx * cx + 100.0 * cy * cy + 1.0) + tick);
  field += 0.9 * sin(sqrt(75.0 * cx * cx + 25.0 * cy * cy + 1.0) + tick);
  field -= 1.4 * sin(sqrt(256.0 * cx * cx + 25.0 * cy * cy + 1.0) + tick);
  field += 0.3 * sin(0.5 * uv.y + uv.x + sin(tick));

  return scanline * floor(3.0 * (0.5 + 0.499 * sin(field * 1.05))) / 3.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 curvedUv = crtCurve(uv);
  curvedUv.x -= pointer.x * 0.018;

  float signal = plasma(curvedUv, time);
  float radius = 0.01;
  float glow = signal * 0.2;
  glow += plasma(curvedUv + vec2(radius, 0.0), time) * 0.12;
  glow += plasma(curvedUv - vec2(radius, 0.0), time) * 0.12;
  glow += plasma(curvedUv + vec2(0.0, radius), time) * 0.12;
  glow += plasma(curvedUv - vec2(0.0, radius), time) * 0.12;
  glow += plasma(curvedUv + vec2(radius), time) * 0.08;
  glow += plasma(curvedUv - vec2(radius), time) * 0.08;
  glow += plasma(curvedUv + vec2(radius, -radius), time) * 0.08;
  glow += plasma(curvedUv + vec2(-radius, radius), time) * 0.08;

  float redSignal = plasma(curvedUv + vec2(0.008, 0.0), time);
  float blueSignal = plasma(curvedUv - vec2(0.008, 0.0), time);
  vec3 channelSignal = vec3(redSignal, signal, blueSignal);
  vec3 waveColor = phosphorColor * (0.3 + signal * 0.7 + glow * 0.78);
  waveColor += (channelSignal - signal) * 0.2;

  float edge = clamp(1.0 - dot(uv - 0.5, uv - 0.5) * 2.0, 0.0, 1.0);
  float waveMask = clamp(signal * 0.82 + glow * 0.52, 0.0, 1.0);
  waveMask *= mix(0.9, 1.0, smoothstep(0.0, 1.0, edge));

  float grain = hash21(gl_FragCoord.xy + vec2(fract(time) * 173.0));
  vec3 color = mix(backgroundColor, max(waveColor * brightness, vec3(0.0)), waveMask);
  color += (grain - 0.5) * 0.025;
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

type Rgb = readonly [number, number, number];

const FALLBACK_ACCENT: Rgb = [0.31, 0.27, 0.9];
const FALLBACK_BACKGROUND: Rgb = [0.04, 0.04, 0.05];

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function themeColor(variable: string, fallback: Rgb): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  const hex = themeColorToHex(value)?.slice(1, 7);
  if (!hex) return fallback;
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

export function attachSignInCrtWarp(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl || gl.isContextLost()) return () => undefined;

  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    if (program) gl.deleteProgram(program);
    return () => undefined;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return () => undefined;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, "resolution"),
    time: gl.getUniformLocation(program, "time"),
    phosphorColor: gl.getUniformLocation(program, "phosphorColor"),
    backgroundColor: gl.getUniformLocation(program, "backgroundColor"),
    brightness: gl.getUniformLocation(program, "brightness"),
    pointer: gl.getUniformLocation(program, "pointer"),
  };

  let width = 0;
  let height = 0;
  let frame = 0;
  let visible = true;
  let running = true;
  let lastFrameAt = 0;
  const startedAt = performance.now();
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reduceMotionQuery.matches;
  const pointerTarget = { x: 0, y: 0 };
  const pointerCurrent = { x: 0, y: 0 };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const nextWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const nextHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.resolution, width, height);
  };

  const syncTheme = () => {
    const accent = themeColor("--app-theme-accent", FALLBACK_ACCENT);
    const background = themeColor("--app-theme-canvas", FALLBACK_BACKGROUND);
    gl.uniform3f(uniforms.phosphorColor, accent[0], accent[1], accent[2]);
    gl.uniform3f(uniforms.backgroundColor, background[0], background[1], background[2]);
    gl.uniform1f(
      uniforms.brightness,
      document.documentElement.classList.contains("dark") ? 1.2 : 0.9,
    );
  };

  const renderFrame = (now: number) => {
    if (!running || gl.isContextLost() || !visible || document.hidden) return;
    if (!reducedMotion && now - lastFrameAt < 1000 / 30) return;
    lastFrameAt = now;

    resize();
    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.08;
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.08;
    gl.uniform1f(uniforms.time, reducedMotion ? 0 : ((now - startedAt) / 1000) * 0.5);
    gl.uniform2f(uniforms.pointer, pointerCurrent.x, pointerCurrent.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const draw = (now: number) => {
    if (!running || reducedMotion) return;
    renderFrame(now);
    frame = window.requestAnimationFrame(draw);
  };

  const redrawStillFrame = () => {
    if (reducedMotion) renderFrame(startedAt);
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointerTarget.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointerTarget.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  };
  const onPointerLeave = () => {
    pointerTarget.x = 0;
    pointerTarget.y = 0;
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    redrawStillFrame();
  });
  resizeObserver.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    redrawStillFrame();
  });
  visibilityObserver.observe(canvas);
  const themeObserver = new MutationObserver(() => {
    syncTheme();
    redrawStillFrame();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme-id"],
  });
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerleave", onPointerLeave);
  const onReducedMotionChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
    window.cancelAnimationFrame(frame);
    if (reducedMotion) {
      renderFrame(startedAt);
      return;
    }
    lastFrameAt = 0;
    frame = window.requestAnimationFrame(draw);
  };
  reduceMotionQuery.addEventListener("change", onReducedMotionChange);

  resize();
  syncTheme();
  if (reducedMotion) renderFrame(startedAt);
  else frame = window.requestAnimationFrame(draw);

  return () => {
    running = false;
    window.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    themeObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    reduceMotionQuery.removeEventListener("change", onReducedMotionChange);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  };
}
