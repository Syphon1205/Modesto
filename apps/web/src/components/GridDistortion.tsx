// FILE: GridDistortion.tsx
// Purpose: React Bits Grid Distortion — a dotted field that warps under the
//          cursor. Ported to `ogl` (already in the web app) instead of three.
//          https://reactbits.dev/backgrounds/grid-distortion
// Layer: Shared UI

import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { useEffect, useRef } from "react";

import { useTheme } from "~/hooks/useTheme";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { cn } from "~/lib/utils";

const DOT_GAP_PX = 13;
const DEFAULT_GRID = 15;
const DEFAULT_MOUSE = 0.12;
const DEFAULT_STRENGTH = 0.15;
const DEFAULT_RELAXATION = 0.9;

const VERTEX = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uDataTexture;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 offset = texture(uDataTexture, vUv).rg - 0.5;
  fragColor = texture(uTexture, vUv - 0.32 * offset);
}
`;

function readCssColor(property: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${property})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value && value !== "rgba(0, 0, 0, 0)" ? value : fallback;
}

function paintDotGrid(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.floor(width * dpr));
  const pixelHeight = Math.max(1, Math.floor(height * dpr));
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const background = readCssColor("--background", "#09090b");
  const foreground = readCssColor("--foreground", "#fafafa");
  const line = readCssColor("--border", foreground);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  const gap = DOT_GAP_PX * dpr;
  ctx.strokeStyle = line;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, dpr * 0.7);
  ctx.beginPath();
  for (let x = gap / 2; x < pixelWidth; x += gap) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, pixelHeight);
  }
  for (let y = gap / 2; y < pixelHeight; y += gap) {
    ctx.moveTo(0, y);
    ctx.lineTo(pixelWidth, y);
  }
  ctx.stroke();

  ctx.fillStyle = foreground;
  ctx.globalAlpha = 0.7;
  const radius = Math.max(1, 0.9 * dpr);
  for (let y = gap / 2; y < pixelHeight; y += gap) {
    for (let x = gap / 2; x < pixelWidth; x += gap) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function GridDistortion({
  className,
  grid = DEFAULT_GRID,
  mouse = DEFAULT_MOUSE,
  strength = DEFAULT_STRENGTH,
  relaxation = DEFAULT_RELAXATION,
}: {
  readonly className?: string;
  readonly grid?: number;
  readonly mouse?: number;
  readonly strength?: number;
  readonly relaxation?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { resolvedTheme, theme, themeHalves } = useTheme();

  useEffect(() => {
    if (reduceMotion) return;
    const container = containerRef.current;
    if (!container) return;

    let renderer: InstanceType<typeof Renderer>;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        depth: false,
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    const gridCanvas = document.createElement("canvas");
    const imageTexture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    const size = Math.max(4, Math.floor(grid));
    const data = new Float32Array(4 * size * size);
    const packed = new Uint8Array(4 * size * size);

    const packDisplacement = () => {
      for (let i = 0; i < size * size; i++) {
        packed[i * 4] = Math.min(255, Math.max(0, (data[i * 4] ?? 0) + 128));
        packed[i * 4 + 1] = Math.min(255, Math.max(0, (data[i * 4 + 1] ?? 0) + 128));
        packed[i * 4 + 2] = 0;
        packed[i * 4 + 3] = 255;
      }
    };
    packDisplacement();

    const dataTexture = new Texture(gl, {
      image: packed,
      width: size,
      height: size,
      generateMipmaps: false,
      flipY: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      cullFace: false,
      depthTest: false,
      transparent: true,
      uniforms: {
        uTexture: { value: imageTexture },
        uDataTexture: { value: dataTexture },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const mouseState = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0, inside: false };

    const paintImage = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      paintDotGrid(gridCanvas, width, height);
      imageTexture.image = gridCanvas;
      imageTexture.needsUpdate = true;
      renderer.setSize(width, height);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) {
        mouseState.inside = false;
        mouseState.vX = 0;
        mouseState.vY = 0;
        return;
      }
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
      mouseState.vX = x - mouseState.prevX;
      mouseState.vY = y - mouseState.prevY;
      mouseState.x = x;
      mouseState.y = y;
      mouseState.prevX = x;
      mouseState.prevY = y;
      mouseState.inside = true;
    };

    const handlePointerLeave = () => {
      mouseState.inside = false;
      mouseState.vX = 0;
      mouseState.vY = 0;
    };

    let raf = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;

    const step = () => {
      for (let i = 0; i < size * size; i++) {
        data[i * 4] = (data[i * 4] ?? 0) * relaxation;
        data[i * 4 + 1] = (data[i * 4 + 1] ?? 0) * relaxation;
      }

      if (mouseState.inside) {
        const gridMouseX = size * mouseState.x;
        const gridMouseY = size * mouseState.y;
        const maxDist = size * mouse;
        const maxDistSq = maxDist * maxDist;
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            const distSq = (gridMouseX - i) ** 2 + (gridMouseY - j) ** 2;
            if (distSq >= maxDistSq) continue;
            const index = 4 * (i + size * j);
            const power = Math.min(maxDist / Math.sqrt(Math.max(distSq, 0.0001)), 10);
            data[index] = (data[index] ?? 0) + strength * 420 * mouseState.vX * power;
            data[index + 1] = (data[index + 1] ?? 0) - strength * 420 * mouseState.vY * power;
          }
        }
      }

      packDisplacement();
      dataTexture.needsUpdate = true;
      renderer.render({ scene: mesh, frustumCull: false });
    };

    const loop = () => {
      step();
      raf = requestAnimationFrame(loop);
    };

    const tryStart = () => {
      if (isVisible && isPageVisible && raf === 0) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
      if (isVisible) tryStart();
      else stop();
    });
    observer.observe(container);

    const onVisibility = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) tryStart();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver = new ResizeObserver(paintImage);
    resizeObserver.observe(container);
    paintImage();
    step();

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    tryStart();

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      delete imageTexture.image;
      canvas.remove();
      renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [grid, mouse, reduceMotion, relaxation, resolvedTheme, strength, theme, themeHalves]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={
        reduceMotion
          ? {
              backgroundImage:
                "radial-gradient(color-mix(in srgb, var(--foreground) 22%, transparent) 0.5px, transparent 0.5px)",
              backgroundSize: `${DOT_GAP_PX}px ${DOT_GAP_PX}px`,
            }
          : undefined
      }
    />
  );
}
