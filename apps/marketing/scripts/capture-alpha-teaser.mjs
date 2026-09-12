#!/usr/bin/env bun
/**
 * Deterministic teaser capture: Playwright seeks `window.__setTime`,
 * screenshots `.stage`, and ffmpeg encodes a silent H.264 MP4.
 *
 * CLI:
 *   bun apps/marketing/scripts/capture-alpha-teaser.mjs \
 *     --file working.html --ratio 16x9 --theme dark --duration 12 \
 *     --filename modesto-alpha-thinking-16x9-dark.mp4
 *
 * Preview Download talks to `--serve` (default port 4175) or the Vite
 * middleware mounted at `/__teaser-capture` during `astro dev`.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARKETING = path.resolve(HERE, "..");
const REPO = path.resolve(MARKETING, "../..");
const TEASER_DIR = path.join(MARKETING, "public/announcements/alpha-teasers");
const EXPORT_DIR = path.join(TEASER_DIR, "exports");
const SIZES = {
  "16x9": [1920, 1080],
  "9x16": [1080, 1920],
  "1x1": [1080, 1080],
};
const FPS = 30;
const FILENAME_RE = /^modesto-alpha-[a-z0-9][a-z0-9.-]*\.mp4$/;
const FILE_RE = /^[a-z0-9][a-z0-9.-]*\.html$/;

function arg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

async function loadPlaywright() {
  const candidates = [
    path.join(REPO, "packages/shared/node_modules/playwright-core/index.mjs"),
    path.join(REPO, "apps/desktop/node_modules/playwright-core/index.mjs"),
    path.join(REPO, "node_modules/playwright-core/index.mjs"),
  ];
  for (const candidate of candidates) {
    try {
      return await import(pathToFileURL(candidate).href);
    } catch {
      // try next
    }
  }
  throw new Error("playwright-core is not installed");
}

function chromeLaunchOptions() {
  const executablePath =
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return { channel: "chrome", executablePath, headless: true };
}

function originFromEnv() {
  const port = process.env.PORT ?? "4173";
  return process.env.TEASER_ORIGIN ?? `http://localhost:${port}`;
}

export function exportPathFor(filename) {
  return path.join(EXPORT_DIR, filename);
}

export async function captureTeaser(options) {
  const {
    file,
    ratio,
    theme = "dark",
    duration,
    filename,
    origin = originFromEnv(),
    onProgress = () => undefined,
  } = options;
  if (!FILE_RE.test(file)) throw new Error("Invalid film file");
  if (!SIZES[ratio]) throw new Error("Invalid ratio");
  if (theme !== "dark" && theme !== "light") throw new Error("Invalid theme");
  if (!Number.isFinite(duration) || duration < 1 || duration > 40) {
    throw new Error("Invalid duration");
  }
  if (!FILENAME_RE.test(filename)) throw new Error("Invalid filename");

  await mkdir(EXPORT_DIR, { recursive: true });
  const output = exportPathFor(filename);
  try {
    const existing = await stat(output);
    if (existing.size > 1024) {
      onProgress({ phase: "cached", current: 1, total: 1, filename });
      return output;
    }
  } catch {
    // capture
  }

  const [width, height] = SIZES[ratio];
  const frames = Math.round(duration * FPS);
  const { chromium } = await loadPlaywright();
  onProgress({ phase: "launch", current: 0, total: frames, filename });

  let browser;
  try {
    try {
      browser = await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      browser = await chromium.launch(chromeLaunchOptions());
    }
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const themeQuery = theme === "light" ? "&theme=light" : "&theme=dark";
    const url = `${origin}/announcements/alpha-teasers/${file}?ratio=${ratio}${themeQuery}&paused=1&record=1`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => typeof window.__ready !== "undefined", null, {
      timeout: 20_000,
    });
    await page.evaluate(() => window.__ready);
    await page.waitForFunction(() => typeof window.__setTime === "function");

    onProgress({ phase: "encoding", current: 0, total: frames, filename });

    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-framerate",
        String(FPS),
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-movflags",
        "+faststart",
        "-preset",
        "fast",
        "-crf",
        "18",
        output,
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    const ffmpegErrors = [];
    ffmpeg.stderr.on("data", (chunk) => ffmpegErrors.push(chunk));
    const ffmpegDone = new Promise((resolve, reject) => {
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(Buffer.concat(ffmpegErrors).toString() || `ffmpeg exited ${code}`));
      });
    });

    for (let index = 0; index < frames; index += 1) {
      const time = Math.min(duration - 0.001, index / FPS);
      await page.evaluate((value) => window.__setTime(value), time);
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }),
      );
      const png = await page.locator(".stage").screenshot({ type: "png" });
      if (!ffmpeg.stdin.write(png)) {
        await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve));
      }
      if (index === 0 || index === frames - 1 || index % 8 === 0) {
        onProgress({ phase: "encoding", current: index + 1, total: frames, filename });
      }
    }
    ffmpeg.stdin.end();
    await ffmpegDone;
    onProgress({ phase: "done", current: frames, total: frames, filename });
    return output;
  } finally {
    await browser?.close();
  }
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createCaptureHandler({ origin } = {}) {
  let queue = Promise.resolve();
  return async function handleCapture(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }
    if (req.method !== "GET") {
      res.writeHead(405, corsHeaders());
      res.end("Method not allowed");
      return;
    }

    const file = url.searchParams.get("file") ?? "";
    const ratio = url.searchParams.get("ratio") ?? "";
    const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
    const duration = Number(url.searchParams.get("duration"));
    const filename = url.searchParams.get("filename") ?? "";

    res.writeHead(200, {
      ...corsHeaders(),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    queue = queue.then(async () => {
      try {
        sendSse(res, "progress", { phase: "queued", current: 0, total: 1, filename });
        await captureTeaser({
          file,
          ratio,
          theme,
          duration,
          filename,
          origin: origin ?? originFromEnv(),
          onProgress: (progress) => sendSse(res, "progress", progress),
        });
        sendSse(res, "done", {
          filename,
          href: `/announcements/alpha-teasers/exports/${filename}`,
        });
      } catch (error) {
        sendSse(res, "error", { message: error instanceof Error ? error.message : String(error) });
      } finally {
        res.end();
      }
    });
    await queue;
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

export function teaserCaptureVitePlugin() {
  return {
    name: "modesto-teaser-capture",
    configureServer(server) {
      const handle = createCaptureHandler({
        origin: `http://localhost:${server.config.server.port ?? 4173}`,
      });
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__teaser-capture")) return next();
        handle(req, res).catch((error) => {
          res.statusCode = 500;
          res.end(String(error));
        });
      });
    },
  };
}

function parseCli() {
  return {
    file: arg("--file"),
    ratio: arg("--ratio", "16x9"),
    theme: arg("--theme", "dark"),
    duration: Number(arg("--duration", "12")),
    filename: arg("--filename"),
    serve: process.argv.includes("--serve"),
    port: Number(arg("--port", "4175")),
  };
}

if (import.meta.main) {
  const options = parseCli();
  if (options.serve) {
    const handle = createCaptureHandler();
    const server = http.createServer((req, res) => {
      if (!req.url || req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Modesto teaser capture");
        return;
      }
      if (!req.url.startsWith("/capture")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      handle(req, res);
    });
    server.listen(options.port, "127.0.0.1", () => {
      console.log(`Teaser capture on http://127.0.0.1:${options.port}/capture`);
    });
  } else {
    if (!options.file || !options.filename) {
      console.error("Need --file and --filename");
      process.exit(1);
    }
    const output = await captureTeaser({
      ...options,
      onProgress: (progress) => {
        if (progress.phase === "encoding") {
          process.stdout.write(`\r${progress.current}/${progress.total} ${progress.filename}`);
        }
      },
    });
    console.log(`\nWrote ${output}`);
  }
}
