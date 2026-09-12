(() => {
  const film = document.getElementById("film");
  const play = document.getElementById("play");
  const seek = document.getElementById("seek");
  const chapters = [...document.querySelectorAll(".chapter")];
  const formats = [...document.querySelectorAll(".formats button")];
  let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let time = 0;
  let ready = false;
  let loadTimeout;
  const controls = [...document.querySelectorAll(".controls button, .controls input, .chapter")];
  const send = (action, extra = {}) => {
    if (ready)
      film.contentWindow.postMessage(
        { type: "modesto:control", action, ...extra },
        location.origin,
      );
  };
  function watchLoad() {
    ready = false;
    controls.forEach((control) => {
      control.disabled = true;
    });
    document.getElementById("error").hidden = true;
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (!ready) document.getElementById("error").hidden = false;
    }, 15000);
  }
  watchLoad();
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== film.contentWindow) return;
    if (event.data?.type === "modesto:ready") {
      ready = true;
      clearTimeout(loadTimeout);
      document.getElementById("error").hidden = true;
      controls.forEach((control) => {
        control.disabled = false;
      });
    }
    if (event.data?.type !== "modesto:state") return;
    time = event.data.time;
    playing = event.data.playing;
    seek.value = String(time);
    document.getElementById("elapsed").textContent =
      `00:${String(Math.floor(time)).padStart(2, "0")}`;
    play.textContent = playing ? "Ⅱ  Pause" : "▶  Play";
    play.setAttribute("aria-label", playing ? "Pause film" : "Play film");
    chapters.forEach((chapter, index) =>
      chapter.setAttribute("aria-pressed", String(index === event.data.scene)),
    );
  });
  play.addEventListener("click", () => send(playing ? "pause" : "play"));
  document.getElementById("replay").addEventListener("click", () => send("restart"));
  seek.addEventListener("input", () => send("seek", { time: Number(seek.value) }));
  chapters.forEach((chapter) =>
    chapter.addEventListener("click", () => send("seek", { time: Number(chapter.dataset.time) })),
  );
  formats.forEach((button) =>
    button.addEventListener("click", () => {
      const ratio = button.dataset.ratio;
      if (document.querySelector(".stage-well").dataset.ratio === ratio) return;
      formats.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      document.querySelector(".stage-well").dataset.ratio = ratio;
      document.getElementById("format-label").textContent = {
        "16x9": "LANDSCAPE · 1920 × 1080",
        "9x16": "VERTICAL · 1080 × 1920",
        "1x1": "SQUARE · 1080 × 1080",
      }[ratio];
      document.getElementById("open").href = `./modesto-saas.html?ratio=${ratio}`;
      const exportLink = document.getElementById("export");
      exportLink.href = `./modesto-saas-${ratio}.mp4`;
      exportLink.download = `modesto-saas-${ratio}.mp4`;
      watchLoad();
      film.src = `./modesto-saas.html?ratio=${ratio}&embed=1&t=${time.toFixed(3)}&paused=${playing ? "0" : "1"}`;
    }),
  );
  document.getElementById("export").addEventListener("click", async (event) => {
    const link = event.currentTarget;
    if (link.dataset.busy === "true") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const href = link.getAttribute("href");
    const filename = link.getAttribute("download") || href.split("/").pop();
    const status = document.getElementById("export-status");
    link.dataset.busy = "true";
    if (status) status.textContent = "Preparing download…";
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error(`Could not fetch ${filename}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const save = document.createElement("a");
      save.href = url;
      save.download = filename;
      save.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      if (status) status.textContent = `Saved ${filename}`;
    } catch (error) {
      if (status) status.textContent = error?.message ?? "Download failed.";
      window.location.assign(href);
    } finally {
      link.dataset.busy = "false";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || /^(INPUT|BUTTON|A)$/.test(event.target.tagName)) return;
    event.preventDefault();
    send(playing ? "pause" : "play");
  });
})();
