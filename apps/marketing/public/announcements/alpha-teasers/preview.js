(() => {
  const teasers = window.MODESTO_TEASERS ?? [];
  const film = document.getElementById("film");
  const play = document.getElementById("play");
  const seek = document.getElementById("seek");
  const tabs = document.getElementById("tabs");
  const chapters = document.getElementById("chapters");
  const formats = [...document.querySelectorAll(".formats button[data-ratio]")];
  const themeButtons = [...document.querySelectorAll(".themes button[data-theme]")];
  const themes = document.getElementById("themes");
  const base = document.body.dataset.teaserBase || "./";
  const title = document.getElementById("film-title");
  const blurb = document.getElementById("film-blurb");
  const kicker = document.getElementById("film-kicker");
  const formatLabel = document.getElementById("format-label");
  const durationLabel = document.getElementById("duration-label");
  const elapsed = document.getElementById("elapsed");
  const remaining = document.getElementById("remaining");
  const open = document.getElementById("open");
  const error = document.getElementById("error");
  const exportButton = document.getElementById("export");
  const exportStatus = document.getElementById("export-status");

  const params = new URLSearchParams(location.search);
  let current = teasers.find((item) => item.id === params.get("film")) ?? teasers[0];
  let ratio = ["16x9", "9x16", "1x1"].includes(params.get("ratio")) ? params.get("ratio") : "16x9";
  let theme = params.get("theme") === "light" ? "light" : "dark";
  let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let time = 0;
  let ready = false;
  let loadTimeout;

  function hasThemes() {
    return Array.isArray(current.themes) && current.themes.length > 1;
  }

  function filmUrl(extra = "") {
    const themeQuery = hasThemes() ? `&theme=${theme}` : "";
    return `${base}${current.file}?ratio=${ratio}&embed=1${themeQuery}${extra}`;
  }

  function formatClock(value) {
    const seconds = Math.max(0, Math.floor(value));
    return `00:${String(seconds).padStart(2, "0")}`;
  }

  function downloadFilename() {
    const slug = current.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const themeBit = hasThemes() ? `-${theme}` : "";
    return `modesto-alpha-${slug}-${ratio}${themeBit}.mp4`;
  }

  function setExportStatus(message) {
    if (exportStatus) exportStatus.textContent = message;
  }

  async function openCapture(query) {
    const endpoints = [`/__teaser-capture?${query}`, `http://127.0.0.1:4175/capture?${query}`];
    let lastError;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        if (response.ok && response.body) return response;
        lastError = new Error(`${endpoint} returned ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Capture server unavailable");
  }

  async function readSse(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        let eventName = "message";
        let data = "";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) data = line.slice(5).trim();
        }
        if (data) onEvent(eventName, JSON.parse(data));
      }
    }
  }

  async function saveFile(href, filename) {
    const response = await fetch(href);
    if (!response.ok) throw new Error(`Could not fetch ${filename}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function downloadFilm() {
    if (!exportButton || exportButton.dataset.busy === "true") return;
    const filename = downloadFilename();
    const query = new URLSearchParams({
      file: current.file,
      ratio,
      theme: hasThemes() ? theme : "dark",
      duration: String(current.duration),
      filename,
    });
    exportButton.dataset.busy = "true";
    exportButton.disabled = true;
    setExportStatus(`Encoding ${filename}…`);
    try {
      const cached = `./exports/${filename}`;
      const existing = await fetch(cached, { method: "HEAD" });
      if (existing.ok) {
        await saveFile(cached, filename);
        setExportStatus(`Saved ${filename}`);
        return;
      }
      let result;
      await readSse(await openCapture(query.toString()), (eventName, data) => {
        if (eventName === "progress") {
          if (data.phase === "cached") setExportStatus(`Using cached ${filename}`);
          else if (data.phase === "launch") setExportStatus("Opening film…");
          else if (data.total) {
            const percent = Math.round((data.current / data.total) * 100);
            setExportStatus(`Encoding ${percent}% · ${data.current}/${data.total} frames`);
          }
        }
        if (eventName === "done") result = data;
        if (eventName === "error") throw new Error(data.message || "Capture failed");
      });
      if (!result?.href) throw new Error("Capture did not return a file");
      await saveFile(result.href, filename);
      setExportStatus(`Saved ${filename}`);
    } catch (error) {
      setExportStatus(error?.message ?? "Download failed.");
    } finally {
      exportButton.dataset.busy = "false";
      exportButton.disabled = false;
    }
  }

  function send(action, extra = {}) {
    if (ready) {
      film.contentWindow.postMessage(
        { type: "modesto:control", action, ...extra },
        location.origin,
      );
    }
  }

  function watchLoad() {
    ready = false;
    document.querySelectorAll(".controls button, .controls input, .chapter").forEach((control) => {
      control.disabled = true;
    });
    if (error) error.hidden = true;
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (!ready && error) error.hidden = false;
    }, 15000);
  }

  function renderTabs() {
    tabs.innerHTML = teasers
      .map(
        (item) => `
        <button type="button" role="tab" aria-selected="${item.id === current.id}" data-film="${item.id}">
          ${item.title}
          <small>${item.style}</small>
        </button>`,
      )
      .join("");
    tabs.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectFilm(button.dataset.film));
    });
  }

  function renderChapters() {
    chapters.innerHTML = current.chapters
      .map(
        (chapter, index) => `
        <button class="chapter" type="button" data-time="${chapter.time}" aria-pressed="${index === 0}">
          <span class="top"><span>${current.kicker}</span><span>${chapter.clock}</span></span>
          <strong>${chapter.label}</strong>
        </button>`,
      )
      .join("");
    chapters.querySelectorAll(".chapter").forEach((button) => {
      button.addEventListener("click", () => send("seek", { time: Number(button.dataset.time) }));
    });
  }

  function syncChrome() {
    title.textContent = current.title;
    blurb.textContent = current.blurb;
    kicker.textContent = `${current.kicker} · ${current.style.toUpperCase()}`;
    durationLabel.textContent = `${current.duration} SECONDS · SILENT · GSAP`;
    seek.max = String(current.duration - 0.01);
    remaining.textContent = formatClock(current.duration);
    open.href = hasThemes()
      ? `${base}${current.file}?ratio=${ratio}&theme=${theme}`
      : `${base}${current.file}?ratio=${ratio}`;
    document.querySelector(".stage-well").dataset.ratio = ratio;
    document.querySelector(".stage-well").dataset.theme = hasThemes() ? theme : "dark";
    formatLabel.textContent = {
      "16x9": "LANDSCAPE · 1920 × 1080",
      "9x16": "VERTICAL · 1080 × 1920",
      "1x1": "SQUARE · 1080 × 1080",
    }[ratio];
    formats.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.ratio === ratio));
    });
    if (themes) {
      themes.hidden = !hasThemes();
      themeButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
      });
    }
    const next = new URL(location.href);
    next.searchParams.set("film", current.id);
    next.searchParams.set("ratio", ratio);
    if (hasThemes()) next.searchParams.set("theme", theme);
    else next.searchParams.delete("theme");
    history.replaceState(null, "", next);
  }

  function loadFilm() {
    syncChrome();
    renderTabs();
    renderChapters();
    watchLoad();
    film.src = filmUrl(`&t=${time.toFixed(3)}&paused=${playing ? "0" : "1"}`);
  }

  function selectFilm(id) {
    const next = teasers.find((item) => item.id === id);
    if (!next || next.id === current.id) return;
    current = next;
    time = 0;
    loadFilm();
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== film.contentWindow) return;
    if (event.data?.type === "modesto:ready") {
      ready = true;
      clearTimeout(loadTimeout);
      if (error) error.hidden = true;
      document
        .querySelectorAll(".controls button, .controls input, .chapter")
        .forEach((control) => {
          control.disabled = false;
        });
    }
    if (event.data?.type !== "modesto:state") return;
    time = event.data.time;
    playing = event.data.playing;
    seek.value = String(time);
    elapsed.textContent = formatClock(time);
    play.textContent = playing ? "Ⅱ  Pause" : "▶  Play";
    play.setAttribute("aria-label", playing ? "Pause film" : "Play film");
    const scene = event.data.scene ?? 0;
    chapters.querySelectorAll(".chapter").forEach((chapter, index) => {
      chapter.setAttribute("aria-pressed", String(index === scene));
    });
  });

  play.addEventListener("click", () => send(playing ? "pause" : "play"));
  document.getElementById("replay").addEventListener("click", () => send("restart"));
  seek.addEventListener("input", () => send("seek", { time: Number(seek.value) }));
  formats.forEach((button) => {
    button.addEventListener("click", () => {
      if (ratio === button.dataset.ratio) return;
      ratio = button.dataset.ratio;
      loadFilm();
    });
  });
  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (theme === button.dataset.theme) return;
      theme = button.dataset.theme;
      loadFilm();
    });
  });
  exportButton?.addEventListener("click", () => {
    downloadFilm();
  });
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || /^(INPUT|BUTTON|A|TEXTAREA)$/.test(event.target.tagName)) return;
    event.preventDefault();
    send(playing ? "pause" : "play");
  });

  if (!current) return;
  loadFilm();
})();
